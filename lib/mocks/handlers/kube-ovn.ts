import { http, HttpResponse } from "msw";
import { createResourceHandlers } from "./create-resource-handlers";
import { kubeOvnResources } from "@/features/plugins/registry/kube-ovn";
import {
  kubeOvnItems,
  kubeOvnRelations,
  kubeOvnMockCapabilities,
} from "@/lib/mocks/fixtures/kube-ovn";

export const kubeOvnHandlers = [
  http.get("/api/v1/integrations/kube-ovn/capabilities", () =>
    HttpResponse.json(kubeOvnMockCapabilities),
  ),
  ...kubeOvnResources.flatMap((definition) =>
    createResourceHandlers({
      kindPath: definition.apiPath,
      items: kubeOvnItems.filter((item) => item.kind === definition.kind),
      subContent: (item) =>
        kubeOvnRelations[`${item.kind}/${item.metadata.name}`] ?? [],
    }),
  ),
];
