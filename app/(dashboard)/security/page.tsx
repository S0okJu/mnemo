import { Suspense } from "react";
import { SubsystemPage } from "@/features/resource-explorer/components/SubsystemPage";

export default function SecurityPage() {
  return (
    <Suspense>
      <SubsystemPage
        breadcrumb={[{ label: "Security & Governance" }, { label: "Kyverno" }]}
        subsystemId="kyverno"
        kinds={[
          { kind: "KyvernoPolicy", listHref: "/security/kyverno/policy" },
          {
            kind: "KyvernoPolicyReport",
            listHref: "/security/kyverno/policy-report",
          },
        ]}
      />
    </Suspense>
  );
}
