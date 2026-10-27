import type { CronJobResource } from "@/lib/resource-registry/kinds/cronjob";
import { uid, daysAgo, hoursAgo } from "@/lib/mocks/fixtures/helpers";

export const cronjobs: CronJobResource[] = [
  {
    kind: "CronJob",
    apiVersion: "batch/v1",
    metadata: {
      name: "nightly-report",
      namespace: "default",
      uid: uid("cj"),
      createdAt: daysAgo(90),
      labels: { app: "nightly-report" },
    },
    spec: {
      schedule: "0 2 * * *",
      image: "ghcr.io/acme/nightly-report:2.1.0",
      suspend: false,
    },
    status: { level: "Healthy" },
  },
  {
    kind: "CronJob",
    apiVersion: "batch/v1",
    metadata: {
      name: "backup-cleanup",
      namespace: "default",
      uid: uid("cj"),
      createdAt: daysAgo(120),
      labels: { app: "backup-cleanup" },
    },
    spec: {
      schedule: "0 3 * * 0",
      image: "ghcr.io/acme/backup-cleanup:0.5.2",
      suspend: false,
    },
    status: { level: "Warning", message: "Last run failed 2 of 3 completions" },
  },
  {
    kind: "CronJob",
    apiVersion: "batch/v1",
    metadata: {
      name: "db-migrate",
      namespace: "mnemo-system",
      uid: uid("cj"),
      createdAt: hoursAgo(2),
      labels: { app: "db-migrate" },
    },
    spec: {
      schedule: "@every 6h",
      image: "ghcr.io/mnemo/db-migrate:1.0.3",
      suspend: false,
    },
    status: { level: "Healthy" },
  },
  {
    kind: "CronJob",
    apiVersion: "batch/v1",
    metadata: {
      name: "legacy-report-archive",
      namespace: "default",
      uid: uid("cj"),
      createdAt: daysAgo(200),
      labels: { app: "legacy-report-archive", deprecated: "true" },
    },
    spec: {
      schedule: "0 0 1 * *",
      image: "internal/legacy-archive:0.3.1",
      suspend: true,
    },
    status: { level: "Unknown", message: "Suspended" },
  },
];
