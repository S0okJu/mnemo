import { ResourceDetailPage } from "@/features/resource-explorer/components/ResourceDetailPage";

export default async function RbacRoleDetailPage({
  params,
}: {
  params: Promise<{ namespace: string; name: string }>;
}) {
  const { namespace, name } = await params;

  return (
    <ResourceDetailPage
      kind="RbacRole"
      listHref="/kubernetes/rbac/role"
      breadcrumb={[
        { label: "Kubernetes" },
        { label: "RBAC", href: "/kubernetes/rbac" },
        { label: "Role", href: "/kubernetes/rbac?tab=RbacRole" },
      ]}
      namespace={namespace === "_" ? undefined : decodeURIComponent(namespace)}
      name={decodeURIComponent(name)}
    />
  );
}
