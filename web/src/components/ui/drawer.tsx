import { ReactNode, useEffect } from "react";
import { cn } from "@/lib/utils";

type DrawerProps = {
    open: boolean;
    onClose: () => void;
    title?: string;
    children: ReactNode;
    className?: string;
};

export function Drawer({ open, onClose, title, children, className }: DrawerProps) {
    useEffect(() => {
        if (open) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [open]);

    if (!open) return null;

    return (
        <>
            {/* Overlay */}
            <div
                className="fixed inset-0 bg-black/50 z-40 transition-opacity duration-200"
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Drawer Panel */}
            <div
                className={cn(
                    "fixed top-0 right-0 bottom-0 z-50 bg-[var(--surface)] shadow-2xl",
                    "w-[min(720px,100vw)] overflow-hidden flex flex-col",
                    "transform transition-transform duration-300 ease-in-out",
                    open ? "translate-x-0" : "translate-x-full",
                    className
                )}
            >
                {/* Header */}
                {title && (
                    <div className="border-b border-[var(--panel-border)] px-6 py-4 flex items-center justify-between bg-[var(--chip)]">
                        <h2 className="text-lg font-semibold">{title}</h2>
                        <button
                            type="button"
                            onClick={onClose}
                            className="h-8 w-8 rounded-lg hover:bg-[var(--panel)] flex items-center justify-center transition-colors text-[var(--muted)] hover:text-[var(--foreground)]"
                            aria-label="닫기"
                        >
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-y-auto">{children}</div>
            </div>
        </>
    );
}
