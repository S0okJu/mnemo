export const resourceKeys = {
  all: ["resources"] as const,
  lists: (kind: string) => [...resourceKeys.all, kind, "list"] as const,
  list: (kind: string, filters: Record<string, unknown>) =>
    [...resourceKeys.lists(kind), filters] as const,
  details: (kind: string) => [...resourceKeys.all, kind, "detail"] as const,
  detail: (kind: string, namespace: string | undefined, name: string) =>
    [...resourceKeys.details(kind), namespace ?? null, name] as const,
  subContent: (
    kind: string,
    namespace: string | undefined,
    name: string,
    sub: string,
  ) => [...resourceKeys.detail(kind, namespace, name), sub] as const,
};
