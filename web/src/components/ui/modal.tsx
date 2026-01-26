"use client";

import { cn } from "@/lib/utils";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
};

export function Modal({ open, onClose, title, children, className }: ModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-6">
      <div
        className={cn(
          "w-full max-w-2xl rounded-[16px] border border-[var(--panel-border)] bg-white shadow-[var(--shadow)]",
          className
        )}
      >
        <div className="flex items-center justify-between border-b border-[var(--panel-border)] px-6 py-4">
          <h3 className="text-lg font-semibold text-[var(--foreground)]">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-[var(--muted)]"
          >
            닫기
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
