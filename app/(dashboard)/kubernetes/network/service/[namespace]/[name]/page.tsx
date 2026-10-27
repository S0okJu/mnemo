import { ResourceDetailPage } from "@/features/resource-explorer/components/ResourceDetailPage";

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ namespace: string; name: string }>;
}) {
  const { namespace, name } = await params;

  return (
    <ResourceDetailPage
      kind="Service"
      listHref="/kubernetes/network/service"
      breadcrumb={[
        { label: "Kubernetes" },
        { label: "Kubernetes Network", href: "/kubernetes/network" },
        { label: "Service", href: "/kubernetes/network?tab=Service" },
      ]}
      namespace={namespace === "_" ? undefined : decodeURIComponent(namespace)}
      name={decodeURIComponent(name)}
    />
  );
}
