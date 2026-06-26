import {
  AppsOutlined,
  BarChartOutlined,
  Description,
  LocationOutlined,
  ServiceOutlined,
  SettingOutlined,
  StarOutlined
} from '@taroify/icons'
import { ROUTES } from '../../routes'
import type { MenuItem, MockAddress, MockDemand } from './types'

export const SALES_MENU_ITEM: MenuItem = {
  key: 'sales-workbench',
  label: '业务员工作台',
  icon: ServiceOutlined,
  route: ROUTES.sales
}

export const PENDING_ORDER_STATUSES = ['SUBMITTED', 'CONFIRMED', 'PAY_PENDING', 'PAID', 'PAY_FAILED']

export const INITIAL_ADDRESSES_DATA: MockAddress[] = [
  {
    id: 1,
    name: '王小明',
    phone: '13812348888',
    tag: '默认',
    address: '上海市 浦东新区 世纪大道100号 上海环球金融中心 71层',
    isDefault: true
  },
  {
    id: 2,
    name: '李华',
    phone: '13900009999',
    tag: '',
    address: '北京市 朝阳区 建国路87号 SKP办公楼 15层',
    isDefault: false
  }
]

export const INITIAL_DEMANDS_DATA: MockDemand[] = [
  {
    id: 1,
    title: '需要定制一批办公椅，带人体工学设计',
    status: '处理中',
    count: '500把',
    date: '2024-06-15',
    createdAt: '2024-05-20'
  },
  {
    id: 2,
    title: '寻源高性价比的A4打印纸',
    status: '已报价',
    count: '10000箱',
    date: '2024-05-30',
    createdAt: '2024-05-18'
  }
]

export const toOrderBadge = (count: number): string | undefined => {
  if (!Number.isFinite(count) || count <= 0) {
    return undefined
  }
  return String(Math.floor(count))
}

export const createMineMenuItems = (
  setCurrentPage: (page: 'demand' | 'address' | 'orders') => void,
  includeSalesWorkbench = false
): MenuItem[] => {
  const items: MenuItem[] = [
    { key: 'demand', label: '我的需求', description: '查看询价与跟进进度', icon: Description, action: () => setCurrentPage('demand') },
    { key: 'favorites', label: '我的收藏', description: '同步关注的商品与方案', icon: StarOutlined, route: ROUTES.favorites },
    { key: 'address', label: '收货地址', description: '管理常用收货信息', icon: LocationOutlined, route: ROUTES.addressList },
    { key: 'support', label: '帮助中心', description: '联系客服与售后支持', icon: ServiceOutlined, route: ROUTES.support },
    {
      key: 'tracking',
      label: '物流跟踪',
      description: '统一查看订单配送动态',
      icon: BarChartOutlined,
      action: () => setCurrentPage('orders')
    }
  ]

  if (includeSalesWorkbench) {
    items.push(SALES_MENU_ITEM)
  }

  items.push(
    { key: 'import', label: 'Excel 批量导入', description: '批量上传商品与需求', icon: AppsOutlined, route: ROUTES.import },
    { key: 'settings', label: '系统设置', description: '账号与通知偏好', icon: SettingOutlined, route: ROUTES.settings }
  )

  return items
}
