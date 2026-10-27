import { ResourceDetailPage } from "@/features/resource-explorer/components/ResourceDetailPage";

export default async function SecretDetailPage({
  params,
}: {
  params: Promise<{ namespace: string; name: string }>;
}) {
  const { namespace, name } = await params;

  return (
    <ResourceDetailPage
      kind="Secret"
      listHref="/kubernetes/config/secret"
      breadcrumb={[
        { label: "Kubernetes" },
        { label: "Config", href: "/kubernetes/config" },
        { label: "Secret", href: "/kubernetes/config?tab=Secret" },
      ]}
      namespace={namespace === "_" ? undefined : decodeURIComponent(namespace)}
      name={decodeURIComponent(name)}
    />
  );
}
