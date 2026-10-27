import { ownedPodNames } from "@/lib/mocks/fixtures/related-pods";
import { createResourceHandlers } from "@/lib/mocks/handlers/create-resource-handlers";
import { daemonsets } from "@/lib/mocks/fixtures/daemonsets";
import { statefulsets } from "@/lib/mocks/fixtures/statefulsets";
import { pods } from "@/lib/mocks/fixtures/pods";
import { replicasets } from "@/lib/mocks/fixtures/replicasets";
import { jobs } from "@/lib/mocks/fixtures/jobs";
import { cronjobs } from "@/lib/mocks/fixtures/cronjobs";
import type { DaemonSetResource } from "@/lib/resource-registry/kinds/daemonset";
import type { StatefulSetResource } from "@/lib/resource-registry/kinds/statefulset";
import type { PodResource } from "@/lib/resource-registry/kinds/pod";
import type { ReplicaSetResource } from "@/lib/resource-registry/kinds/replicaset";
import type { JobResource } from "@/lib/resource-registry/kinds/job";
import type { CronJobResource } from "@/lib/resource-registry/kinds/cronjob";

export const daemonSetHandlers = createResourceHandlers<DaemonSetResource>({
  kindPath: "daemonsets",
  items: daemonsets,
  subContent: (resource) => ({
    pods: ownedPodNames(resource, resource.status.ready),
    events: [
      { message: "Scheduled on all matching nodes", time: "3h ago" },
      { message: "Image pulled successfully", time: "3h ago" },
    ],
  }),
});

export const statefulSetHandlers = createResourceHandlers<StatefulSetResource>({
  kindPath: "statefulsets",
  items: statefulsets,
  subContent: (resource) => ({
    pods: ownedPodNames(resource, resource.status.readyReplicas),
    events: [
      { message: "Ordinal pod-0 ready", time: "1h ago" },
      { message: "Ordinal pod-1 ready", time: "1h ago" },
    ],
  }),
});

export const podHandlers = createResourceHandlers<PodResource>({
  kindPath: "pods",
  items: pods,
  subContent: () => [
    { message: "Container started", time: "10m ago" },
    { message: "Readiness probe passed", time: "9m ago" },
  ],
});

export const replicaSetHandlers = createResourceHandlers<ReplicaSetResource>({
  kindPath: "replicasets",
  items: replicasets,
  subContent: (resource) =>
    ownedPodNames(resource, resource.status.readyReplicas),
});

export const jobHandlers = createResourceHandlers<JobResource>({
  kindPath: "jobs",
  items: jobs,
  subContent: (resource) =>
    ownedPodNames(resource, resource.status.succeeded + resource.status.active),
});

export const cronJobHandlers = createResourceHandlers<CronJobResource>({
  kindPath: "cronjobs",
  items: cronjobs,
  subContent: (resource) =>
    jobs
      .filter(
        (job) =>
          job.metadata.namespace === resource.metadata.namespace &&
          job.metadata.labels?.app === resource.metadata.labels?.app,
      )
      .map((job) => ({
        name: job.metadata.name,
        time: job.metadata.createdAt,
      })),
});
