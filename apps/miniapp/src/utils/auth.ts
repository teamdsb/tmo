import { ROUTES, withQuery } from '../routes'
import { clearBootstrap, loadBootstrap, savePendingRoleSelection } from '../services/bootstrap'
import { commerceServices } from '../services/commerce'
import { gatewayServices } from '../services/gateway'
import { identityServices } from '../services/identity'
import { getCurrentPath, navigateTo } from './navigation'

export const hasAuthToken = async (): Promise<boolean> => {
  const token = await identityServices.tokens.getToken()
  return Boolean(token)
}

export const clearAuthSession = async (): Promise<void> => {
  await Promise.allSettled([
    gatewayServices.tokens.setToken(null),
    commerceServices.tokens.setToken(null),
    identityServices.tokens.setToken(null),
    clearBootstrap(),
    savePendingRoleSelection(null)
  ])
}

export const isLoggedIn = async (): Promise<boolean> => {
  const bootstrap = await loadBootstrap()
  if (bootstrap?.me) {
    return true
  }
  return hasAuthToken()
}

export const ensureLoggedIn = async (
  options: { redirect?: boolean; redirectTo?: string } = {}
): Promise<boolean> => {
  const { redirect = true, redirectTo } = options
  const loggedIn = await isLoggedIn()
  if (!loggedIn && redirect) {
    const target = redirectTo || getCurrentPath()
    await navigateTo(withQuery(ROUTES.authLogin, { redirect: target || undefined }))
  }
  return loggedIn
}

export const isUnauthorized = (error: unknown): boolean => {
  return typeof error === 'object'
    && error !== null
    && 'statusCode' in error
    && (error as { statusCode?: number }).statusCode === 401
}
