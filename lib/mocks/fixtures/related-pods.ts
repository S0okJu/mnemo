import type { K8sResource } from "@/lib/api/types";
import { pods } from "@/lib/mocks/fixtures/pods";

/** Materialize generated owned pods so their detail links resolve in the mock API. */
export function ownedPodNames(
  resource: K8sResource<{ image?: string }, unknown>,
  count: number,
) {
  return Array.from({ length: count }, (_, i) => {
    const name = `${resource.metadata.name}-pod-${i}`;
    if (
      !pods.some(
        (pod) =>
          pod.metadata.name === name &&
          pod.metadata.namespace === resource.metadata.namespace,
      )
    ) {
      pods.push({
        ...pods[0],
        metadata: {
          ...resource.metadata,
          name,
          uid: `pod-${resource.metadata.namespace}-${name}`,
        },
        spec: {
          ...pods[0].spec!,
          image: resource.spec?.image ?? pods[0].spec!.image,
        },
        status: { level: "Healthy", phase: "Running", restarts: 0 },
      });
    }
    return name;
  });
}
