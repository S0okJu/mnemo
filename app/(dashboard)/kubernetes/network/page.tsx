import { Suspense } from "react";
import { SubsystemPage } from "@/features/resource-explorer/components/SubsystemPage";

export default function NetworkPage() {
  return (
    <Suspense>
      <SubsystemPage
        breadcrumb={[{ label: "Kubernetes" }, { label: "Kubernetes Network" }]}
        subsystemId="service"
        kinds={[
          { kind: "Service", listHref: "/kubernetes/network/service" },
          { kind: "Ingress", listHref: "/kubernetes/network/ingress" },
          {
            kind: "NetworkPolicy",
            listHref: "/kubernetes/network/networkpolicy",
          },
        ]}
      />
    </Suspense>
  );
}
