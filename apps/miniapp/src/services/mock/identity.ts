import type { IdentityServices } from '@tmo/identity-services'
import { runtimeEnv } from '../../config/runtime-env'
import {
  createIsolatedMockAccessToken,
  createIsolatedTokenStore,
  getMockPermissions,
  getMockUserForRuntimeRoles,
  setIsolatedMockRoles
} from './runtime'

const createUnauthorizedError = (): Error & { statusCode: number; code: string } => {
  const error = new Error('unauthorized')
  return Object.assign(error, { statusCode: 401, code: 'unauthorized' })
}

const buildAuthResponse = async (
  token: string
): Promise<Awaited<ReturnType<IdentityServices['auth']['miniLogin']>>> => {
  return {
    accessToken: token,
    expiresIn: 24 * 60 * 60,
    user: await getMockUserForRuntimeRoles()
  }
}

export const createMockIdentityServices = (): IdentityServices => {
  const tokens = createIsolatedTokenStore(runtimeEnv.identityDevToken)

  const ensureAuthorized = async (): Promise<void> => {
    const token = await tokens.getToken()
    if (!token) {
      throw createUnauthorizedError()
    }
  }

  return {
    auth: {
      miniLogin: async (input) => {
        if (input?.role) {
          await setIsolatedMockRoles([input.role])
        }
        const token = createIsolatedMockAccessToken()
        await tokens.setToken(token)
        return buildAuthResponse(token)
      },
      passwordLogin: async () => {
        const token = createIsolatedMockAccessToken()
        await tokens.setToken(token)
        return buildAuthResponse(token)
      }
    },
    me: {
      get: async () => {
        await ensureAuthorized()
        return getMockUserForRuntimeRoles()
      },
      getPermissions: async () => {
        await ensureAuthorized()
        return getMockPermissions()
      },
      getSalesQrCode: async () => {
        await ensureAuthorized()
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
