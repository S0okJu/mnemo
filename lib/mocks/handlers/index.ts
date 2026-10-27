import { kubeOvnHandlers } from "@/lib/mocks/handlers/kube-ovn";
import { deploymentHandlers } from "@/lib/mocks/handlers/deployment";
import {
  daemonSetHandlers,
  statefulSetHandlers,
  podHandlers,
  replicaSetHandlers,
  jobHandlers,
  cronJobHandlers,
} from "@/lib/mocks/handlers/workload";
import {
  serviceHandlers,
  ingressHandlers,
  networkPolicyHandlers,
} from "@/lib/mocks/handlers/network";
import { configMapHandlers, secretHandlers } from "@/lib/mocks/handlers/config";
import {
  persistentVolumeHandlers,
  persistentVolumeClaimHandlers,
} from "@/lib/mocks/handlers/storage";
import {
  kyvernoPolicyHandlers,
  kyvernoPolicyReportHandlers,
} from "@/lib/mocks/handlers/kyverno";
import {
  rbacRoleHandlers,
  rbacRoleBindingHandlers,
  rbacServiceAccountHandlers,
} from "@/lib/mocks/handlers/rbac";

import { nodeHandlers, namespaceHandlers } from "@/lib/mocks/handlers/cluster";
import { settingsHandlers } from "@/lib/mocks/handlers/settings";

export const handlers = [
  ...settingsHandlers,
  ...kubeOvnHandlers,
  ...nodeHandlers,
  ...namespaceHandlers,
  ...deploymentHandlers,
  ...daemonSetHandlers,
  ...statefulSetHandlers,
  ...podHandlers,
  ...replicaSetHandlers,
  ...jobHandlers,
  ...cronJobHandlers,
  ...serviceHandlers,
  ...ingressHandlers,
  ...networkPolicyHandlers,
  ...configMapHandlers,
  ...secretHandlers,
  ...persistentVolumeHandlers,
  ...persistentVolumeClaimHandlers,
  ...kyvernoPolicyHandlers,
  ...kyvernoPolicyReportHandlers,
  ...rbacRoleHandlers,
  ...rbacRoleBindingHandlers,
  ...rbacServiceAccountHandlers,
];
