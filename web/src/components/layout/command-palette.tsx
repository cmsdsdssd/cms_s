"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, X, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { navItems, bottomNavItems, NavItem } from "./nav-items";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onOpenWorkbench?: () => void;
}

type SearchResult = {
  label: string;
  href: string;
  group: string;
  icon?: React.ElementType;
};

export function CommandPalette({ open, onClose, onOpenWorkbench }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const previousFocusRef = React.useRef<HTMLElement | null>(null);

  // Flatten items for search
  const allItems = React.useMemo(() => {
    const items: SearchResult[] = [];
    
    navItems.forEach((group) => {
      group.items?.forEach((item) => {
        if (item.href) {
          items.push({
            label: item.label,
            href: item.href,
            group: group.label,
            icon: item.icon,
          });
        }
      });
    });

    bottomNavItems.forEach((item) => {
      if (item.href) {
        items.push({
          label: item.label,
          href: item.href,
          group: "설정",
          icon: item.icon,
        });
      }
    });

    return items;
  }, []);

  // Filter items
  const filteredItems = React.useMemo(() => {
    if (!query) return [];
    const lowerQuery = query.toLowerCase();
    return allItems.filter(
      (item) =>
        item.label.toLowerCase().includes(lowerQuery) ||
        item.group.toLowerCase().includes(lowerQuery)
    );
  }, [query, allItems]);

  // Handle open/close focus management
  React.useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      // Small timeout to ensure render
      setTimeout(() => inputRef.current?.focus(), 0);
      // Reset state
      setQuery("");
      setSelectedIndex(0);
      // Prevent body scroll
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      previousFocusRef.current?.focus();
    }
    
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Handle keyboard navigation
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return;

      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => 
          prev < filteredItems.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          handleSelect(filteredItems[selectedIndex]);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, filteredItems, selectedIndex, onClose]);

  const handleSelect = (item: SearchResult) => {
    if (item.href === "/workbench") {
      onClose();
      onOpenWorkbench?.();
      return;
    }
    router.push(item.href);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] px-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />
      
      {/* Dialog */}
      <div className="relative w-full max-w-lg rounded-xl border border-[var(--panel-border)] bg-[var(--background)] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
        <div className="flex items-center border-b border-[var(--hairline)] px-3">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <input
            ref={inputRef}
            className="flex h-12 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-[var(--muted-weak)] disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Type a command or search..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
          />
          <div className="flex items-center gap-1">
            <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-[var(--muted-weak)]/20 px-1.5 font-mono text-[10px] font-medium text-[var(--muted-strong)] opacity-100">
              <span className="text-xs">ESC</span>
            </kbd>
          </div>
        </div>
        
        <div className="max-h-[300px] overflow-y-auto p-2">
          {filteredItems.length === 0 ? (
            <p className="p-4 text-center text-sm text-[var(--muted)]">
              {query ? "No results found." : "Type to search..."}
            </p>
          ) : (
            <div className="space-y-1">
              {filteredItems.map((item, index) => (
                <button
                  key={`${item.group}-${item.href}`}
                  className={cn(
                    "flex w-full items-center rounded-md px-2 py-2 text-sm outline-none transition-colors",
                    index === selectedIndex 
                      ? "bg-[var(--accent)] text-[var(--accent-foreground)]" 
                      : "text-[var(--foreground)] hover:bg-[var(--accent)]/50"
                  )}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  {item.icon && <item.icon className="mr-2 h-4 w-4" />}
                  <span>{item.label}</span>
                  <span className="ml-auto text-xs opacity-50">{item.group}</span>
                  {index === selectedIndex && <ArrowRight className="ml-2 h-3 w-3 opacity-50" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
