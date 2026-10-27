import { redirect } from "next/navigation";
import {
  legacyListUrl,
  type RouteSearchParams,
} from "@/features/resource-explorer/lib/legacy-list-url";

export default async function KyvernoPolicyRedirect({
  searchParams,
}: {
  searchParams: Promise<RouteSearchParams>;
}) {
  redirect(legacyListUrl("/security", await searchParams, "KyvernoPolicy"));
}
