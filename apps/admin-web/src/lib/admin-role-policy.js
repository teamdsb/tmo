export const ALLOWED_ADMIN_WEB_ROLES = ['ADMIN', 'BOSS', 'MANAGER', 'CS'];

export const normalizeRole = (role) => {
  return String(role || '').trim().toUpperCase();
};

export const isAllowedAdminWebRole = (role) => {
  const normalized = normalizeRole(role);
  return ALLOWED_ADMIN_WEB_ROLES.includes(normalized);
};

export const filterAllowedAdminWebRoles = (roles) => {
  if (!Array.isArray(roles)) {
    return [];
  }
  const filtered = roles
    .map((role) => normalizeRole(role))
    .filter((role) => isAllowedAdminWebRole(role));
  return Array.from(new Set(filtered));
};

export const hasAllowedAdminWebRole = (session) => {
  const currentRole = normalizeRole(session?.currentRole);
  if (isAllowedAdminWebRole(currentRole)) {
    return true;
  }
  const roleFromLegacy = normalizeRole(session?.role);
  if (isAllowedAdminWebRole(roleFromLegacy)) {
    return true;
  }
  const allowedFromUserRoles = filterAllowedAdminWebRoles(session?.user?.roles);
  return allowedFromUserRoles.length > 0;
};
