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
import type { ChatMessage, MenuItem, MockAddress, MockDemand, MockOrder } from './types'

export const SALES_MENU_ITEM: MenuItem = {
  key: 'sales-workbench',
  label: '业务员工作台',
  icon: ServiceOutlined,
  route: ROUTES.sales
}

export const PENDING_ORDER_STATUSES = ['SUBMITTED', 'CONFIRMED', 'PAY_PENDING', 'PAID', 'PAY_FAILED']

export const INITIAL_MESSAGES: ChatMessage[] = [
  { id: 1, sender: 'agent', text: '您好！我是您的专属客户经理。今天有什么可以帮您的吗？', time: '09:41' },
  { id: 2, sender: 'user', text: '我想咨询一下最近那批电子元件订单的批量价格。', time: '09:42' },
  {
    id: 3,
    sender: 'agent',
    text: '好的，没问题。请问您是指哪个订单或者哪款产品？您可以直接发送链接给我。',
    time: '09:42',
    hasActions: true
  }
]

export const INITIAL_ORDERS_DATA: MockOrder[] = [
  {
    id: 'ORD-20240520-99',
    status: '待收货',
    date: '2024-05-20 14:30',
    totalPrice: 2580,
    items: [
      {
        name: '人体工学办公椅 - 旗舰版',
        specs: '黑色 / 尼龙脚',
        price: 1290,
        count: 2,
        image: 'https://images.unsplash.com/photo-1505797149-43b0069ec26b?auto=format&fit=crop&q=80&w=100&h=100'
      }
    ],
    tracking: {
      latest: '[上海市] 派送中：快递员小王正在为您派送',
      time: '10分钟前'
    }
  }
]

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

export const createMineMenuItems = (setCurrentPage: (page: 'demand' | 'address' | 'orders') => void): MenuItem[] => [
  { key: 'demand', label: '我的需求', icon: Description, action: () => setCurrentPage('demand') },
  { key: 'favorites', label: '收藏', icon: StarOutlined, route: ROUTES.favorites },
  { key: 'address', label: '收货地址', icon: LocationOutlined, action: () => setCurrentPage('address') },
  { key: 'import', label: 'Excel 批量导入', icon: AppsOutlined, route: ROUTES.import },
  {
    key: 'tracking',
    label: '物流跟踪',
    icon: BarChartOutlined,
    action: () => setCurrentPage('orders')
  },
  { key: 'settings', label: '系统设置', icon: SettingOutlined, route: ROUTES.settings }
]
