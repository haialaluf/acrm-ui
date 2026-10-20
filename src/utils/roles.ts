type RoleLike = string | null | undefined;

export const isGhost = (role: RoleLike) => role === "super_admin";

export const isOwnerRole = (role: RoleLike) =>
  role === "owner" || isGhost(role);

export const isAdminRole = (role: RoleLike) =>
  role === "admin" || isOwnerRole(role);
