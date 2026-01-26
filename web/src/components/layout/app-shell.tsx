import { Sidebar } from "@/components/layout/sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[var(--background)]">
      <Sidebar />
      <div className="flex-1 overflow-y-auto">
        <div className="min-h-screen px-8 py-8">{children}</div>
      </div>
    </div>
  );
}
