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
        const code = String(input?.codeOverride || '').trim() || await resolveMockLoginCode()
        if (!input?.role && !input?.phoneProof) {
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
        return {
          qrCodeUrl: 'https://example.com/mock-sales-qr.png',
          scene: 'mock-sales-bind',
          platform: 'weapp',
          expiresAt: null
        }
      }
    },
    tokens
  }
}
