"use client";

import { cn } from "@/lib/utils";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
};

export function Modal({ open, onClose, title, description, children, className }: ModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] p-6" onClick={onClose}>
      <div
        className={cn(
          "flex w-full max-w-2xl max-h-[calc(100dvh-3rem)] flex-col rounded-[16px] border border-[var(--panel-border)] bg-[var(--panel)] shadow-[var(--shadow)]",
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 flex items-center justify-between border-b border-[var(--hairline)] px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-[var(--foreground)]">{title}</h3>
            {description ? <p className="mt-1 text-sm text-[var(--muted)]">{description}</p> : null}
          </div>
          <button type="button" onClick={onClose} className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]">
            닫기
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-visible px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
