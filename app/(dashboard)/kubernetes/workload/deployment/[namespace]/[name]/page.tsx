import { ResourceDetailPage } from "@/features/resource-explorer/components/ResourceDetailPage";

export default async function DeploymentDetailPage({
  params,
}: {
  params: Promise<{ namespace: string; name: string }>;
}) {
  const { namespace, name } = await params;

  return (
    <ResourceDetailPage
      kind="Deployment"
      listHref="/kubernetes/workload/deployment"
      breadcrumb={[
        { label: "Kubernetes" },
        { label: "Workloads", href: "/kubernetes/workload" },
        { label: "Deployment", href: "/kubernetes/workload?tab=Deployment" },
      ]}
      namespace={namespace === "_" ? undefined : decodeURIComponent(namespace)}
      name={decodeURIComponent(name)}
    />
  );
}
