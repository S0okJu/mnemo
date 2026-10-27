import { ResourceDetailPage } from "@/features/resource-explorer/components/ResourceDetailPage";
export default async function NodeDetailPage({
  params,
}: {
  params: Promise<{ namespace: string; name: string }>;
}) {
  const { name } = await params;
  return (
    <ResourceDetailPage
      kind="Node"
      listHref="/kubernetes/node"
      breadcrumb={[
        { label: "Kubernetes" },
        { label: "Node", href: "/kubernetes/node" },
      ]}
      namespace={undefined}
      name={name}
    />
  );
}
