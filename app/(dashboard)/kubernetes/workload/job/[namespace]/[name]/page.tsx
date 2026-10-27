import { ResourceDetailPage } from "@/features/resource-explorer/components/ResourceDetailPage";

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ namespace: string; name: string }>;
}) {
  const { namespace, name } = await params;

  return (
    <ResourceDetailPage
      kind="Job"
      listHref="/kubernetes/workload/job"
      breadcrumb={[
        { label: "Kubernetes" },
        { label: "Workloads", href: "/kubernetes/workload" },
        { label: "Job", href: "/kubernetes/workload?tab=Job" },
      ]}
      namespace={namespace === "_" ? undefined : decodeURIComponent(namespace)}
      name={decodeURIComponent(name)}
    />
  );
}
