import { Suspense } from "react";
import { SubsystemPage } from "@/features/resource-explorer/components/SubsystemPage";

export default function RbacPage() {
  return (
    <Suspense>
      <SubsystemPage
        breadcrumb={[{ label: "Kubernetes" }, { label: "RBAC" }]}
        subsystemId="rbac"
        kinds={[
          { kind: "RbacRole", listHref: "/kubernetes/rbac/role" },
          {
            kind: "RbacRoleBinding",
            listHref: "/kubernetes/rbac/role-binding",
          },
          {
            kind: "RbacServiceAccount",
            listHref: "/kubernetes/rbac/service-account",
          },
        ]}
      />
    </Suspense>
  );
}
