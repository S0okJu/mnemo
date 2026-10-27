import { ResourceDetailPage } from "@/features/resource-explorer/components/ResourceDetailPage";

export default async function KyvernoPolicyReportDetailPage({
  params,
}: {
  params: Promise<{ namespace: string; name: string }>;
}) {
  const { namespace, name } = await params;

  return (
    <ResourceDetailPage
      kind="KyvernoPolicyReport"
      listHref="/security/kyverno/policy-report"
      breadcrumb={[
        { label: "Security & Governance" },
        { label: "Kyverno", href: "/security" },
        {
          label: "PolicyReport",
          href: "/security?tab=KyvernoPolicyReport",
        },
      ]}
      namespace={namespace === "_" ? undefined : decodeURIComponent(namespace)}
      name={decodeURIComponent(name)}
    />
  );
}
