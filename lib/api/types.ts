export type ResourceStatusLevel =
  "Healthy" | "Progressing" | "Warning" | "Error" | "Unknown";

export interface ResourceCondition {
  type: string;
  status: string;
  reason?: string;
}

export interface ResourceStatus {
  level: ResourceStatusLevel;
  message?: string;
  conditions?: ResourceCondition[];
}

export interface ResourceMeta {
  name: string;
  namespace?: string;
  uid: string;
  createdAt: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export interface K8sResource<
  TSpec = unknown,
  TStatusExtra = Record<string, unknown>,
> {
  kind: string;
  apiVersion?: string;
  metadata: ResourceMeta;
  spec?: TSpec;
  status: ResourceStatus & TStatusExtra;
}

export interface ResourceList<T> {
  items: T[];
  total: number;
}

export interface ResourceListFilters {
  namespace?: string;
  search?: string;
  [key: string]: string | undefined;
}

export type ClusterAuthType =
  "token" | "client-certificate" | "exec" | "auth-provider" | "basic";

/** The dashboard's cluster connection. Never contains credentials. */
export interface ClusterConnection {
  configured: boolean;
  source: "kubeconfig" | "in-cluster" | "mock";
  context?: string;
  cluster?: string;
  server?: string;
  user?: string;
  authType?: ClusterAuthType;
  namespace?: string;
  version?: string;
  status: "connected" | "unreachable" | "unauthorized" | "not-configured";
  message?: string;
  checkedAt?: string;
}

export interface KubeconfigCheck {
  id: string;
  level: "ok" | "info" | "warning" | "error";
  message: string;
}

export interface KubeconfigValidation {
  ok: boolean;
  version?: string;
  checks: KubeconfigCheck[];
}

export interface KubeconfigSubmission {
  kubeconfig: string;
  context?: string;
  namespace?: string;
}
