import { ResourceDetailPage } from "@/features/resource-explorer/components/ResourceDetailPage";

export default async function PodDetailPage({
  params,
}: {
  params: Promise<{ namespace: string; name: string }>;
}) {
  const { namespace, name } = await params;

  return (
    <ResourceDetailPage
      kind="Pod"
      listHref="/kubernetes/workload/pod"
      breadcrumb={[
        { label: "Kubernetes" },
        { label: "Workloads", href: "/kubernetes/workload" },
        { label: "Pod", href: "/kubernetes/workload?tab=Pod" },
      ]}
      namespace={namespace === "_" ? undefined : decodeURIComponent(namespace)}
      name={decodeURIComponent(name)}
    />
  );
}
