import { apiFetch } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import { resourceApiPaths } from "@/lib/resource-registry/resource-paths";
import type { ResourceEvent } from "@/lib/resource-registry/types";
import { kubeOvnResourceTypes } from "@/lib/resource-registry/kinds/kube-ovn";
import { nodeResourceType } from "@/lib/resource-registry/kinds/node";
import { namespaceResourceType } from "@/lib/resource-registry/kinds/namespace";
import type { ResourceTypeDefinition } from "@/lib/resource-registry/types";
import { deploymentResourceType } from "@/lib/resource-registry/kinds/deployment";
import { daemonSetResourceType } from "@/lib/resource-registry/kinds/daemonset";
import { statefulSetResourceType } from "@/lib/resource-registry/kinds/statefulset";
import { podResourceType } from "@/lib/resource-registry/kinds/pod";
import { replicaSetResourceType } from "@/lib/resource-registry/kinds/replicaset";
import { jobResourceType } from "@/lib/resource-registry/kinds/job";
import { cronJobResourceType } from "@/lib/resource-registry/kinds/cronjob";
import { serviceResourceType } from "@/lib/resource-registry/kinds/service";
import { ingressResourceType } from "@/lib/resource-registry/kinds/ingress";
import { networkPolicyResourceType } from "@/lib/resource-registry/kinds/networkpolicy";
import { configMapResourceType } from "@/lib/resource-registry/kinds/configmap";
import { secretResourceType } from "@/lib/resource-registry/kinds/secret";
import { persistentVolumeResourceType } from "@/lib/resource-registry/kinds/persistentvolume";
import { persistentVolumeClaimResourceType } from "@/lib/resource-registry/kinds/persistentvolumeclaim";
import { kyvernoPolicyResourceType } from "@/lib/resource-registry/kinds/kyverno-policy";
import { kyvernoPolicyReportResourceType } from "@/lib/resource-registry/kinds/kyverno-policy-report";
import { rbacRoleResourceType } from "@/lib/resource-registry/kinds/rbac-role";
import { rbacRoleBindingResourceType } from "@/lib/resource-registry/kinds/rbac-role-binding";
import { rbacServiceAccountResourceType } from "@/lib/resource-registry/kinds/rbac-service-account";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const resourceRegistry: Record<string, ResourceTypeDefinition<any>> = {
  ...kubeOvnResourceTypes,
  Node: nodeResourceType,
  Namespace: namespaceResourceType,
  [deploymentResourceType.kind]: deploymentResourceType,
  [daemonSetResourceType.kind]: daemonSetResourceType,
  [statefulSetResourceType.kind]: statefulSetResourceType,
  [podResourceType.kind]: podResourceType,
  [replicaSetResourceType.kind]: replicaSetResourceType,
  [jobResourceType.kind]: jobResourceType,
  [cronJobResourceType.kind]: cronJobResourceType,
  [serviceResourceType.kind]: serviceResourceType,
  [ingressResourceType.kind]: ingressResourceType,
  [networkPolicyResourceType.kind]: networkPolicyResourceType,
  [configMapResourceType.kind]: configMapResourceType,
  [secretResourceType.kind]: secretResourceType,
  [persistentVolumeResourceType.kind]: persistentVolumeResourceType,
  [persistentVolumeClaimResourceType.kind]: persistentVolumeClaimResourceType,
  [kyvernoPolicyResourceType.kind]: kyvernoPolicyResourceType,
  [kyvernoPolicyReportResourceType.kind]: kyvernoPolicyReportResourceType,
  [rbacRoleResourceType.kind]: rbacRoleResourceType,
  [rbacRoleBindingResourceType.kind]: rbacRoleBindingResourceType,
  [rbacServiceAccountResourceType.kind]: rbacServiceAccountResourceType,
};

for (const [kind, definition] of Object.entries(resourceRegistry)) {
  const path = resourceApiPaths[kind];
  if (path)
    definition.fetchEvents = (namespace, name) =>
      apiFetch<ResourceEvent[]>(
        endpoints.subContent(path, namespace, name, "events"),
      );
}

export function getResourceType(kind: string) {
  const entry = resourceRegistry[kind];
  if (!entry) {
    throw new Error(`Unknown resource kind: ${kind}`);
  }
  return entry;
}
