import Taro from '@tarojs/taro'
import { requireIdentityBaseUrl } from '../config/runtime-env'

export type MiniLoginPlatformCapabilities = {
  realPhoneLoginReady: boolean
  phoneProofSimulationEnabled: boolean
  missing: string[]
}

export type MiniLoginCapabilities = {
  loginMode: string
  weapp: MiniLoginPlatformCapabilities
  alipay: MiniLoginPlatformCapabilities
}

export const fetchMiniLoginCapabilities = async (): Promise<MiniLoginCapabilities> => {
  const response = await Taro.request<MiniLoginCapabilities>({
    url: `${requireIdentityBaseUrl()}/auth/mini/capabilities`,
    method: 'GET'
  })

  if (response.statusCode !== 200 || !response.data) {
    throw new Error(`mini login capabilities failed: ${response.statusCode}`)
  }

  return response.data
}
