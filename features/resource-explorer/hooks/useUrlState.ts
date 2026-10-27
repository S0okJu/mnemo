"use client";

import { useCallback } from "react";
import { usePathname, useSearchParams } from "next/navigation";
export function useUrlState() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const update = useCallback(
    (
      changes: Record<string, string | undefined>,
      mode: "push" | "replace" = "push",
    ) => {
      // Read the latest URL so rapid typing and successive filter changes do not overwrite each other.
      const params = new URLSearchParams(window.location.search);
      for (const [key, value] of Object.entries(changes)) {
        if (value === undefined || value === "") params.delete(key);
        else params.set(key, value);
      }
      const href = `${pathname}${params.size ? `?${params}` : ""}`;
      if (mode === "replace") window.history.replaceState(null, "", href);
      else window.history.pushState(null, "", href);
    },
    [pathname],
  );
  return {
    pathname,
    searchParams,
    update,
    href: `${pathname}${searchParams.size ? `?${searchParams}` : ""}`,
  };
}
