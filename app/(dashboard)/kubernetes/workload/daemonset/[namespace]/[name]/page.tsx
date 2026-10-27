import { ResourceDetailPage } from "@/features/resource-explorer/components/ResourceDetailPage";

export default async function DaemonSetDetailPage({
  params,
}: {
  params: Promise<{ namespace: string; name: string }>;
}) {
  const { namespace, name } = await params;

  return (
    <ResourceDetailPage
      kind="DaemonSet"
      listHref="/kubernetes/workload/daemonset"
      breadcrumb={[
        { label: "Kubernetes" },
        { label: "Workloads", href: "/kubernetes/workload" },
        { label: "DaemonSet", href: "/kubernetes/workload?tab=DaemonSet" },
      ]}
      namespace={namespace === "_" ? undefined : decodeURIComponent(namespace)}
      name={decodeURIComponent(name)}
    />
  );
}
