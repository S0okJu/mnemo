import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { DetailSection } from "@/features/resource-explorer/components/DetailSection";

export function AutoFetchedPanel({
  label,
  isLoading,
  children,
  errorMessage,
  onRetry,
}: {
  label: string;
  isLoading: boolean;
  children: ReactNode;
  errorMessage?: string;
  onRetry?: () => unknown;
}) {
  return (
    <DetailSection title={label}>
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-5/6" />
          <Skeleton className="h-3.5 w-2/3" />
        </div>
      ) : errorMessage ? (
        <div role="alert" className="space-y-3">
          <p className="text-destructive text-sm">{errorMessage}</p>
          {onRetry && (
            <Button variant="outline" size="sm" onClick={() => onRetry()}>
              Retry
            </Button>
          )}
        </div>
      ) : (
        children
      )}
    </DetailSection>
  );
}
