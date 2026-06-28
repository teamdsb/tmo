import { render, screen } from '@testing-library/react'

import { savePendingRoleSelection } from '../../../services/bootstrap'
import RoleSelectPage from './index'

describe('RoleSelectPage', () => {
  beforeEach(async () => {
    await savePendingRoleSelection({ roles: ['CUSTOMER', 'SALES'] })
  })

  afterEach(async () => {
    await savePendingRoleSelection(null)
  })

  it('centers the dual-role choices below the safe-area navbar', async () => {
    const { container } = render(<RoleSelectPage />)

    expect(await screen.findByText('客户')).toBeInTheDocument()
    expect(screen.getByText('业务员')).toBeInTheDocument()
    expect(container.querySelector('.app-navbar--secondary')).toBeInTheDocument()
    expect(container.querySelector('.role-select-main')).toBeInTheDocument()
    expect(container.querySelector('.role-select-card')).toBeInTheDocument()
  })
})
