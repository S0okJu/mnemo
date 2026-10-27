import { Suspense } from "react";
import { SubsystemPage } from "@/features/resource-explorer/components/SubsystemPage";
export default function NodePage() {
  return (
    <Suspense>
      <SubsystemPage
        breadcrumb={[{ label: "Kubernetes" }, { label: "Node" }]}
        subsystemId="node"
        kinds={[{ kind: "Node", listHref: "/kubernetes/node" }]}
      />
    </Suspense>
  );
}
