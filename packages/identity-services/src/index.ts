import { getPhoneNumber as platformGetPhoneNumber, getPlatform, login as platformLogin, type PhoneProofResult } from '@tmo/platform-adapter'
import { Platform } from '@tmo/shared/enums'
import {
  getMe,
  getMePermissions,
  getMeSalesQrCode,
  postAuthMiniLogin,
  postAuthPasswordLogin,
  setIdentityApiClientConfig,
  type ApiClientConfig,
  type ApiClientRequester,
  type AuthResponse,
  type MiniLoginRequest,
  type MiniLoginRequestPlatform,
  type MiniLoginRequestRole,
  type PasswordLoginRequest,
  type PermissionList,
  type SalesQrCode,
  type User
} from '@tmo/identity-api-client'

import { ApiError, isApiError } from './errors'
import { createRequester } from './requester'
import { createTokenStore, type TokenStore } from './token'
import {
  defaultTokenStorageKey,
  legacyTokenStorageKey,
  resolveBaseUrl,
  resolveDevToken,
  type IdentityServicesConfig
} from './config'

export class RoleSelectionRequiredError extends Error {
  availableRoles: string[]

  constructor(roles: string[]) {
    super('role selection required')
    this.name = 'RoleSelectionRequiredError'
    this.availableRoles = roles
  }
}

export interface IdentityServices {
  auth: {
    miniLogin: (input: MiniLoginInput) => Promise<AuthResponse>
    passwordLogin: (input: PasswordLoginInput) => Promise<AuthResponse>
  }
  me: {
    get: () => Promise<User>
    getPermissions: () => Promise<PermissionList>
    getSalesQrCode: () => Promise<SalesQrCode>
  }
  tokens: TokenStore
}

export interface MiniLoginInput {
  platform?: MiniLoginRequestPlatform
  scene?: string
  role?: MiniLoginRequestRole
  bindingToken?: string
  phoneProof?: PhoneProofResult
}

export interface PasswordLoginInput {
  username: string
  password: string
  role?: PasswordLoginRequest['role']
}

export const createIdentityServices = (config: IdentityServicesConfig = {}): IdentityServices => {
  const baseUrl = resolveBaseUrl(config.baseUrl)
  const devToken = resolveDevToken(config.devToken)
  const tokenKey = config.tokenStorageKey ?? defaultTokenStorageKey

  const tokens = createTokenStore(tokenKey, devToken, legacyTokenStorageKey)
  const requester: ApiClientRequester = config.requester ?? createRequester({
    getToken: tokens.getToken,
    timeoutMs: config.timeoutMs
  })

  const apiClientConfig: ApiClientConfig = {
    baseUrl,
    requester
  }
  setIdentityApiClientConfig(apiClientConfig)

  const auth = {
    miniLogin: async (input: MiniLoginInput): Promise<AuthResponse> => {
      const platform = resolvePlatform(input.platform)
      const loginResult = await platformLogin()
      const phoneProof = input.phoneProof ?? await platformGetPhoneNumber()
      const payload: MiniLoginRequest = {
        platform,
        code: loginResult.code
      }
      if (input.scene) {
        payload.scene = input.scene
      }
      if (input.bindingToken) {
        payload.bindingToken = input.bindingToken
      }
      if (input.role) {
        payload.role = input.role
      }
      if (phoneProof.code || phoneProof.phone) {
        payload.phoneProof = {
          code: phoneProof.code,
          phone: phoneProof.phone
        }
      }

      try {
        const response = await postAuthMiniLogin(payload)
        if (response.status === 200) {
          await tokens.setToken(response.data.accessToken)
          return response.data
        }
        if (response.status === 409) {
          throw roleConflictFromResponse(response.data)
        }
        throw new ApiError('login failed', response.status)
      } catch (error) {
        if (isRoleConflict(error)) {
          throw error
        }
        if (isApiError(error) && error.statusCode === 409 && error.details) {
          const roles = availableRolesFromDetails(error.details)
          if (roles.length > 0) {
            throw new RoleSelectionRequiredError(roles)
          }
        }
        throw error
      }
    },
    passwordLogin: async (input: PasswordLoginInput): Promise<AuthResponse> => {
      const payload: PasswordLoginRequest = {
        username: input.username,
        password: input.password
      }
      if (input.role) {
        payload.role = input.role
      }

      const response = await postAuthPasswordLogin(payload)
      if (response.status !== 200) {
        throw new ApiError('login failed', response.status)
      }
      await tokens.setToken(response.data.accessToken)
      return response.data
    }
  }

  const me = {
    get: async (): Promise<User> => {
      const response = await getMe()
      if (response.status !== 200) {
        throw new ApiError('failed to fetch user', response.status)
      }
      return response.data
    },
    getPermissions: async (): Promise<PermissionList> => {
      const response = await getMePermissions()
      if (response.status !== 200) {
        throw new ApiError('failed to fetch permissions', response.status)
      }
      return response.data
    },
    getSalesQrCode: async (): Promise<SalesQrCode> => {
      const response = await getMeSalesQrCode()
      if (response.status !== 200) {
        throw new ApiError('failed to fetch sales qr', response.status)
      }
      return response.data
    }
  }

  return {
    auth,
    me,
    tokens
  }
}

const resolvePlatform = (platform?: MiniLoginRequestPlatform): MiniLoginRequestPlatform => {
  if (platform) {
    return platform
  }
  const detected = getPlatform()
  switch (detected) {
    case Platform.Weapp:
      return 'weapp'
    case Platform.Alipay:
      return 'alipay'
    default:
      throw new Error('login is not supported on this platform')
  }
}

const availableRolesFromDetails = (details: Record<string, unknown>): string[] => {
  const roles = details.availableRoles
  if (Array.isArray(roles)) {
    return roles.filter((value): value is string => typeof value === 'string')
  }
  return []
}

const roleConflictFromResponse = (response: { details?: { availableRoles?: string[] } }): RoleSelectionRequiredError => {
  const roles = response.details?.availableRoles ?? []
  return new RoleSelectionRequiredError(roles)
}

const isRoleConflict = (error: unknown): error is RoleSelectionRequiredError => {
  return error instanceof RoleSelectionRequiredError
}

export type { IdentityServicesConfig }
export { ApiError, isApiError }
