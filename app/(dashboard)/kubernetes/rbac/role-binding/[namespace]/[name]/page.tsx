import { ResourceDetailPage } from "@/features/resource-explorer/components/ResourceDetailPage";

export default async function RbacRoleBindingDetailPage({
  params,
}: {
  params: Promise<{ namespace: string; name: string }>;
}) {
  const { namespace, name } = await params;

  return (
    <ResourceDetailPage
      kind="RbacRoleBinding"
      listHref="/kubernetes/rbac/role-binding"
      breadcrumb={[
        { label: "Kubernetes" },
        { label: "RBAC", href: "/kubernetes/rbac" },
        { label: "RoleBinding", href: "/kubernetes/rbac?tab=RbacRoleBinding" },
      ]}
      namespace={namespace === "_" ? undefined : decodeURIComponent(namespace)}
      name={decodeURIComponent(name)}
    />
  );
}
