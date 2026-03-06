import { fireEvent, render, screen } from '@testing-library/react'
import SalesPage from './index'

describe('SalesPage', () => {
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
