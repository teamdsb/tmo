import { clearBootstrap, loadBootstrap } from './services/bootstrap'
import { commerceServices } from './services/commerce'
import { gatewayServices } from './services/gateway'
import { identityServices } from './services/identity'
import { bootstrapApp, fallbackIdentityBootstrap, tryBootstrap } from './app'

const asMock = <T extends (...args: any[]) => any>(fn: T) => fn as unknown as jest.Mock

describe('app bootstrap', () => {
  beforeEach(async () => {
    await clearBootstrap()
    asMock(identityServices.tokens.getToken).mockResolvedValue('token-123')
    asMock(gatewayServices.bootstrap.get).mockReset()
    asMock(identityServices.me.get).mockReset()
    asMock(identityServices.me.getPermissions).mockReset()
    asMock(gatewayServices.tokens.setToken).mockClear()
    asMock(commerceServices.tokens.setToken).mockClear()
    asMock(identityServices.tokens.setToken).mockClear()
  })

  it('does not request bootstrap without token', async () => {
    asMock(identityServices.tokens.getToken).mockResolvedValue(null)
    await clearBootstrap()

    await bootstrapApp()

    expect(gatewayServices.bootstrap.get).not.toHaveBeenCalled()
    expect(identityServices.me.get).not.toHaveBeenCalled()
    expect(identityServices.me.getPermissions).not.toHaveBeenCalled()
    await expect(loadBootstrap()).resolves.toBeNull()
  })

  it('saves gateway bootstrap on success', async () => {
    asMock(gatewayServices.bootstrap.get).mockResolvedValue({
      me: { id: 'u-1', roles: ['CUSTOMER'] },
      permissions: { items: [] },
      featureFlags: {}
    })

    const bootstrap = await tryBootstrap()

    expect(bootstrap?.me?.id).toBe('u-1')
    await expect(loadBootstrap()).resolves.toMatchObject({
      me: { id: 'u-1' }
    })
  })

  it('clears session when gateway bootstrap returns unauthorized', async () => {
    asMock(gatewayServices.bootstrap.get).mockRejectedValue({ statusCode: 401 })

    const bootstrap = await tryBootstrap()

    expect(bootstrap).toBeNull()
    expect(gatewayServices.tokens.setToken).toHaveBeenCalledWith(null)
    expect(commerceServices.tokens.setToken).toHaveBeenCalledWith(null)
    expect(identityServices.tokens.setToken).toHaveBeenCalledWith(null)
    await expect(loadBootstrap()).resolves.toBeNull()
  })

  it('does not fall back to identity bootstrap after unauthorized gateway bootstrap', async () => {
    asMock(gatewayServices.bootstrap.get).mockRejectedValue({ statusCode: 401 })
    asMock(identityServices.tokens.getToken)
      .mockResolvedValueOnce('token-123')
      .mockResolvedValueOnce(null)

    await bootstrapApp()

    expect(identityServices.me.get).not.toHaveBeenCalled()
    expect(identityServices.me.getPermissions).not.toHaveBeenCalled()
  })

  it('falls back to identity bootstrap after non-401 gateway failure', async () => {
    asMock(gatewayServices.bootstrap.get).mockRejectedValue(new Error('upstream failed'))
    asMock(identityServices.me.get).mockResolvedValue({ id: 'u-2', roles: ['CUSTOMER'] })
    asMock(identityServices.me.getPermissions).mockResolvedValue({ items: [{ code: 'catalog:read', scope: 'SELF' }] })

    await bootstrapApp()

    expect(identityServices.me.get).toHaveBeenCalled()
    expect(identityServices.me.getPermissions).toHaveBeenCalled()
    await expect(loadBootstrap()).resolves.toMatchObject({
      me: { id: 'u-2' },
      permissions: { items: [{ code: 'catalog:read', scope: 'SELF' }] }
    })
  })

  it('clears session when fallback identity bootstrap returns unauthorized', async () => {
    asMock(identityServices.me.get).mockRejectedValue({ statusCode: 401 })

    await fallbackIdentityBootstrap()

    expect(gatewayServices.tokens.setToken).toHaveBeenCalledWith(null)
    expect(commerceServices.tokens.setToken).toHaveBeenCalledWith(null)
    expect(identityServices.tokens.setToken).toHaveBeenCalledWith(null)
  })
})
