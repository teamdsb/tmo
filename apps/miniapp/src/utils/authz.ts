import type { BootstrapResponse } from '@tmo/gateway-api-client'

const normalizeRole = (value: string): string => value.trim().toUpperCase()

const readRoles = (bootstrap: BootstrapResponse | null): string[] => {
  const roles = bootstrap?.me?.roles
  if (!Array.isArray(roles)) {
    return []
  }
  return roles
    .filter((role): role is string => typeof role === 'string' && role.trim().length > 0)
    .map((role) => normalizeRole(role))
}

export const hasRole = (
  bootstrap: BootstrapResponse | null,
  role: string
): boolean => {
  const target = normalizeRole(role)
  if (!target) {
    return false
  }
  return readRoles(bootstrap).includes(target)
}

export const isSalesUser = (bootstrap: BootstrapResponse | null): boolean => {
  return hasRole(bootstrap, 'SALES')
}

