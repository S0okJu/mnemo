import { ResourceDetailPage } from "@/features/resource-explorer/components/ResourceDetailPage";

export default async function PersistentVolumeClaimDetailPage({
  params,
}: {
  params: Promise<{ namespace: string; name: string }>;
}) {
  const { namespace, name } = await params;

  return (
    <ResourceDetailPage
      kind="PersistentVolumeClaim"
      listHref="/storage/persistent-volume-claim"
      breadcrumb={[
        { label: "Kubernetes" },
        { label: "Volumes", href: "/storage" },
        {
          label: "PersistentVolumeClaim",
          href: "/storage?tab=PersistentVolumeClaim",
        },
      ]}
      namespace={namespace === "_" ? undefined : decodeURIComponent(namespace)}
      name={decodeURIComponent(name)}
    />
  );
}
