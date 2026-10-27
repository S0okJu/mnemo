"use client";

import { useQuery } from "@tanstack/react-query";
import { getSession } from "@/lib/api/client";

export function useSession() {
  return useQuery({
    queryKey: ["session"],
    queryFn: getSession,
    staleTime: Infinity,
    retry: false,
  });
}
