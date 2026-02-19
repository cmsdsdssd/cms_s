"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

type SheetProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
};

const FOCUSABLE_SELECTOR =
  "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";

export function Sheet({ open, onClose, title, children, className }: SheetProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const prevFocusedRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    prevFocusedRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => {
      const first = panelRef.current?.querySelector(FOCUSABLE_SELECTOR);
      if (first instanceof HTMLElement) {
        first.focus();
      }
    }, 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
      if (prevFocusedRef.current) {
        prevFocusedRef.current.focus();
      }
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" aria-hidden={!open}>
      <div
        className={cn(
          "absolute inset-0 bg-[var(--overlay)] transition-opacity",
          "duration-[var(--duration-normal)] ease-[var(--ease-out)] opacity-100"
        )}
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title ?? "Sheet"}
        className={cn(
          "absolute right-0 top-0 h-full w-[95vw] border-l border-[var(--panel-border)] bg-[var(--panel)] shadow-[var(--shadow)]",
          "transition-transform duration-[var(--duration-normal)] ease-[var(--ease-out)] translate-x-0",
          "flex flex-col lg:w-[1100px]",
          className
        )}
      >
        {children}
      </div>
    </div>
  );
}
