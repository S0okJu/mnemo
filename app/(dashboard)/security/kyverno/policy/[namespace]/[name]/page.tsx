import { ResourceDetailPage } from "@/features/resource-explorer/components/ResourceDetailPage";

export default async function KyvernoPolicyDetailPage({
  params,
}: {
  params: Promise<{ namespace: string; name: string }>;
}) {
  const { namespace, name } = await params;

  return (
    <ResourceDetailPage
      kind="KyvernoPolicy"
      listHref="/security/kyverno/policy"
      breadcrumb={[
        { label: "Security & Governance" },
        { label: "Kyverno", href: "/security" },
        { label: "Policy", href: "/security?tab=KyvernoPolicy" },
      ]}
      namespace={namespace === "_" ? undefined : decodeURIComponent(namespace)}
      name={decodeURIComponent(name)}
    />
  );
}
