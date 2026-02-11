"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { 
  ChevronLeft, 
  ChevronRight, 
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { navItems, bottomNavItems, type NavItem, isNavItemActive } from "./nav-items";
import { Button } from "@/components/ui/button";

interface SidebarNavProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
  onWorkbenchOpen?: () => void;
}

export function SidebarNav({ mobileOpen, onMobileClose, onWorkbenchOpen }: SidebarNavProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    onMobileClose();
  }, [pathname, onMobileClose]);

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  const NavGroup = ({ group, collapsed }: { group: NavItem; collapsed: boolean }) => {
    if (!group.items || group.items.length === 0) return null;

    return (
      <div className="mb-6">
        {!collapsed && (
          <h3 className="mb-2 px-4 text-xs font-semibold uppercase tracking-wider text-[var(--muted-strong)]">
            {group.label}
          </h3>
        )}
        <div className="space-y-0.5">
          {group.items.map((item) => (
            <NavLink key={item.href} item={item} collapsed={collapsed} />
          ))}
        </div>
      </div>
    );
  };

  const NavLink = ({ item, collapsed }: { item: NavItem; collapsed: boolean }) => {
    const isActive = item.href ? isNavItemActive(pathname, item.href) : false;
    const Icon = item.icon;

    if (!item.href) return null;
    if (item.href === "/workbench") {
      return (
        <button
          type="button"
          onClick={() => onWorkbenchOpen?.()}
          className={cn(
            "group flex w-full items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-sm font-medium transition-colors transition-shadow duration-200 active:scale-[0.98]",
            isActive
              ? "bg-[var(--primary)] text-white shadow-[var(--shadow-sm)]"
              : "text-[var(--muted-strong)] hover:bg-[var(--panel-hover)] hover:text-[var(--foreground)] hover:shadow-[var(--shadow-sm)]",
            collapsed && "justify-center px-2"
          )}
          title={collapsed ? item.label : undefined}
        >
          {Icon && (
            <Icon
              className={cn(
                "h-4 w-4 shrink-0 transition-colors",
                isActive ? "text-white" : "text-[var(--muted)] group-hover:text-[var(--foreground)]"
              )}
            />
          )}
          {!collapsed && <span>{item.label}</span>}
        </button>
      );
    }

    return (
      <Link
        href={item.href}
        className={cn(
          "group flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-sm font-medium transition-colors transition-shadow duration-200 active:scale-[0.98]",
          isActive
            ? "bg-[var(--primary)] text-white shadow-[var(--shadow-sm)]"
            : "text-[var(--muted-strong)] hover:bg-[var(--panel-hover)] hover:text-[var(--foreground)] hover:shadow-[var(--shadow-sm)]",
          collapsed && "justify-center px-2"
        )}
        title={collapsed ? item.label : undefined}
      >
        {Icon && (
          <Icon
            className={cn(
              "h-4 w-4 shrink-0 transition-colors",
              isActive ? "text-white" : "text-[var(--muted)] group-hover:text-[var(--foreground)]"
            )}
          />
        )}
        {!collapsed && <span>{item.label}</span>}
      </Link>
    );
  };

  const SidebarContent = () => (
    <div className="flex h-full flex-col bg-[var(--panel)] border-r border-[var(--hairline)]">
      {/* Header / Logo */}
      <div className={cn("flex h-14 items-center border-b border-[var(--hairline)] px-4", isCollapsed ? "justify-center" : "justify-between")}>
        {!isCollapsed && (
          <div className="flex items-center gap-2 font-bold text-[var(--foreground)]">
            <div className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] bg-gradient-to-br from-[var(--primary)] to-[var(--primary-strong)] text-white shadow-sm">
              J
            </div>
            <span>MS</span>
          </div>
        )}
        {isCollapsed && (
           <div className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] bg-gradient-to-br from-[var(--primary)] to-[var(--primary-strong)] text-white shadow-sm">
             J
           </div>
        )}
        
        {/* Desktop Collapse Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleCollapse}
          className={cn(
            "hidden lg:flex h-8 w-8 text-[var(--muted)] hover:text-[var(--foreground)]",
            isCollapsed && "hidden"
          )}
          title="사이드바 접기"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>

      {/* Scrollable Nav Items */}
      <div className="flex-1 overflow-y-auto py-4 px-2 scrollbar-thin">
        {navItems.map((group) => (
          <NavGroup key={group.label} group={group} collapsed={isCollapsed} />
        ))}
      </div>

      {/* Bottom Actions / Settings */}
      <div className="border-t border-[var(--hairline)] p-2">
        {bottomNavItems.map((item) => (
          <NavLink key={item.href} item={item} collapsed={isCollapsed} />
        ))}
        
        {/* Collapse Toggle for Collapsed State (since we hid the top one) */}
        <button
          onClick={toggleCollapse}
          className={cn(
            "mt-2 flex w-full items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-sm font-medium text-[var(--muted-strong)] hover:bg-[var(--panel-hover)] hover:text-[var(--foreground)] transition-colors",
            isCollapsed ? "justify-center" : "hidden lg:flex"
          )}
          title={isCollapsed ? "사이드바 펼치기" : "사이드바 접기"}
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : null}
          {!isCollapsed && (
             <span className="flex items-center gap-2">
               <ChevronLeft className="h-4 w-4" />
               <span>접기</span>
             </span>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Overlay */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/50 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={onMobileClose}
        />
      )}

      {/* Mobile Drawer */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 transform bg-[var(--background)] transition-transform duration-300 ease-in-out lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-[var(--hairline)] px-4 h-14">
               <span className="font-bold">메뉴</span>
               <button onClick={onMobileClose} className="p-1" title="닫기">
                 <X className="h-5 w-5" />
               </button>
            </div>
           <div className="flex-1 overflow-y-auto p-4">
              {navItems.map((group) => (
                <div key={group.label} className="mb-6">
                  <h3 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted-strong)]">
                    {group.label}
                  </h3>
                  <div className="space-y-1">
                      {group.items?.map((item) => {
                        if (item.href === "/workbench") {
                          return (
                            <button
                              key={item.href}
                              type="button"
                              onClick={() => {
                                onMobileClose();
                                onWorkbenchOpen?.();
                              }}
                              className={cn(
                                "flex w-full items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-sm font-medium transition-colors transition-shadow active:scale-[0.98]",
                                item.href && isNavItemActive(pathname, item.href)
                                  ? "bg-[var(--primary)] text-white shadow-[var(--shadow-sm)]"
                                  : "text-[var(--muted-strong)] hover:bg-[var(--panel-hover)] hover:shadow-[var(--shadow-sm)]"
                              )}
                            >
                              {item.icon && <item.icon className="h-4 w-4" />}
                              {item.label}
                            </button>
                          );
                        }

                        return (
                          <Link
                            key={item.href}
                            href={item.href || "#"}
                            className={cn(
                              "flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-sm font-medium transition-colors transition-shadow active:scale-[0.98]",
                              item.href && isNavItemActive(pathname, item.href)
                                ? "bg-[var(--primary)] text-white shadow-[var(--shadow-sm)]"
                                : "text-[var(--muted-strong)] hover:bg-[var(--panel-hover)] hover:shadow-[var(--shadow-sm)]"
                            )}
                          >
                            {item.icon && <item.icon className="h-4 w-4" />}
                            {item.label}
                          </Link>
                        );
                      })}
                  </div>
                </div>
              ))}
              <div className="border-t border-[var(--hairline)] pt-4 mt-4">
                 {bottomNavItems.map((item) => (
                    <Link
                        key={item.href}
                        href={item.href || "#"}
                        className={cn(
                          "flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-sm font-medium transition-colors transition-shadow active:scale-[0.98]",
                          item.href && isNavItemActive(pathname, item.href)
                            ? "bg-[var(--primary)] text-white shadow-[var(--shadow-sm)]"
                            : "text-[var(--muted-strong)] hover:bg-[var(--panel-hover)] hover:shadow-[var(--shadow-sm)]"
                        )}
                    >
                        {item.icon && <item.icon className="h-4 w-4" />}
                        {item.label}
                    </Link>
                 ))}
              </div>
           </div>
        </div>
      </div>

      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden lg:block sticky top-0 h-screen shrink-0 transition-[width] duration-300 ease-in-out",
          isCollapsed ? "w-16" : "w-64"
        )}
      >
        <SidebarContent />
      </aside>
    </>
  );
}
