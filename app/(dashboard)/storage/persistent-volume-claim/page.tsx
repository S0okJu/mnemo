import { redirect } from "next/navigation";
import {
  legacyListUrl,
  type RouteSearchParams,
} from "@/features/resource-explorer/lib/legacy-list-url";

export default async function PersistentVolumeClaimRedirect({
  searchParams,
}: {
  searchParams: Promise<RouteSearchParams>;
}) {
  redirect(
    legacyListUrl("/storage", await searchParams, "PersistentVolumeClaim"),
  );
}
