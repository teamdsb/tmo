import { render, screen } from '@testing-library/react'

import PolicyPage from './index'

const setRouterParams = (params: Record<string, string> = {}) => {
  ;(globalThis as { __setTaroRouterParams?: (input: Record<string, string>) => void }).__setTaroRouterParams?.(params)
}

describe('PolicyPage', () => {
  afterEach(() => setRouterParams())

  it('shows the requested service terms', () => {
    setRouterParams({ type: 'terms' })
    render(<PolicyPage />)

    expect(screen.getAllByText('服务条款').length).toBeGreaterThan(0)
    expect(screen.getByText(/账号需按真实业务身份使用/)).toBeInTheDocument()
  })

  it('falls back to the privacy policy for unknown types', () => {
    setRouterParams({ type: 'unknown' })
    render(<PolicyPage />)

    expect(screen.getAllByText('隐私政策').length).toBeGreaterThan(0)
    expect(screen.getByText(/我们会在登录、下单、收货与售后流程中处理账号信息/)).toBeInTheDocument()
  })
})
