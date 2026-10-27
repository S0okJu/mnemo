export type RouteSearchParams = Record<string, string | string[] | undefined>;

/** Keep existing list filters while the route determines its component/type. */
export function legacyListUrl(
  path: string,
  searchParams: RouteSearchParams,
  kind?: string,
) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) value.forEach((item) => query.append(key, item));
    else if (value !== undefined) query.set(key, value);
  }
  if (kind) {
    query.delete("tab");
    query.set("view", "resources");
    query.set("type", kind);
  }
  return `${path}${query.size ? `?${query}` : ""}`;
}

/** Keep list filters when a URL moves to a route that already fixes the type. */
export function typeListUrl(path: string, searchParams: RouteSearchParams) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (["view", "type", "tab"].includes(key)) continue;
    if (Array.isArray(value)) value.forEach((item) => query.append(key, item));
    else if (value !== undefined) query.set(key, value);
  }
  return `${path}${query.size ? `?${query}` : ""}`;
}
