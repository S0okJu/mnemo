"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiSend, ApiError } from "@/lib/api/client";
import type {
  ClusterConnection,
  KubeconfigSubmission,
  KubeconfigValidation,
} from "@/lib/api/types";

export const clusterConnectionKey = ["cluster", "connection"];

export function useClusterConnection() {
  return useQuery({
    queryKey: clusterConnectionKey,
    queryFn: () => apiFetch<ClusterConnection>("/cluster/connection"),
    refetchInterval: 30000,
    retry: false,
  });
}

/** Human message for a failed save, by HTTP status. */
export function saveErrorMessage(error: unknown) {
  const status = error instanceof ApiError ? error.status : undefined;
  if (status === 400)
    return "The kubeconfig failed validation. Review the checks above.";
  if (status === 401 || status === 403)
    return "The cluster rejected these credentials.";
  if (status === 422)
    return "This authentication method is not supported by the server.";
  if (status === 502 || status === 504)
    return "The cluster could not be reached from the server.";
  return "The kubeconfig could not be saved. Try again.";
}

export function useClusterConnectionActions() {
  const queryClient = useQueryClient();
  // Every cached resource belongs to the previous connection once it changes.
  function reset(connection: ClusterConnection) {
    queryClient.setQueryData(clusterConnectionKey, connection);
    void queryClient.resetQueries({
      predicate: (query) => query.queryKey[0] !== clusterConnectionKey[0],
    });
  }
  return {
    validate: useMutation({
      mutationFn: (submission: KubeconfigSubmission) =>
        apiSend<KubeconfigValidation>(
          "/cluster/kubeconfig/validate",
          "POST",
          submission,
        ),
    }),
    save: useMutation({
      mutationFn: (submission: KubeconfigSubmission) =>
        apiSend<ClusterConnection>("/cluster/kubeconfig", "PUT", submission),
      onSuccess: reset,
    }),
    test: useMutation({
      mutationFn: () =>
        apiSend<ClusterConnection>("/cluster/connection/test", "POST"),
      onSuccess: (connection) =>
        queryClient.setQueryData(clusterConnectionKey, connection),
    }),
    disconnect: useMutation({
      mutationFn: () => apiSend<void>("/cluster/kubeconfig", "DELETE"),
      onSuccess: () =>
        reset({
          configured: false,
          source: "kubeconfig",
          status: "not-configured",
        }),
    }),
  };
}
