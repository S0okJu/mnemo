import { createResourceHandlers } from "@/lib/mocks/handlers/create-resource-handlers";
import {
  rbacRoles,
  rbacRoleBindings,
  rbacServiceAccounts,
} from "@/lib/mocks/fixtures/rbac";
import type { RbacRoleResource } from "@/lib/resource-registry/kinds/rbac-role";
import type { RbacRoleBindingResource } from "@/lib/resource-registry/kinds/rbac-role-binding";
import type { RbacServiceAccountResource } from "@/lib/resource-registry/kinds/rbac-service-account";

export const rbacRoleHandlers = createResourceHandlers<RbacRoleResource>({
  kindPath: "rbac/roles",
  items: rbacRoles,
  subContent: (resource) =>
    rbacRoleBindings
      .filter(
        (binding) =>
          binding.metadata.namespace === resource.metadata.namespace &&
          binding.spec?.roleRef === `Role/${resource.metadata.name}`,
      )
      .map((binding) => binding.metadata.name),
});

export const rbacRoleBindingHandlers =
  createResourceHandlers<RbacRoleBindingResource>({
    kindPath: "rbac/role-bindings",
    items: rbacRoleBindings,
    subContent: (resource) => {
      const roleName = resource.spec?.roleRef.split("/")[1];
      const role = rbacRoles.find((r) => r.metadata.name === roleName);
      return (
        role?.spec?.rules.map((rule) => ({
          verbs: rule.verbs,
          resources: rule.resources,
        })) ?? []
      );
    },
  });

export const rbacServiceAccountHandlers =
  createResourceHandlers<RbacServiceAccountResource>({
    kindPath: "rbac/service-accounts",
    items: rbacServiceAccounts,
    subContent: (resource) =>
      rbacRoleBindings
        .filter((binding) =>
          binding.spec?.subjects.some(
            (subject) =>
              subject.kind === "ServiceAccount" &&
              subject.name === resource.metadata.name &&
              (subject.namespace ?? binding.metadata.namespace) ===
                resource.metadata.namespace,
          ),
        )
        .map((binding) => binding.spec?.roleRef ?? ""),
  });
