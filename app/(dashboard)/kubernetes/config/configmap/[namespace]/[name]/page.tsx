import { ResourceDetailPage } from "@/features/resource-explorer/components/ResourceDetailPage";

export default async function ConfigMapDetailPage({
  params,
}: {
  params: Promise<{ namespace: string; name: string }>;
}) {
  const { namespace, name } = await params;

  return (
    <ResourceDetailPage
      kind="ConfigMap"
      listHref="/kubernetes/config/configmap"
      breadcrumb={[
        { label: "Kubernetes" },
        { label: "Config", href: "/kubernetes/config" },
        { label: "ConfigMap", href: "/kubernetes/config?tab=ConfigMap" },
      ]}
      namespace={namespace === "_" ? undefined : decodeURIComponent(namespace)}
      name={decodeURIComponent(name)}
    />
  );
}
