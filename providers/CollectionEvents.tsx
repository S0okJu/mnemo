"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

export function CollectionEvents() {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_API_MODE === "mock") return;
    const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/v1";
    const stream = new EventSource(`${base}/events`, { withCredentials: true });
    let pending: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(pending);
      pending = setTimeout(() => {
        void queryClient.invalidateQueries({
          predicate: (query) =>
            ["resources", "plugins", "cluster"].includes(
              String(query.queryKey[0]),
            ),
        });
      }, 250);
    };
    stream.addEventListener("refresh", refresh);
    // EventSource reconnects automatically; the server sends a refresh on open.
    return () => {
      clearTimeout(pending);
      stream.close();
    };
  }, [queryClient]);
  return null;
}
