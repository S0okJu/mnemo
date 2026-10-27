import { redirect } from "next/navigation";
import {
  legacyListUrl,
  type RouteSearchParams,
} from "@/features/resource-explorer/lib/legacy-list-url";

export default async function StatefulSetRedirect({
  searchParams,
}: {
  searchParams: Promise<RouteSearchParams>;
}) {
  redirect(
    legacyListUrl("/kubernetes/workload", await searchParams, "StatefulSet"),
  );
}
