import { ownedPodNames } from "@/lib/mocks/fixtures/related-pods";
import { createResourceHandlers } from "@/lib/mocks/handlers/create-resource-handlers";
import { persistentvolumes } from "@/lib/mocks/fixtures/persistentvolumes";
import { persistentvolumeclaims } from "@/lib/mocks/fixtures/persistentvolumeclaims";
import type { PersistentVolumeResource } from "@/lib/resource-registry/kinds/persistentvolume";
import type { PersistentVolumeClaimResource } from "@/lib/resource-registry/kinds/persistentvolumeclaim";

export const persistentVolumeHandlers =
  createResourceHandlers<PersistentVolumeResource>({
    kindPath: "persistent-volumes",
    items: persistentvolumes,
    subContent: (resource) =>
      resource.status.level === "Healthy"
        ? (() => {
            const claim = persistentvolumeclaims.find(
              (claim) =>
                claim.metadata.name ===
                resource.metadata.name
                  .replace("pv-", "")
                  .replace(/-(\d+)$/, "-data-$1"),
            );
            return claim
              ? `${claim.metadata.namespace}/${claim.metadata.name}`
              : null;
          })()
        : null,
  });

export const persistentVolumeClaimHandlers =
  createResourceHandlers<PersistentVolumeClaimResource>({
    kindPath: "persistent-volume-claims",
    items: persistentvolumeclaims,
    subContent: (resource) =>
      resource.status.level === "Healthy"
        ? ownedPodNames({ ...resource, spec: undefined }, 1)
        : [],
  });
