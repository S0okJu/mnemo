import { Suspense } from "react";
import { SubsystemPage } from "@/features/resource-explorer/components/SubsystemPage";

export default function WorkloadPage() {
  return (
    <Suspense>
      <SubsystemPage
        breadcrumb={[{ label: "Kubernetes" }, { label: "Workloads" }]}
        subsystemId="workload"
        kinds={[
          {
            kind: "Deployment",
            listHref: "/kubernetes/workload/deployment",
          },
          {
            kind: "DaemonSet",
            listHref: "/kubernetes/workload/daemonset",
          },
          {
            kind: "StatefulSet",
            listHref: "/kubernetes/workload/statefulset",
          },
          {
            kind: "Pod",
            listHref: "/kubernetes/workload/pod",
          },
          {
            kind: "ReplicaSet",
            listHref: "/kubernetes/workload/replicaset",
          },
          { kind: "Job", listHref: "/kubernetes/workload/job" },
          {
            kind: "CronJob",
            listHref: "/kubernetes/workload/cronjob",
          },
        ]}
      />
    </Suspense>
  );
}
