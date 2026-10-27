"use client";

import { useEffect } from "react";

export function MockBrowserBootstrap({ onReady }: { onReady: () => void }) {
  useEffect(() => {
    let cancelled = false;

    import("@/lib/mocks/browser").then(({ startMockWorker }) =>
      startMockWorker().then(() => {
        if (!cancelled) onReady();
      }),
    );

    return () => {
      cancelled = true;
    };
  }, [onReady]);

  return null;
}
