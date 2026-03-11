import type { BootstrapResponse } from '@tmo/gateway-api-client'

const normalizeRole = (value: string): string => value.trim().toUpperCase()

const decodeBase64Url = (value: string): string => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  if (typeof globalThis.atob === 'function') {
    return globalThis.atob(padded)
  }
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(padded, 'base64').toString('utf8')
  }
  throw new Error('base64 decode is unavailable')
}

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

export const isCustomerUser = (bootstrap: BootstrapResponse | null): boolean => {
  return bootstrap?.me?.userType === 'customer'
}

export const getCurrentRole = (bootstrap: BootstrapResponse | null): string => {
  const currentRole = bootstrap?.me?.currentRole
  if (typeof currentRole === 'string' && currentRole.trim()) {
    return normalizeRole(currentRole)
  }
  return readRoles(bootstrap)[0] ?? ''
}

export const readRoleFromJwt = (token: string | null | undefined): string => {
  const raw = typeof token === 'string' ? token.trim() : ''
  if (!raw) {
    return ''
  }
  const segments = raw.split('.')
  if (segments.length < 2 || !segments[1]) {
    return ''
  }
  try {
    const payload = JSON.parse(decodeBase64Url(segments[1])) as { role?: unknown }
    return typeof payload.role === 'string' ? normalizeRole(payload.role) : ''
  } catch {
    return ''
  }
}
