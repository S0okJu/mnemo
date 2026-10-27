import { ResourceDetailPage } from "@/features/resource-explorer/components/ResourceDetailPage";

export default async function RbacServiceAccountDetailPage({
  params,
}: {
  params: Promise<{ namespace: string; name: string }>;
}) {
  const { namespace, name } = await params;

  return (
    <ResourceDetailPage
      kind="RbacServiceAccount"
      listHref="/kubernetes/rbac/service-account"
      breadcrumb={[
        { label: "Kubernetes" },
        { label: "RBAC", href: "/kubernetes/rbac" },
        {
          label: "ServiceAccount",
          href: "/kubernetes/rbac?tab=RbacServiceAccount",
        },
      ]}
      namespace={namespace === "_" ? undefined : decodeURIComponent(namespace)}
      name={decodeURIComponent(name)}
    />
  );
}
