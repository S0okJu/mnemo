import { Suspense } from "react";
import { SubsystemPage } from "@/features/resource-explorer/components/SubsystemPage";

export default function ConfigPage() {
  return (
    <Suspense>
      <SubsystemPage
        breadcrumb={[{ label: "Kubernetes" }, { label: "Config" }]}
        subsystemId="config"
        kinds={[
          { kind: "ConfigMap", listHref: "/kubernetes/config/configmap" },
          { kind: "Secret", listHref: "/kubernetes/config/secret" },
        ]}
      />
    </Suspense>
  );
}
