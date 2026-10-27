import { redirect } from "next/navigation";
import {
  legacyListUrl,
  type RouteSearchParams,
} from "@/features/resource-explorer/lib/legacy-list-url";

export default async function RbacServiceAccountRedirect({
  searchParams,
}: {
  searchParams: Promise<RouteSearchParams>;
}) {
  redirect(
    legacyListUrl("/kubernetes/rbac", await searchParams, "RbacServiceAccount"),
  );
}
