import { http, HttpResponse } from "msw";
import type {
  ClusterConnection,
  KubeconfigCheck,
  KubeconfigSubmission,
  KubeconfigValidation,
} from "@/lib/api/types";
import { previewKubeconfig } from "@/features/settings/lib/kubeconfig";

const DEMO: ClusterConnection = {
  configured: true,
  source: "mock",
  context: "mnemo-demo",
  cluster: "mnemo-demo",
  server: "https://demo.mnemo.local:6443",
  user: "mnemo-reader",
  authType: "token",
  namespace: "default",
  version: "v1.31.2",
  status: "connected",
  checkedAt: new Date().toISOString(),
};

let connection: ClusterConnection = { ...DEMO };

/** Mirrors the server's checks: structure first, then a simulated reachability probe. */
function validate({ kubeconfig, context }: KubeconfigSubmission) {
  const preview = previewKubeconfig(kubeconfig);
  const selected =
    preview.contexts.find(
      (entry) => entry.name === (context ?? preview.currentContext),
    ) ?? preview.contexts[0];
  const checks: KubeconfigCheck[] = [
    ...preview.errors,
    ...(selected?.checks ?? []),
  ];
  const unreachable =
    !!selected &&
    (selected.name.includes("unreachable") ||
      !!selected.server?.includes("unreachable"));
  if (selected && !checks.some((check) => check.level === "error")) {
    checks.push(
      unreachable
        ? {
            id: "reach",
            level: "error",
            message: `Could not reach ${selected.server} within 5 seconds.`,
          }
        : {
            id: "reach",
            level: "ok",
            message: `Reached ${selected.server} and authenticated.`,
          },
    );
    if (!unreachable)
      checks.push({
        id: "rbac",
        level: "ok",
        message: "The credentials can list nodes, namespaces, and workloads.",
      });
  }
  return { preview, selected, checks, unreachable };
}

export const settingsHandlers = [
  http.get("/api/v1/cluster/connection", () => HttpResponse.json(connection)),
  http.post("/api/v1/cluster/connection/test", () => {
    connection = { ...connection, checkedAt: new Date().toISOString() };
    return HttpResponse.json(connection);
  }),
  http.post("/api/v1/cluster/kubeconfig/validate", async ({ request }) => {
    // A validation result is a 200 even when checks fail; only malformed requests error.
    const { checks } = validate((await request.json()) as KubeconfigSubmission);
    const ok = !checks.some((check) => check.level === "error");
    const body: KubeconfigValidation = {
      ok,
      version: ok ? "v1.31.2" : undefined,
      checks,
    };
    return HttpResponse.json(body);
  }),
  http.put("/api/v1/cluster/kubeconfig", async ({ request }) => {
    const submission = (await request.json()) as KubeconfigSubmission;
    const { selected, checks, unreachable } = validate(submission);
    if (!selected || checks.some((check) => check.level === "error"))
      return HttpResponse.json(
        { message: "The kubeconfig failed validation.", checks },
        { status: unreachable ? 502 : 400 },
      );
    connection = {
      configured: true,
      source: "kubeconfig",
      context: selected.name,
      cluster: selected.cluster,
      server: selected.server,
      user: selected.user,
      authType: selected.authType,
      namespace: submission.namespace || selected.namespace,
      version: "v1.31.2",
      status: "connected",
      checkedAt: new Date().toISOString(),
    };
    return HttpResponse.json(connection);
  }),
  http.delete("/api/v1/cluster/kubeconfig", () => {
    connection = {
      configured: false,
      source: "kubeconfig",
      status: "not-configured",
    };
    return new HttpResponse(null, { status: 204 });
  }),
];
