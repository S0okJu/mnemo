import { notFound, redirect } from "next/navigation";
import {
  kubeOvnPlugin,
  kubeOvnResourceHref,
} from "@/features/plugins/registry/kube-ovn";
import {
  typeListUrl,
  type RouteSearchParams,
} from "@/features/resource-explorer/lib/legacy-list-url";

/** Feature sections became menu headings; their URLs open the first (or requested) type. */
export default async function KubeOvnSectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>;
  searchParams: Promise<RouteSearchParams>;
}) {
  const { section } = await params;
  // The former Components page was removed; keep its URL working.
  if (section === "components") redirect(kubeOvnPlugin.basePath);
  const entry = kubeOvnPlugin.sections.find(
    (candidate) => candidate.id === section && candidate.kinds.length,
  );
  if (!entry) notFound();
  const query = await searchParams;
  const requested = [query.type, query.tab].find(
    (value): value is string =>
      typeof value === "string" && entry.kinds.includes(value),
  );
  redirect(
    typeListUrl(kubeOvnResourceHref(requested ?? entry.kinds[0])!, query),
  );
}
