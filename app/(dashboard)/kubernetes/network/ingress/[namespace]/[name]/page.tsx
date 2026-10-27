import { ResourceDetailPage } from "@/features/resource-explorer/components/ResourceDetailPage";

export default async function IngressDetailPage({
  params,
}: {
  params: Promise<{ namespace: string; name: string }>;
}) {
  const { namespace, name } = await params;

  return (
    <ResourceDetailPage
      kind="Ingress"
      listHref="/kubernetes/network/ingress"
      breadcrumb={[
        { label: "Kubernetes" },
        { label: "Kubernetes Network", href: "/kubernetes/network" },
        { label: "Ingress", href: "/kubernetes/network?tab=Ingress" },
      ]}
      namespace={namespace === "_" ? undefined : decodeURIComponent(namespace)}
      name={decodeURIComponent(name)}
    />
  );
}
