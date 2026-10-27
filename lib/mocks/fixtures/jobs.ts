import type { JobResource } from "@/lib/resource-registry/kinds/job";
import { uid, daysAgo, hoursAgo } from "@/lib/mocks/fixtures/helpers";

export const jobs: JobResource[] = [
  {
    kind: "Job",
    apiVersion: "batch/v1",
    metadata: {
      name: "db-migrate-20260125",
      namespace: "mnemo-system",
      uid: uid("job"),
      createdAt: hoursAgo(2),
      labels: { app: "db-migrate" },
    },
    spec: {
      image: "ghcr.io/mnemo/db-migrate:1.0.3",
      completions: 1,
      parallelism: 1,
    },
    status: { level: "Healthy", active: 0, succeeded: 1, failed: 0 },
  },
  {
    kind: "Job",
    apiVersion: "batch/v1",
    metadata: {
      name: "nightly-report-20260125",
      namespace: "default",
      uid: uid("job"),
      createdAt: hoursAgo(10),
      labels: { app: "nightly-report" },
    },
    spec: {
      image: "ghcr.io/acme/nightly-report:2.1.0",
      completions: 1,
      parallelism: 1,
    },
    status: { level: "Progressing", active: 1, succeeded: 0, failed: 0 },
  },
  {
    kind: "Job",
    apiVersion: "batch/v1",
    metadata: {
      name: "backup-cleanup-20260124",
      namespace: "default",
      uid: uid("job"),
      createdAt: daysAgo(1),
      labels: { app: "backup-cleanup" },
    },
    spec: {
      image: "ghcr.io/acme/backup-cleanup:0.5.2",
      completions: 3,
      parallelism: 1,
    },
    status: { level: "Error", active: 0, succeeded: 1, failed: 2 },
  },
  {
    kind: "Job",
    apiVersion: "batch/v1",
    metadata: {
      name: "image-resize-batch-14",
      namespace: "default",
      uid: uid("job"),
      createdAt: daysAgo(3),
      labels: { app: "image-resize-batch" },
    },
    spec: {
      image: "ghcr.io/acme/image-resize:1.2.0",
      completions: 10,
      parallelism: 3,
    },
    status: { level: "Healthy", active: 0, succeeded: 10, failed: 0 },
  },
];
