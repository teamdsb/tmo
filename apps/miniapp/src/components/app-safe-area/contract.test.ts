import fs from 'node:fs'
import path from 'node:path'

const sourceRoot = path.resolve(__dirname, '../..')

const listFiles = (directory: string): string[] => {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name)
    return entry.isDirectory() ? listFiles(target) : [target]
  })
}

describe('native tab bar safe-area architecture', () => {
  it('keeps bottom safe-area CSS inside the shared primitive', () => {
    const allowedFile = path.resolve(__dirname, 'index.scss')
    const offenders = listFiles(sourceRoot)
      .filter((file) => file.endsWith('.scss') && file !== allowedFile)
      .filter((file) => {
        const source = fs.readFileSync(file, 'utf8')
        return source.includes('safe-area-inset-bottom')
          || source.includes('--tabbar-height')
          || source.includes('--tabbar-safe-offset')
      })

    expect(offenders).toEqual([])
  })

  it('uses the platform tab bar without a custom tab-bar implementation', () => {
    const appConfig = fs.readFileSync(path.resolve(sourceRoot, 'app.config.ts'), 'utf8')

    expect(appConfig).toContain('tabBar: {')
    expect(appConfig).not.toMatch(/tabBar:\s*\{[\s\S]*?custom:\s*true/)
    expect(fs.existsSync(path.resolve(sourceRoot, 'components/app-tabbar/index.tsx'))).toBe(false)
  })

  it('keeps component lazy loading disabled so native page navigation can finish', () => {
    const appConfig = fs.readFileSync(path.resolve(sourceRoot, 'app.config.ts'), 'utf8')

    expect(appConfig).not.toContain("lazyCodeLoading: 'requiredComponents'")
  })

  it('routes fixed bars and standalone bottom content through shared primitives', () => {
    const fixedPages = [
      'pages/cart/components.tsx',
      'pages/goods/detail/index.tsx',
      'pages/order/confirm/index.tsx',
      'pages/order/detail/index.tsx',
      'pages/sales/index.tsx'
    ]
    for (const relativePath of fixedPages) {
      expect(fs.readFileSync(path.resolve(sourceRoot, relativePath), 'utf8')).toContain('AppFixedBottom')
    }

    const cartSource = fs.readFileSync(path.resolve(sourceRoot, 'pages/cart/components.tsx'), 'utf8')
    expect(cartSource).toContain('includeSafeArea={false}')

    const supportSource = fs.readFileSync(path.resolve(sourceRoot, 'pages/support/chat/index.tsx'), 'utf8')
    const addressSource = fs.readFileSync(path.resolve(sourceRoot, 'pages/account/address/index.tsx'), 'utf8')
    expect(supportSource).toContain('AppSafeAreaBottom')
    expect(addressSource).toContain('AppSafeAreaBottom')
  })
})
