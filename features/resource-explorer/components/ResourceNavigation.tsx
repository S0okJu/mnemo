"use client";
import { createContext, useContext } from "react";
import { withReturnTo } from "@/features/resource-explorer/lib/list-state";
export const ResourceReturnContext = createContext<string | undefined>(
  undefined,
);
export function useResourceNavigation() {
  const returnTo = useContext(ResourceReturnContext);
  return (href: string) => withReturnTo(href, returnTo);
}
