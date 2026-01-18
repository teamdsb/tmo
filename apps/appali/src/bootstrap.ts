import { buildUrl, createClient } from '@tmo/openapi-client'
import { getPlatform } from '@tmo/platform-adapter'
import { isNonEmptyString } from '@tmo/shared/validators'

const BASE_URL = 'http://localhost:8080'

export const initApp = () => {
  const platform = getPlatform()
  const healthUrl = buildUrl(BASE_URL, '/health')

  const client = createClient({
    baseUrl: BASE_URL,
    requester: async (options) => {
      void options
      throw new Error('API requester not configured')
    }
  })

  if (isNonEmptyString(healthUrl)) {
    console.log('App launched', {
      platform,
      healthUrl,
      apiReady: typeof client.request === 'function'
    })
  }
}
