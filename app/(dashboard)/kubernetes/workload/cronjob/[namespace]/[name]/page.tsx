import { ResourceDetailPage } from "@/features/resource-explorer/components/ResourceDetailPage";

export default async function CronJobDetailPage({
  params,
}: {
  params: Promise<{ namespace: string; name: string }>;
}) {
  const { namespace, name } = await params;

  return (
    <ResourceDetailPage
      kind="CronJob"
      listHref="/kubernetes/workload/cronjob"
      breadcrumb={[
        { label: "Kubernetes" },
        { label: "Workloads", href: "/kubernetes/workload" },
        { label: "CronJob", href: "/kubernetes/workload?tab=CronJob" },
      ]}
      namespace={namespace === "_" ? undefined : decodeURIComponent(namespace)}
      name={decodeURIComponent(name)}
    />
  );
}
