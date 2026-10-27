"use client";

import { Fragment, Suspense, useId } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { buttonVariants } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { formatAge } from "@/lib/utils/format";
import { getResourceType } from "@/lib/resource-registry/registry";
import { useResourceDetail } from "@/features/resource-explorer/hooks/useResourceDetail";
import { useUrlState } from "@/features/resource-explorer/hooks/useUrlState";
import { safeReturnTo } from "@/features/resource-explorer/lib/list-state";
import { LocalMenu } from "./LocalMenu";
import { componentNavigation, componentMenu } from "../registry/navigation";
import { RelatedErrorContext, RelatedNamespaceContext } from "./related-panel";
import { ResourceLink } from "./ResourceLink";
import { ResourceReturnContext } from "./ResourceNavigation";
import { StatusBadge } from "./StatusBadge";
import { QueryError } from "./QueryError";
import { ResourceEvents, resourceEventsKey } from "./ResourceEvents";
import { ResourceYaml } from "./ResourceYaml";
import { BreadcrumbHeader, type BreadcrumbSegment } from "./BreadcrumbHeader";
import { PageHeader } from "./PageHeader";
import { CopyButton } from "./CopyButton";
import { CountBadge } from "./CountBadge";

interface Props {
  kind: string;
  listHref: string;
  breadcrumb: BreadcrumbSegment[];
  namespace: string | undefined;
  name: string;
}
function DetailSkeleton() {
  return (
    <div role="status" className="space-y-6">
      <span className="sr-only">Loading resource</span>
      <div className="space-y-2">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}
/** Event totals for the tab label; shares the Events tab's cached query. */
function useEventSummary(
  kind: string,
  namespace: string | undefined,
  name: string,
) {
  const definition = getResourceType(kind);
  const query = useQuery({
    queryKey: resourceEventsKey(kind, namespace, name),
    queryFn: () => definition.fetchEvents!(namespace, name),
    enabled: !!definition.fetchEvents,
    refetchInterval: 10000,
    retry: false,
  });
  if (!query.data) return undefined;
  return {
    total: query.data.length,
    warnings: query.data.filter((event) => event.type === "Warning").length,
  };
}
function ResourceDetailContent({
  kind,
  listHref,
  breadcrumb,
  namespace,
  name,
}: Props) {
  const { searchParams, update } = useUrlState();
  const eventsCountId = useId();
  const eventSummary = useEventSummary(kind, namespace, name);
  const requestedTab = searchParams.get("tab");
  const tab =
    requestedTab === "events" || requestedTab === "yaml"
      ? requestedTab
      : "overview";
  const component = componentNavigation.find((entry) =>
    entry.features.some(([featureKind]) => featureKind === kind),
  );
  const returnTo = safeReturnTo(searchParams.get("returnTo")) ?? listHref;
  const {
    resourceType,
    resource,
    isLoading,
    isError,
    error,
    refetch,
    subContent,
    isLoadingSub,
    isErrorSub,
    subError,
    refetchSub,
  } = useResourceDetail(kind, namespace, name, tab === "overview");
  const segments = breadcrumb.map((segment, index) =>
    index === breadcrumb.length - 1 && segment.href
      ? { ...segment, href: returnTo }
      : segment,
  );
  const facts = resource
    ? [
        { label: "Kind", value: resourceType.label },
        ...(resource.metadata.namespace
          ? [
              {
                label: "Namespace",
                value: (
                  <ResourceLink
                    kind="Namespace"
                    name={resource.metadata.namespace}
                  />
                ),
              },
            ]
          : []),
        {
          label: "Created",
          value: (
            <time
              dateTime={resource.metadata.createdAt}
              title={new Date(resource.metadata.createdAt).toLocaleString()}
            >
              {formatAge(resource.metadata.createdAt)} ago
            </time>
          ),
        },
        ...(resourceType.headerFacts?.(resource) ?? []).filter(
          (fact) =>
            fact.value !== undefined &&
            fact.value !== null &&
            fact.value !== "",
        ),
      ]
    : [];
  return (
    <ResourceReturnContext.Provider value={returnTo}>
      <div className="flex h-full flex-col overflow-hidden">
        <div className="flex shrink-0 items-center gap-2 border-b px-4 py-3">
          <SidebarTrigger />
          <Link
            href={returnTo}
            className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
            aria-label="Back to list"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <BreadcrumbHeader segments={[...segments, { label: name }]} />
        </div>
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          {component && (
            <LocalMenu
              label="Component features"
              items={componentMenu(component)}
              selected={kind}
            />
          )}
          <div className="min-w-0 flex-1 overflow-y-auto">
            <div className="w-full px-4 pt-6 pb-10 sm:px-6">
              {isError && !resource ? (
                <QueryError
                  error={error}
                  onRetry={() => refetch()}
                  subject="resource"
                />
              ) : isLoading || !resource ? (
                <DetailSkeleton />
              ) : (
                <>
                  <PageHeader
                    title={resource.metadata.name}
                    actions={
                      <CopyButton
                        value={
                          resource.metadata.namespace
                            ? `${resource.metadata.namespace}/${resource.metadata.name}`
                            : resource.metadata.name
                        }
                        label={
                          resource.metadata.namespace
                            ? "Copy namespace/name"
                            : "Copy name"
                        }
                      />
                    }
                    description={
                      <dl className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                        {facts.map((fact, index) => (
                          <Fragment key={fact.label}>
                            {index > 0 && (
                              <span aria-hidden className="text-border">
                                ·
                              </span>
                            )}
                            <div className="flex items-center gap-1">
                              <dt
                                className={
                                  fact.label === "Kind" ? "sr-only" : undefined
                                }
                              >
                                {fact.label}
                              </dt>
                              <dd
                                className={
                                  fact.label === "Kind"
                                    ? "text-foreground"
                                    : "text-foreground/80"
                                }
                              >
                                {fact.value}
                              </dd>
                            </div>
                          </Fragment>
                        ))}
                      </dl>
                    }
                  >
                    <StatusBadge level={resource.status.level} />
                  </PageHeader>
                  {resource.status.message &&
                    resource.status.level !== "Healthy" && (
                      <p className="text-muted-foreground mt-3 max-w-3xl text-sm">
                        {resource.status.message}
                      </p>
                    )}
                  <Tabs
                    value={tab}
                    onValueChange={(value) =>
                      update({ tab: value === "overview" ? undefined : value })
                    }
                    className="mt-6 gap-0"
                  >
                    <div className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-10 -mx-4 border-b px-4 backdrop-blur sm:-mx-6 sm:px-6">
                      <TabsList
                        variant="line"
                        aria-label="Resource details"
                        className="h-10 gap-4 p-0"
                      >
                        <TabsTrigger value="overview" className="px-0">
                          Overview
                        </TabsTrigger>
                        <TabsTrigger
                          value="events"
                          aria-describedby={
                            eventSummary ? eventsCountId : undefined
                          }
                          className="px-0"
                        >
                          Events
                          {eventSummary && (
                            <CountBadge
                              decorative
                              value={eventSummary.total}
                              tone={eventSummary.warnings ? "Warning" : "count"}
                            />
                          )}
                        </TabsTrigger>
                        <TabsTrigger value="yaml" className="px-0">
                          YAML
                        </TabsTrigger>
                      </TabsList>
                      {eventSummary && (
                        <span id={eventsCountId} className="sr-only">
                          {eventSummary.total} events
                          {eventSummary.warnings
                            ? `, ${eventSummary.warnings} warnings`
                            : ""}
                        </span>
                      )}
                    </div>
                    <TabsContent value="overview" className="pt-6">
                      <RelatedNamespaceContext.Provider
                        value={
                          resource.metadata.namespace ??
                          (kind === "Namespace"
                            ? resource.metadata.name
                            : undefined)
                        }
                      >
                        <RelatedErrorContext.Provider value={subError}>
                          <resourceType.DetailRenderer
                            resource={resource}
                            subContent={subContent}
                            isLoadingSub={isLoadingSub}
                            isErrorSub={isErrorSub}
                            refetchSub={refetchSub}
                          />
                        </RelatedErrorContext.Provider>
                      </RelatedNamespaceContext.Provider>
                    </TabsContent>
                    <TabsContent value="events" className="pt-6">
                      <ResourceEvents
                        kind={kind}
                        namespace={namespace}
                        name={name}
                      />
                    </TabsContent>
                    <TabsContent value="yaml" className="pt-6">
                      <ResourceYaml resource={resource} />
                    </TabsContent>
                  </Tabs>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </ResourceReturnContext.Provider>
  );
}
export function ResourceDetailPage(props: Props) {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <ResourceDetailContent {...props} />
    </Suspense>
  );
}
