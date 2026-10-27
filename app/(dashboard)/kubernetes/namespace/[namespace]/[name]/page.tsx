import { ResourceDetailPage } from "@/features/resource-explorer/components/ResourceDetailPage";
export default async function NamespaceDetailPage({
  params,
}: {
  params: Promise<{ namespace: string; name: string }>;
}) {
  const { name } = await params;
  return (
    <ResourceDetailPage
      kind="Namespace"
      listHref="/kubernetes/namespace"
      breadcrumb={[
        { label: "Kubernetes" },
        { label: "Namespace", href: "/kubernetes/namespace" },
      ]}
      namespace={undefined}
      name={name}
    />
  );
}
