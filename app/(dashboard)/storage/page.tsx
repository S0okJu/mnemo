import { Suspense } from "react";
import { SubsystemPage } from "@/features/resource-explorer/components/SubsystemPage";

export default function StoragePage() {
  return (
    <Suspense>
      <SubsystemPage
        breadcrumb={[{ label: "Kubernetes" }, { label: "Volumes" }]}
        subsystemId="storage"
        kinds={[
          {
            kind: "PersistentVolume",
            listHref: "/storage/persistent-volume",
          },
          {
            kind: "PersistentVolumeClaim",
            listHref: "/storage/persistent-volume-claim",
          },
        ]}
      />
    </Suspense>
  );
}
