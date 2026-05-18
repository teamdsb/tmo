import { login as platformLogin } from '@tmo/platform-adapter'
import {
  ApiError,
  RoleSelectionRequiredError,
  type DebugRoleSwitchInput,
  type IdentityServices,
  type MiniLoginInput
} from '@tmo/identity-services'
import { runtimeEnv } from '../../config/runtime-env'
import {
  buildMockAuthContext,
  createIsolatedMockAccessToken,
  createIsolatedTokenStore,
  getMockPermissions,
  getMockUser,
  type IsolatedMockAuthContext,
  loadIsolatedMockAuthContext,
  saveIsolatedMockAuthContext
} from './runtime'

const createUnauthorizedError = (): Error & { statusCode: number; code: string } => {
  const error = new Error('unauthorized')
  return Object.assign(error, { statusCode: 401, code: 'unauthorized' })
}

const createPhoneRequiredError = (): ApiError => {
  return new ApiError('phone proof is required', 400, { code: 'phone_required' })
}

const buildAuthResponse = (
  token: string,
  context: ReturnType<typeof buildMockAuthContext>
): Awaited<ReturnType<IdentityServices['auth']['miniLogin']>> => {
  return {
    accessToken: token,
    expiresIn: 24 * 60 * 60,
    user: getMockUser(context)
  }
}

const buildMockSalesQrCodeUrl = (scene: string): string => {
  const encodedScene = scene.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&apos;'
    }
    return entities[char] ?? char
  })
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">',
    '<rect width="256" height="256" rx="18" fill="#ffffff"/>',
    '<rect x="16" y="16" width="224" height="224" rx="10" fill="#f8fafc"/>',
    '<g fill="#0f172a">',
    '<rect x="32" y="32" width="48" height="48" rx="4"/><rect x="44" y="44" width="24" height="24" fill="#ffffff"/><rect x="52" y="52" width="8" height="8"/>',
    '<rect x="176" y="32" width="48" height="48" rx="4"/><rect x="188" y="44" width="24" height="24" fill="#ffffff"/><rect x="196" y="52" width="8" height="8"/>',
    '<rect x="32" y="176" width="48" height="48" rx="4"/><rect x="44" y="188" width="24" height="24" fill="#ffffff"/><rect x="52" y="196" width="8" height="8"/>',
    '<rect x="96" y="36" width="16" height="16"/><rect x="128" y="36" width="12" height="12"/><rect x="148" y="56" width="16" height="16"/>',
    '<rect x="96" y="72" width="28" height="12"/><rect x="132" y="84" width="12" height="24"/><rect x="156" y="92" width="20" height="12"/>',
    '<rect x="92" y="116" width="16" height="16"/><rect x="116" y="116" width="36" height="12"/><rect x="164" y="116" width="16" height="16"/><rect x="196" y="112" width="20" height="20"/>',
    '<rect x="92" y="148" width="24" height="12"/><rect x="128" y="144" width="16" height="32"/><rect x="152" y="152" width="32" height="12"/><rect x="200" y="148" width="16" height="16"/>',
    '<rect x="96" y="192" width="16" height="16"/><rect x="124" y="188" width="28" height="12"/><rect x="160" y="184" width="16" height="40"/><rect x="188" y="196" width="36" height="16"/>',
    '</g>',
    `<text x="128" y="238" text-anchor="middle" font-size="12" fill="#475569" font-family="Arial, sans-serif">${encodedScene}</text>`,
    '</svg>'
  ].join('')
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

const resolveMockLoginCodeFallback = (role?: string): string => {
  const normalizedRole = String(role || '').trim().toUpperCase()
  if (normalizedRole === 'SALES') {
    return 'mock_sales_001'
  }
  return 'mock_customer_001'
}

const resolveMockLoginCode = async (): Promise<string> => {
  const result = await platformLogin()
  const code = typeof result?.code === 'string' ? result.code.trim() : ''
  return code || 'mock_customer_001'
}

const resolveSelectedRole = (roles: string[], requested?: string): 'CUSTOMER' | 'SALES' => {
  const normalizedRequested = String(requested || '').trim().toUpperCase()
  if (normalizedRequested) {
    if (!roles.includes(normalizedRequested)) {
      throw new Error('role not assigned')
    }
    return normalizedRequested === 'SALES' ? 'SALES' : 'CUSTOMER'
  }
  if (roles.length > 1) {
    throw new RoleSelectionRequiredError(roles)
  }
  return roles[0] === 'SALES' ? 'SALES' : 'CUSTOMER'
}

export const createMockIdentityServices = (): IdentityServices => {
  const tokens = createIsolatedTokenStore(runtimeEnv.identityDevToken)

  const ensureAuthorized = async () => {
    const token = await tokens.getToken()
    const context = await loadIsolatedMockAuthContext()
    if (!token || !context) {
      throw createUnauthorizedError()
    }
    return context
  }

  return {
    auth: {
      miniLogin: async (input: MiniLoginInput) => {
        const hasRequestedRole = Boolean(String(input?.role || '').trim())
        const code = String(input?.codeOverride || '').trim()
          || (hasRequestedRole ? resolveMockLoginCodeFallback(input?.role) : await resolveMockLoginCode())
        if (!hasRequestedRole && !input?.phoneProof) {
          throw createPhoneRequiredError()
        }
        const preliminaryContext = buildMockAuthContext(code)
        const selectedRole = resolveSelectedRole(preliminaryContext.roles, input?.role)
        const context = buildMockAuthContext(code, selectedRole)
        const token = createIsolatedMockAccessToken()
        await tokens.setToken(token)
        await saveIsolatedMockAuthContext(context)
        return buildAuthResponse(token, context)
      },
      passwordLogin: async () => {
        throw new Error('password login is not available in miniapp isolated mock mode')
      },
      switchRole: async (input: DebugRoleSwitchInput) => {
        const current = await ensureAuthorized()
        const selectedRole = resolveSelectedRole(current.roles, input.role)
        const nextContext: IsolatedMockAuthContext = {
          ...current,
          currentRole: selectedRole,
          userType: selectedRole === 'CUSTOMER' ? 'customer' : 'staff'
        }
        const token = createIsolatedMockAccessToken()
        await tokens.setToken(token)
        await saveIsolatedMockAuthContext(nextContext)
        return buildAuthResponse(token, nextContext)
      }
    },
    me: {
      get: async () => {
        const context = await ensureAuthorized()
        return getMockUser(context)
      },
      getPermissions: async () => {
        const context = await ensureAuthorized()
        return getMockPermissions(context)
      },
      getSalesQrCode: async () => {
        const context = await ensureAuthorized()
        if (context.currentRole !== 'SALES') {
          throw Object.assign(new Error('permission denied'), { statusCode: 403, code: 'forbidden' })
        }
        const scene = 'mock-sales-bind'
        return {
          qrCodeUrl: buildMockSalesQrCodeUrl(scene),
          scene,
          platform: 'weapp',
          expiresAt: null
        }
      }
    },
    tokens
  }
}
