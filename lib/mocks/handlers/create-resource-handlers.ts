import { http, HttpResponse, type JsonBodyType } from "msw";
import type { K8sResource, ResourceList } from "@/lib/api/types";

const API_BASE = "/api/v1";
const CLUSTER_SCOPED = "_";

function matchesNamespace(
  itemNamespace: string | undefined,
  paramNamespace: string,
) {
  return paramNamespace === CLUSTER_SCOPED
    ? itemNamespace === undefined
    : itemNamespace === paramNamespace;
}

export function createResourceHandlers<
  T extends K8sResource<unknown, unknown>,
>({
  kindPath,
  items,
  subContent,
}: {
  kindPath: string;
  items: T[];
  subContent: (resource: T) => JsonBodyType;
}) {
  const listPath = `${API_BASE}/${kindPath}`;
  const detailPath = `${API_BASE}/${kindPath}/:namespace/:name`;
  const subPath = `${API_BASE}/${kindPath}/:namespace/:name/:sub`;

  return [
    http.get(listPath, ({ request }) => {
      const url = new URL(request.url);
      const namespace = url.searchParams.get("namespace");
      const search = url.searchParams.get("search")?.toLowerCase();

      let filtered = items;
      if (namespace) {
        filtered = filtered.filter(
          (item) => item.metadata.namespace === namespace,
        );
      }
      if (search) {
        filtered = filtered.filter((item) =>
          item.metadata.name.toLowerCase().includes(search),
        );
      }

      const body: ResourceList<T> = { items: filtered, total: filtered.length };
      return HttpResponse.json(body);
    }),

    http.get(detailPath, ({ params }) => {
      const found = items.find(
        (item) =>
          item.metadata.name === params.name &&
          matchesNamespace(item.metadata.namespace, params.namespace as string),
      );
      if (!found) {
        return HttpResponse.json({ message: "Not found" }, { status: 404 });
      }
      return HttpResponse.json(found);
    }),

    http.get(`${detailPath}/events`, ({ params }) => {
      const found = items.find(
        (item) =>
          item.metadata.name === params.name &&
          matchesNamespace(item.metadata.namespace, params.namespace as string),
      );
      if (!found)
        return HttpResponse.json({ message: "Not found" }, { status: 404 });
      const payload = subContent(found);
      const candidates = Array.isArray(payload)
        ? payload
        : payload &&
            typeof payload === "object" &&
            "events" in payload &&
            Array.isArray(payload.events)
          ? payload.events
          : [];
      const events = candidates.filter(
        (event) =>
          event &&
          typeof event === "object" &&
          "message" in event &&
          "time" in event,
      );
      return HttpResponse.json(events);
    }),
    http.get(subPath, ({ params }) => {
      const found = items.find(
        (item) =>
          item.metadata.name === params.name &&
          matchesNamespace(item.metadata.namespace, params.namespace as string),
      );
      if (!found) {
        return HttpResponse.json({ message: "Not found" }, { status: 404 });
      }
      return HttpResponse.json(subContent(found));
    }),
  ];
}
