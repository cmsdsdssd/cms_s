"use client";

"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Toaster } from "sonner";

declare global {
  interface Window {
    __cms_toaster__?: boolean;
  }
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [showToaster, setShowToaster] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.__cms_toaster__) return;
    window.__cms_toaster__ = true;
    setShowToaster(true);
    return () => {
      window.__cms_toaster__ = false;
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {showToaster ? <Toaster richColors position="bottom-center" /> : null}
    </QueryClientProvider>
  );
}
