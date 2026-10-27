import { JSON_SCHEMA, load } from "js-yaml";
import type { ClusterAuthType, KubeconfigCheck } from "@/lib/api/types";

export const KUBECONFIG_MAX_BYTES = 1024 * 1024;

export interface KubeconfigContext {
  name: string;
  cluster: string;
  user: string;
  namespace?: string;
  server?: string;
  authType?: ClusterAuthType;
  checks: KubeconfigCheck[];
}

export interface KubeconfigPreview {
  contexts: KubeconfigContext[];
  currentContext?: string;
  /** Problems with the document as a whole, before a context is chosen. */
  errors: KubeconfigCheck[];
}

type Entry = Record<string, unknown>;

const asEntries = (value: unknown): Entry[] =>
  Array.isArray(value)
    ? value.filter((item): item is Entry => !!item && typeof item === "object")
    : [];
const field = (entry: Entry | undefined, key: string) =>
  entry?.[key] && typeof entry[key] === "object"
    ? (entry[key] as Entry)
    : undefined;
const text = (value: unknown) =>
  typeof value === "string" && value ? value : undefined;

function authType(user: Entry | undefined): ClusterAuthType | undefined {
  if (!user) return undefined;
  if (user.exec) return "exec";
  if (user["auth-provider"]) return "auth-provider";
  if (user["client-certificate-data"] || user["client-certificate"])
    return "client-certificate";
  if (user.token || user.tokenFile) return "token";
  if (user.username) return "basic";
  return undefined;
}

// Paths on the user's machine cannot be read by the server; data must be embedded.
const FILE_FIELDS: [scope: "cluster" | "user", key: string, label: string][] = [
  ["cluster", "certificate-authority", "certificate authority"],
  ["user", "client-certificate", "client certificate"],
  ["user", "client-key", "client key"],
  ["user", "tokenFile", "token"],
];

/**
 * Reads only names, server URLs, and auth kinds for a preview. Secret values are
 * never copied out of the parsed document.
 */
export function previewKubeconfig(source: string): KubeconfigPreview {
  const error = (id: string, message: string): KubeconfigPreview => ({
    contexts: [],
    errors: [{ id, level: "error", message }],
  });
  if (!source.trim()) return error("empty", "The kubeconfig is empty.");
  if (new Blob([source]).size > KUBECONFIG_MAX_BYTES)
    return error("size", "The kubeconfig is larger than 1 MiB.");
  let document: unknown;
  try {
    document = load(source, { schema: JSON_SCHEMA });
  } catch (cause) {
    const line = (cause as { mark?: { line?: number } }).mark?.line;
    return error(
      "yaml",
      `This is not valid YAML${line !== undefined ? ` (line ${line + 1})` : ""}.`,
    );
  }
  if (!document || typeof document !== "object" || Array.isArray(document))
    return error("shape", "The file is not a kubeconfig document.");
  const root = document as Entry;
  const clusters = new Map(
    asEntries(root.clusters).map((entry) => [
      text(entry.name) ?? "",
      field(entry, "cluster"),
    ]),
  );
  const users = new Map(
    asEntries(root.users).map((entry) => [
      text(entry.name) ?? "",
      field(entry, "user"),
    ]),
  );
  const contexts = asEntries(root.contexts).map((entry) => {
    const context = field(entry, "context");
    const clusterName = text(context?.cluster) ?? "";
    const userName = text(context?.user) ?? "";
    const cluster = clusters.get(clusterName);
    const user = users.get(userName);
    const checks: KubeconfigCheck[] = [];
    if (!cluster)
      checks.push({
        id: "cluster-ref",
        level: "error",
        message: `Context refers to cluster “${clusterName || "—"}”, which is not defined.`,
      });
    else if (!text(cluster.server))
      checks.push({
        id: "server",
        level: "error",
        message: "The cluster has no server URL.",
      });
    if (!user)
      checks.push({
        id: "user-ref",
        level: "error",
        message: `Context refers to user “${userName || "—"}”, which is not defined.`,
      });
    for (const [scope, key, label] of FILE_FIELDS) {
      const value = (scope === "cluster" ? cluster : user)?.[key];
      if (text(value))
        checks.push({
          id: `file-${key}`,
          level: "error",
          message: `The ${label} is a file path on your machine. Embed it with \`kubectl config view --flatten --minify\`.`,
        });
    }
    const auth = authType(user);
    if (auth === "exec" || auth === "auth-provider")
      checks.push({
        id: "plugin-auth",
        level: "warning",
        message: `${auth === "exec" ? "Exec" : "Auth-provider"} credentials run a plugin on the server. The server must allow and provide it.`,
      });
    if (cluster?.["insecure-skip-tls-verify"] === true)
      checks.push({
        id: "insecure",
        level: "warning",
        message: "TLS verification is disabled for this cluster.",
      });
    const server = text(cluster?.server);
    if (server?.startsWith("http://"))
      checks.push({
        id: "plain-http",
        level: "warning",
        message: "The server URL uses plain HTTP.",
      });
    if (user && !auth)
      checks.push({
        id: "no-credentials",
        level: "warning",
        message: "The user has no recognized credentials.",
      });
    return {
      name: text(entry.name) ?? "",
      cluster: clusterName,
      user: userName,
      namespace: text(context?.namespace),
      server,
      authType: auth,
      checks,
    };
  });
  return {
    contexts: contexts.filter((context) => context.name),
    currentContext: text(root["current-context"]),
    errors: contexts.length
      ? []
      : [
          {
            id: "contexts",
            level: "error",
            message: "The kubeconfig defines no contexts.",
          },
        ],
  };
}

export const AUTH_LABELS: Record<ClusterAuthType, string> = {
  token: "Bearer token",
  "client-certificate": "Client certificate",
  exec: "Exec plugin",
  "auth-provider": "Auth provider",
  basic: "Username and password",
};
