import { createIdentityServices } from '@tmo/identity-services'
import { request } from '@tmo/platform-adapter'

jest.unmock('@tmo/identity-services')

describe('identity customer services', () => {
  it('requests the scoped customer endpoint with the stored bearer token', async () => {
    ;(request as jest.Mock).mockResolvedValueOnce({
      statusCode: 200,
      data: {
        items: [],
        page: 1,
        pageSize: 20,
        total: 0
      },
      headers: {}
    })

    const services = createIdentityServices({
      baseUrl: 'https://identity.test',
      devToken: 'sales-token'
    })

    await expect(services.customers.list({ page: 1, pageSize: 20 })).resolves.toEqual({
      items: [],
      page: 1,
      pageSize: 20,
      total: 0
    })

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://identity.test/customers?page=1&pageSize=20',
        method: 'GET',
        headers: expect.objectContaining({ Authorization: 'Bearer sales-token' })
      })
    )
  })
})
