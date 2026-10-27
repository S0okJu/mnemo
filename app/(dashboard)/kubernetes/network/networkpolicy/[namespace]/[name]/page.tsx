import { ResourceDetailPage } from "@/features/resource-explorer/components/ResourceDetailPage";

export default async function NetworkPolicyDetailPage({
  params,
}: {
  params: Promise<{ namespace: string; name: string }>;
}) {
  const { namespace, name } = await params;

  return (
    <ResourceDetailPage
      kind="NetworkPolicy"
      listHref="/kubernetes/network/networkpolicy"
      breadcrumb={[
        { label: "Kubernetes" },
        { label: "Kubernetes Network", href: "/kubernetes/network" },
        {
          label: "NetworkPolicy",
          href: "/kubernetes/network?tab=NetworkPolicy",
        },
      ]}
      namespace={namespace === "_" ? undefined : decodeURIComponent(namespace)}
      name={decodeURIComponent(name)}
    />
  );
}
