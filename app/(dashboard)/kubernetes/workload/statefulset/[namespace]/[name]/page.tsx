import { ResourceDetailPage } from "@/features/resource-explorer/components/ResourceDetailPage";

export default async function StatefulSetDetailPage({
  params,
}: {
  params: Promise<{ namespace: string; name: string }>;
}) {
  const { namespace, name } = await params;

  return (
    <ResourceDetailPage
      kind="StatefulSet"
      listHref="/kubernetes/workload/statefulset"
      breadcrumb={[
        { label: "Kubernetes" },
        { label: "Workloads", href: "/kubernetes/workload" },
        { label: "StatefulSet", href: "/kubernetes/workload?tab=StatefulSet" },
      ]}
      namespace={namespace === "_" ? undefined : decodeURIComponent(namespace)}
      name={decodeURIComponent(name)}
    />
  );
}
