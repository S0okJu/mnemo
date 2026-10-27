"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";
import type { K8sResource, ResourceList } from "@/lib/api/types";
import { resourceApiPaths } from "@/lib/resource-registry/resource-paths";
import { resourceKeys } from "@/lib/query/queryKeys";
import {
  resolveResourceReference,
  type ResourceReference,
} from "@/lib/resource-registry/resource-reference";
import { relatedResourceKind } from "../lib/related-resource-info";
import { ResourceLink } from "./ResourceLink";
import { StatusDot } from "./StatusBadge";

const VISIBLE = 3;

/** A Summary reference: link plus status from the cached list (no per-row request). */
function Reference({ reference }: { reference: ResourceReference }) {
  const resolved = resolveResourceReference(reference);
  const kind = relatedResourceKind(resolved.kind);
  const path = resourceApiPaths[kind];
  const list = useQuery({
    queryKey: resourceKeys.list(kind, {}),
    queryFn: () => apiFetch<ResourceList<K8sResource>>(`/${path}`),
    enabled: !!path,
    retry: false,
    staleTime: 10000,
  });
  const status = list.data?.items.find(
    (item) =>
      item.metadata.name === resolved.name &&
      item.metadata.namespace === resolved.namespace,
  )?.status.level;
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      {status && (
        <>
          <StatusDot level={status} />
          <span className="sr-only">{status}</span>
        </>
      )}
      <ResourceLink
        kind={resolved.kind}
        name={resolved.name}
        namespace={resolved.namespace}
      />
    </span>
  );
}

export function ReferenceValue({
  references,
}: {
  references: ResourceReference[];
}) {
  const visible = references.slice(0, VISIBLE);
  const hidden = references.length - visible.length;
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
      {visible.map((reference) => (
        <Reference
          key={`${reference.kind}/${reference.namespace}/${reference.name}`}
          reference={reference}
        />
      ))}
      {hidden > 0 && (
        <span className="text-muted-foreground text-xs">+{hidden} more</span>
      )}
    </span>
  );
}
