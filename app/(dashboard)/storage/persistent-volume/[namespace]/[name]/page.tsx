import { ResourceDetailPage } from "@/features/resource-explorer/components/ResourceDetailPage";

export default async function PersistentVolumeDetailPage({
  params,
}: {
  params: Promise<{ namespace: string; name: string }>;
}) {
  const { namespace, name } = await params;

  return (
    <ResourceDetailPage
      kind="PersistentVolume"
      listHref="/storage/persistent-volume"
      breadcrumb={[
        { label: "Kubernetes" },
        { label: "Volumes", href: "/storage" },
        {
          label: "PersistentVolume",
          href: "/storage?tab=PersistentVolume",
        },
      ]}
      namespace={namespace === "_" ? undefined : decodeURIComponent(namespace)}
      name={decodeURIComponent(name)}
    />
  );
}
