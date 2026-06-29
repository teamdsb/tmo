import { render, screen } from '@testing-library/react'

import PolicyPage from './index'

const setRouterParams = (params: Record<string, string> = {}) => {
  ;(globalThis as { __setTaroRouterParams?: (input: Record<string, string>) => void }).__setTaroRouterParams?.(params)
}

describe('PolicyPage', () => {
  afterEach(() => setRouterParams())

  it('shows the complete user service agreement', () => {
    setRouterParams({ type: 'terms' })
    render(<PolicyPage />)

    expect(screen.getAllByText('用户服务协议').length).toBeGreaterThan(0)
    expect(screen.getByText(/一、协议的范围与接受/)).toBeInTheDocument()
    expect(screen.getByText(/四、商品、价格、订单与支付/)).toBeInTheDocument()
    expect(screen.getByText(/十三、联系我们/)).toBeInTheDocument()
  })

  it('falls back to the complete privacy policy for unknown types', () => {
    setRouterParams({ type: 'unknown' })
    render(<PolicyPage />)

    expect(screen.getAllByText('隐私政策').length).toBeGreaterThan(0)
    expect(screen.getByText(/二、我们如何收集和使用个人信息/)).toBeInTheDocument()
    expect(screen.getByText(/微信授权手机号/)).toBeInTheDocument()
    expect(screen.getByText(/你主动选中的照片或文件/)).toBeInTheDocument()
    expect(screen.getByText(/十、联系我们/)).toBeInTheDocument()
  })
})
