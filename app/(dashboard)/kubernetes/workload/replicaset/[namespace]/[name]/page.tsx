import { ResourceDetailPage } from "@/features/resource-explorer/components/ResourceDetailPage";

export default async function ReplicaSetDetailPage({
  params,
}: {
  params: Promise<{ namespace: string; name: string }>;
}) {
  const { namespace, name } = await params;

  return (
    <ResourceDetailPage
      kind="ReplicaSet"
      listHref="/kubernetes/workload/replicaset"
      breadcrumb={[
        { label: "Kubernetes" },
        { label: "Workloads", href: "/kubernetes/workload" },
        { label: "ReplicaSet", href: "/kubernetes/workload?tab=ReplicaSet" },
      ]}
      namespace={namespace === "_" ? undefined : decodeURIComponent(namespace)}
      name={decodeURIComponent(name)}
    />
  );
}
