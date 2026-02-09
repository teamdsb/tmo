describe('toGatewayImageUrl', () => {
  const loadModule = () => require('./image-url') as typeof import('./image-url')

  beforeEach(() => {
    jest.resetModules()
    delete process.env.TARO_APP_API_BASE_URL
    delete process.env.TARO_APP_GATEWAY_BASE_URL
  })

  it('returns undefined for empty value', () => {
    const { toGatewayImageUrl } = loadModule()
    expect(toGatewayImageUrl()).toBeUndefined()
    expect(toGatewayImageUrl(null)).toBeUndefined()
    expect(toGatewayImageUrl('')).toBeUndefined()
  })

  it('keeps local paths unchanged', () => {
    const { toGatewayImageUrl } = loadModule()
    expect(toGatewayImageUrl('/assets/images/demo.png')).toBe('/assets/images/demo.png')
    expect(toGatewayImageUrl('test-file-stub')).toBe('test-file-stub')
  })

  it('rewrites remote url in test env using fallback gateway base url', () => {
    const { toGatewayImageUrl } = loadModule()
    const source = 'https://images.unsplash.com/photo-1545239351-1141bd82e8a6'
    expect(toGatewayImageUrl(source)).toBe(
      'http://localhost:8080/assets/img?url=https%3A%2F%2Fimages.unsplash.com%2Fphoto-1545239351-1141bd82e8a6'
    )
  })

  it('rewrites remote url to gateway image proxy url', () => {
    process.env.TARO_APP_API_BASE_URL = 'http://localhost:8080'
    const { toGatewayImageUrl } = loadModule()
    const source = 'https://images.unsplash.com/photo-1545239351-1141bd82e8a6'
    expect(toGatewayImageUrl(source)).toBe(
      'http://localhost:8080/assets/img?url=https%3A%2F%2Fimages.unsplash.com%2Fphoto-1545239351-1141bd82e8a6'
    )
  })

  it('does not rewrite urls that already use gateway origin', () => {
    process.env.TARO_APP_API_BASE_URL = 'http://localhost:8080'
    const { toGatewayImageUrl } = loadModule()
    const source = 'http://localhost:8080/assets/img?url=https%3A%2F%2Fimages.unsplash.com%2Fphoto-demo'
    expect(toGatewayImageUrl(source)).toBe(source)
    expect(toGatewayImageUrl('http://localhost:8080/static/demo.png')).toBe('http://localhost:8080/static/demo.png')
  })
})
