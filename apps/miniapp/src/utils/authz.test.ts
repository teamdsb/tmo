import type { BootstrapResponse } from '@tmo/gateway-api-client'
import { hasRole, isSalesUser } from './authz'

const bootstrapWithRoles = (roles: string[]): BootstrapResponse => ({
  me: {
    id: 'u-1',
    currentRole: roles[0] || 'CUSTOMER',
    userType: 'staff',
    roles,
    createdAt: '2026-01-01T00:00:00Z'
  },
  permissions: { items: [] },
  featureFlags: {}
})

describe('authz utils', () => {
  it('matches role case-insensitively', () => {
    const bootstrap = bootstrapWithRoles(['sales'])
    expect(hasRole(bootstrap, 'SALES')).toBe(true)
    expect(hasRole(bootstrap, 'sales')).toBe(true)
  })

  it('returns false when bootstrap is missing', () => {
    expect(hasRole(null, 'SALES')).toBe(false)
    expect(isSalesUser(null)).toBe(false)
  })

  it('detects SALES role', () => {
    expect(isSalesUser(bootstrapWithRoles(['CUSTOMER', 'SALES']))).toBe(true)
    expect(isSalesUser(bootstrapWithRoles(['CUSTOMER']))).toBe(false)
  })
})
