import fs from 'node:fs'
import path from 'node:path'
import { fireEvent, render, screen } from '@testing-library/react'
import SalesPage from './index'

describe('SalesPage', () => {

  it('applies shared long-text protection to sales order titles', () => {
    render(<SalesPage />)

    fireEvent.click(screen.getByText('订单'))

    const company = screen.getAllByText(/Acme 集团|星辰实业|创新动力/)[0]
    const productName = screen.getAllByText(/重型轴承|钢制支架|电路板 v2|工业级润滑油/)[0]

    expect(company).toHaveClass('u-safe-title-2')
    expect(productName).toHaveClass('u-safe-title-2')

    const stylesheet = fs.readFileSync(path.resolve(__dirname, '../../app.scss'), 'utf8')
    expect(stylesheet).toContain('.sales-order-company')
    expect(stylesheet).toContain('.sales-order-item-name')
    expect(stylesheet).toContain('.u-safe-title-2')
  })

  it('renders dashboard by default and switches between tabs', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    try {
      render(<SalesPage />)

      expect(screen.getByText('您的专属推广二维码')).toBeInTheDocument()
      expect(screen.getByText('李明浩')).toBeInTheDocument()

      fireEvent.click(screen.getByText('客户'))
      expect(screen.getByText('客户列表')).toBeInTheDocument()

      fireEvent.click(screen.getByText('订单'))
      expect(screen.getByText('订单列表')).toBeInTheDocument()

      fireEvent.click(screen.getByText('财务'))
      expect(screen.getByText('财务结算')).toBeInTheDocument()
      expect(screen.getByText('总销售额')).toBeInTheDocument()
    } finally {
      consoleErrorSpy.mockRestore()
    }
  })
})
