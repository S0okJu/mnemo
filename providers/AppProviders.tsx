"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { TooltipProvider } from "@/components/ui/tooltip";
import { createQueryClient } from "@/lib/query/queryClient";
import { CollectionEvents } from "./CollectionEvents";

const queryClient = createQueryClient();
const isMockMode = process.env.NEXT_PUBLIC_API_MODE === "mock";

const MockBrowserBootstrap = dynamic(
  () =>
    import("@/providers/MockBrowserBootstrap").then(
      (mod) => mod.MockBrowserBootstrap,
    ),
  { ssr: false },
);

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [mswReady, setMswReady] = useState(!isMockMode);
  const handleReady = useCallback(() => setMswReady(true), []);

  if (!mswReady) {
    return (
      <>
        {isMockMode && <MockBrowserBootstrap onReady={handleReady} />}
        <div className="text-muted-foreground flex h-dvh items-center justify-center text-sm">
          Loading mnemo…
        </div>
      </>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <CollectionEvents />
      <TooltipProvider>{children}</TooltipProvider>
      {process.env.NODE_ENV === "development" && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}
