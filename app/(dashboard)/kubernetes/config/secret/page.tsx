import { redirect } from "next/navigation";
import {
  legacyListUrl,
  type RouteSearchParams,
} from "@/features/resource-explorer/lib/legacy-list-url";

export default async function SecretRedirect({
  searchParams,
}: {
  searchParams: Promise<RouteSearchParams>;
}) {
  redirect(legacyListUrl("/kubernetes/config", await searchParams, "Secret"));
}
