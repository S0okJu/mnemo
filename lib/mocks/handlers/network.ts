import { statefulsets } from "@/lib/mocks/fixtures/statefulsets";
import { pods } from "@/lib/mocks/fixtures/pods";
import { createResourceHandlers } from "@/lib/mocks/handlers/create-resource-handlers";
import { services } from "@/lib/mocks/fixtures/services";
import { ingresses } from "@/lib/mocks/fixtures/ingresses";
import { networkpolicies } from "@/lib/mocks/fixtures/networkpolicies";
import type { ServiceResource } from "@/lib/resource-registry/kinds/service";
import type { IngressResource } from "@/lib/resource-registry/kinds/ingress";
import type { NetworkPolicyResource } from "@/lib/resource-registry/kinds/networkpolicy";

// Include backend Services referenced by the mock Ingress rules.
for (const ingress of ingresses) {
  for (const rule of ingress.spec?.rules ?? []) {
    const [name, port] = rule.backendService.split(":");
    if (
      !services.some(
        (service) =>
          service.metadata.name === name &&
          service.metadata.namespace === ingress.metadata.namespace,
      )
    ) {
      services.push({
        ...services[0],
        metadata: {
          ...ingress.metadata,
          name,
          uid: `service-${ingress.metadata.namespace}-${name}`,
        },
        spec: {
          ...services[0].spec!,
          ports: [
            {
              port: Number(port) || 80,
              targetPort: Number(port) || 80,
              protocol: "TCP",
            },
          ],
        },
        status: { level: "Healthy" },
      });
    }
  }
}

// Headless Services referenced by StatefulSets must also have detail data.
for (const statefulset of statefulsets) {
  const name = statefulset.spec?.serviceName;
  if (
    name &&
    !services.some(
      (service) =>
        service.metadata.name === name &&
        service.metadata.namespace === statefulset.metadata.namespace,
    )
  ) {
    services.push({
      kind: "Service",
      apiVersion: "v1",
      metadata: {
        ...statefulset.metadata,
        name,
        uid: `service-${statefulset.metadata.namespace}-${name}`,
      },
      spec: { type: "ClusterIP", clusterIP: "None", ports: [] },
      status: { level: "Healthy" },
    });
  }
}

export const serviceHandlers = createResourceHandlers<ServiceResource>({
  kindPath: "services",
  items: services,
  subContent: (resource) =>
    resource.status.level === "Healthy"
      ? ["10.244.1.12:8080", "10.244.2.9:8080"]
      : [],
});

export const ingressHandlers = createResourceHandlers<IngressResource>({
  kindPath: "ingresses",
  items: ingresses,
  subContent: (resource) =>
    resource.spec?.rules.map((rule) => rule.backendService) ?? [],
});

export const networkPolicyHandlers =
  createResourceHandlers<NetworkPolicyResource>({
    kindPath: "network-policies",
    items: networkpolicies,
    subContent: (resource) =>
      resource.spec?.ingressRules || resource.spec?.egressRules
        ? pods
            .filter(
              (pod) =>
                pod.metadata.namespace === resource.metadata.namespace &&
                Object.entries(pod.metadata.labels ?? {}).some(
                  ([key, value]) =>
                    `${key}=${value}` === resource.spec?.podSelector,
                ),
            )
            .map((pod) => pod.metadata.name)
        : [],
  });
