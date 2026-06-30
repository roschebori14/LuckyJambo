import { AdminPermission } from "@/types/permissions";

export function hasPermission(
  permissions: AdminPermission[],
  permission: AdminPermission,
) {
  return permissions.includes(permission);
}
