// Cluster-scoped resources (no namespace) use this literal segment so the URL
// shape always matches the `:namespace/:name` pattern MSW handlers register.
const CLUSTER_SCOPED = "_";

export const endpoints = {
  list: (kindPath: string) => `/${kindPath}`,
  detail: (kindPath: string, namespace: string | undefined, name: string) =>
    `/${kindPath}/${namespace ?? CLUSTER_SCOPED}/${name}`,
  subContent: (
    kindPath: string,
    namespace: string | undefined,
    name: string,
    sub: string,
  ) => `/${kindPath}/${namespace ?? CLUSTER_SCOPED}/${name}/${sub}`,
};
