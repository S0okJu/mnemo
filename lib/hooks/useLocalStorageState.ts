"use client";

import { useCallback, useState } from "react";

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Component-local state backed by localStorage. The mnemo dashboard only
 * mounts behind the MSW-ready gate in `AppProviders`, so this never runs
 * during SSR/hydration and can read `localStorage` synchronously.
 */
export function useLocalStorageState<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => readStorage(key, fallback));

  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved =
          typeof next === "function" ? (next as (prev: T) => T)(prev) : next;
        try {
          window.localStorage.setItem(key, JSON.stringify(resolved));
        } catch {
          // Ignore write failures (private browsing, storage full, etc).
        }
        return resolved;
      });
    },
    [key],
  );

  return [value, update] as const;
}
