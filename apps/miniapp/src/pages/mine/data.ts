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
  },
  {
    id: 'ORD-20240518-42',
    status: '待处理',
    date: '2024-05-18 09:20',
    totalPrice: 4680,
    items: [
      {
        name: '工业级温湿度传感器',
        specs: '标准版 / RS485',
        price: 780,
        count: 6,
        image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&q=80&w=100&h=100'
      }
    ],
    tracking: {
      latest: '订单已提交，等待商家确认与发货安排',
      time: '2小时前'
    }
  },
  {
    id: 'ORD-20240515-17',
    status: '已发货',
    date: '2024-05-15 16:40',
    totalPrice: 3250,
    items: [
      {
        name: '企业级路由交换一体机',
        specs: '16口 / 千兆',
        price: 3250,
        count: 1,
        image: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&q=80&w=100&h=100'
      }
    ],
    tracking: {
      latest: '[苏州市] 包裹已离开发货仓，正在运输途中',
      time: '昨天 18:20'
    }
  },
  {
    id: 'ORD-20240510-08',
    status: '已送达',
    date: '2024-05-10 11:05',
    totalPrice: 1980,
    items: [
      {
        name: '高精度电子秤',
        specs: '桌面型 / 30kg',
        price: 990,
        count: 2,
        image: 'https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?auto=format&fit=crop&q=80&w=100&h=100'
      }
    ],
    tracking: {
      latest: '快件已由前台签收，如有问题请在 7 天内发起售后',
      time: '05-11 09:10'
    }
  },
  {
    id: 'ORD-20240506-03',
    status: '退换货',
    date: '2024-05-06 14:18',
    totalPrice: 860,
    items: [
      {
        name: '便携式扫码枪',
        specs: '无线版 / 黑色',
        price: 430,
        count: 2,
        image: 'https://images.unsplash.com/photo-1580894732444-8ecded7900cd?auto=format&fit=crop&q=80&w=100&h=100'
      }
    ],
    tracking: {
      latest: '退货申请已提交，等待售后审核',
      time: '05-06 17:32'
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
