import { AlertCircle, ShieldAlert } from "lucide-react";
import { ApiError } from "@/lib/api/client";
import { EmptyState } from "./EmptyState";
import { Button } from "@/components/ui/button";
export function QueryError({
  error,
  onRetry,
  subject = "resources",
}: {
  error: unknown;
  onRetry: () => unknown;
  subject?: string;
}) {
  const denied = error instanceof ApiError && error.status === 403;
  const missing = error instanceof ApiError && error.status === 404;
  return (
    <div role="alert" className="space-y-3 py-4">
      <EmptyState
        icon={denied ? ShieldAlert : AlertCircle}
        title={
          denied
            ? "Access denied"
            : missing
              ? "Resource not found"
              : `Unable to load ${subject}`
        }
        description={
          denied
            ? "You do not have permission to view this data."
            : missing
              ? "This resource may have been removed or is unavailable."
              : "Check the cluster connection and try again."
        }
      />
      <div className="text-center">
        <Button variant="outline" size="sm" onClick={() => onRetry()}>
          Retry
        </Button>
      </div>
    </div>
  );
}
