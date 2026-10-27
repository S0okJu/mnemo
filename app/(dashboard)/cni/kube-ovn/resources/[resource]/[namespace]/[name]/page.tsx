import { notFound } from "next/navigation";
import {
  kubeOvnPlugin,
  kubeOvnLabel,
  kubeOvnResourceHref,
  kubeOvnSectionOf,
} from "@/features/plugins/registry/kube-ovn";
import { ResourceDetailPage } from "@/features/resource-explorer/components/ResourceDetailPage";
import { KubeOvnResourceGate } from "@/features/plugins/components/KubeOvnSection";
export default async function KubeOvnDetailPage({
  params,
}: {
  params: Promise<{ resource: string; namespace: string; name: string }>;
}) {
  const { resource, namespace, name } = await params;
  const definition = kubeOvnPlugin.resources.find(
    (entry) => entry.slug === resource,
  );
  if (!definition || (definition.scope === "Cluster" && namespace !== "_"))
    notFound();
  const section = kubeOvnSectionOf(definition.kind)!;
  const listHref = kubeOvnResourceHref(definition.kind)!;
  return (
    <KubeOvnResourceGate kind={definition.kind}>
      <ResourceDetailPage
        kind={definition.kind}
        listHref={listHref}
        namespace={namespace === "_" ? undefined : namespace}
        name={name}
        breadcrumb={[
          { label: "CNI" },
          { label: "Kube-OVN", href: kubeOvnPlugin.basePath },
          { label: section.label },
          { label: kubeOvnLabel(definition.kind), href: listHref },
        ]}
      />
    </KubeOvnResourceGate>
  );
}
