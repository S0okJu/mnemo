import type { K8sResource, ResourceStatusLevel } from "@/lib/api/types";

export const STATUS_ORDER: Record<ResourceStatusLevel, number> = {
  Error: 0,
  Warning: 1,
  Progressing: 2,
  Unknown: 3,
  Healthy: 4,
};
export const SORT_OPTIONS = [
  "severity",
  "name",
  "kind",
  "namespace",
  "age",
] as const;
export type ListSort = (typeof SORT_OPTIONS)[number];
export interface ListState {
  view: "overview" | "resources";
  type: string;
  search: string;
  namespace: string;
  status: string;
  sort: ListSort;
  direction: "asc" | "desc";
  page: number;
  pageSize: number;
}
export interface ResourceRow {
  item: K8sResource;
  listHref: string;
}
export function readListState(
  params: URLSearchParams,
  kinds: string[],
): ListState {
  const legacy = params.get("tab");
  const type =
    params.get("type") ?? (legacy && kinds.includes(legacy) ? legacy : "all");
  const hasFilters = ["type", "q", "namespace", "status", "page"].some((key) =>
    params.has(key),
  );
  const page = Number(params.get("page") ?? 1);
  const sort = params.get("sort") ?? "severity";
  return {
    view:
      kinds.length <= 1 ||
      params.get("view") === "resources" ||
      (legacy && kinds.includes(legacy)) ||
      (!params.has("view") && hasFilters)
        ? "resources"
        : "overview",
    type: kinds.includes(type) ? type : "all",
    search: params.get("q") ?? "",
    namespace: params.get("namespace") ?? "all",
    status: Object.hasOwn(STATUS_ORDER, params.get("status") ?? "")
      ? params.get("status")!
      : "all",
    sort: SORT_OPTIONS.includes(sort as ListSort)
      ? (sort as ListSort)
      : "severity",
    direction: params.get("dir") === "desc" ? "desc" : "asc",
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
    pageSize: [10, 25, 50].includes(Number(params.get("pageSize")))
      ? Number(params.get("pageSize"))
      : 10,
  };
}
export function filterAndSortRows(
  rows: ResourceRow[],
  state: ListState,
): ResourceRow[] {
  const query = state.search.trim().toLowerCase();
  return rows
    .filter(
      ({ item }) =>
        (state.type === "all" || item.kind === state.type) &&
        (state.namespace === "all" ||
          (state.namespace === "_"
            ? !item.metadata.namespace
            : item.metadata.namespace === state.namespace)) &&
        (state.status === "all" || item.status.level === state.status) &&
        (!query || item.metadata.name.toLowerCase().includes(query)),
    )
    .sort((a, b) => {
      const left = a.item,
        right = b.item;
      let comparison = 0;
      switch (state.sort) {
        case "severity":
          comparison =
            STATUS_ORDER[left.status.level] - STATUS_ORDER[right.status.level];
          break;
        case "age":
          comparison =
            new Date(left.metadata.createdAt).getTime() -
            new Date(right.metadata.createdAt).getTime();
          break;
        case "name":
          comparison = left.metadata.name.localeCompare(right.metadata.name);
          break;
        case "kind":
          comparison = left.kind.localeCompare(right.kind);
          break;
        case "namespace":
          comparison = (left.metadata.namespace ?? "").localeCompare(
            right.metadata.namespace ?? "",
          );
          break;
      }
      if (!Number.isFinite(comparison)) comparison = 0;
      return (
        (comparison ||
          `${left.kind}/${left.metadata.namespace}/${left.metadata.name}`.localeCompare(
            `${right.kind}/${right.metadata.namespace}/${right.metadata.name}`,
          )) * (state.direction === "desc" ? -1 : 1)
      );
    });
}
export function safeReturnTo(
  value: string | null | undefined,
): string | undefined {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    value.length > 4096
  )
    return;
  try {
    const url = new URL(value, "https://mnemo.local");
    if (
      url.origin !== "https://mnemo.local" ||
      !/^\/(kubernetes|cni|storage|network|security)(\/|$)/.test(url.pathname)
    )
      return;
    return `${url.pathname}${url.search}`;
  } catch {
    return;
  }
}
export function withReturnTo(href: string, returnTo?: string) {
  const safe = safeReturnTo(returnTo);
  if (!safe) return href;
  const [path, query] = href.split("?");
  const params = new URLSearchParams(query);
  params.set("returnTo", safe);
  return `${path}?${params}`;
}
export function resourceDetailHref(
  listHref: string,
  item: K8sResource,
  returnTo?: string,
) {
  return withReturnTo(
    `${listHref}/${encodeURIComponent(item.metadata.namespace ?? "_")}/${encodeURIComponent(item.metadata.name)}`,
    returnTo,
  );
}
