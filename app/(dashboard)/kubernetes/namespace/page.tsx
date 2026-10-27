import { Suspense } from "react";
import { SubsystemPage } from "@/features/resource-explorer/components/SubsystemPage";
export default function NamespacePage() {
  return (
    <Suspense>
      <SubsystemPage
        breadcrumb={[{ label: "Kubernetes" }, { label: "Namespace" }]}
        subsystemId="namespace"
        kinds={[{ kind: "Namespace", listHref: "/kubernetes/namespace" }]}
      />
    </Suspense>
  );
}
