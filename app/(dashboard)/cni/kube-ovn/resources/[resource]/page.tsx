import { Suspense } from "react";
import { notFound } from "next/navigation";
import { kubeOvnPlugin } from "@/features/plugins/registry/kube-ovn";
import { KubeOvnResourceGate } from "@/features/plugins/components/KubeOvnSection";
import { SubsystemPage } from "@/features/resource-explorer/components/SubsystemPage";

export default async function KubeOvnResourceListPage({
  params,
}: {
  params: Promise<{ resource: string }>;
}) {
  const { resource } = await params;
  const definition = kubeOvnPlugin.resources.find(
    (entry) => entry.slug === resource,
  );
  if (!definition) notFound();
  return (
    <KubeOvnResourceGate kind={definition.kind}>
      <Suspense>
        <SubsystemPage
          showHeader={false}
          subsystemId={kubeOvnPlugin.id}
          breadcrumb={[]}
          kinds={[
            {
              kind: definition.kind,
              listHref: `${kubeOvnPlugin.basePath}/resources/${definition.slug}`,
            },
          ]}
        />
      </Suspense>
    </KubeOvnResourceGate>
  );
}
