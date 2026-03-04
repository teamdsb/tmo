import { View, Text } from '@tarojs/components'
import Navbar from '@taroify/core/navbar'
import Cell from '@taroify/core/cell'
import { getNavbarStyle } from '../../utils/navbar'
import { ROUTES } from '../../routes'
import { navigateTo } from '../../utils/navigation'

type SupportSalesViewProps = {
  onBack: () => void
}

export default function SupportSalesView({ onBack }: SupportSalesViewProps) {
  const navbarStyle = getNavbarStyle()

  return (
    <View className='page'>
      <Navbar bordered fixed placeholder safeArea='top' style={navbarStyle} className='app-navbar'>
        <Navbar.NavLeft onClick={onBack} />
        <Navbar.Title>业务员工作台</Navbar.Title>
      </Navbar>
      <View className='page-content'>
        <Text className='section-subtitle'>当前为业务员视图，后续可在此嵌入完整业务员页面。</Text>
      </View>
      <Cell.Group inset>
        <Cell
          title='查看客户订单'
          brief='进入订单列表跟进客户履约状态'
          onClick={() => navigateTo(ROUTES.orders)}
        />
        <Cell
          title='新增工单'
          brief='手动创建并分派处理任务'
          onClick={() => navigateTo(ROUTES.supportCreate)}
        />
      </Cell.Group>
    </View>
  )
}
