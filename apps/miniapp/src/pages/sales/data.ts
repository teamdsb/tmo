import {
  AppsOutlined,
  BalanceOutlined,
  BarChartOutlined,
  FriendsOutlined,
  Logistics,
  OrdersOutlined
} from '@taroify/icons'
import type {
  Customer,
  CustomerSubFilter,
  CustomerSubOrder,
  NavItem,
  Order,
  OrderStatus,
  SettledOrder
} from './types'

export const PROFILE_IMAGE_URL =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDS-Ii8-RYQWRHi7NRn7ujP4nBj5b27SqsnQlr_jvCr1fNZ90Xa8PTUAgyVff7zsjkZ-CVcpfqpAFImVPrHYYkc7sQ2SK11qP1fyuoHScxGlRWJWip7l6hx-vy7vDIPO79FUnu-avStjGabIojNzp5t-Cm_8yomJTd7f4VrGZgGKs65ExahSrNzzSFs0bhWkesNgUYkN4W8o2VLTqF7AICOtosah3hqXwPjHUarAXV6Gr2wFfDyN2jCHHgOG2BTs8jfp5Cd8GXDHu8'

export const customersData: Customer[] = [
  { id: 1, initial: 'A', name: 'Acme 集团', contact: '张伟', active: '2天前', orders: 3 },
  { id: 2, initial: 'G', name: '环球贸易科技', contact: '李娜', active: '1周前', orders: 2 },
  { id: 3, initial: 'S', name: '星辰实业', contact: '王建国', active: '今天', orders: 2 },
  { id: 4, initial: 'I', name: '创新动力', contact: '赵小龙', active: '3天前', orders: 1 }
]

export const settledOrdersData: SettledOrder[] = [
  { id: 'ORD-2023-089', company: '星辰实业', date: '8月24日', amount: '$12,450', commission: '+$622.50' },
  { id: 'ORD-2023-082', company: 'Acme 集团', date: '8月18日', amount: '$8,900', commission: '+$445.00' },
  { id: 'ORD-2023-075', company: '环球贸易科技', date: '8月12日', amount: '$15,200', commission: '+$760.00' }
]

export const ordersListData: Order[] = [
  {
    id: '12345',
    company: 'Acme 集团',
    date: '10月24日, 10:30 AM',
    status: '已发货',
    total: '$4,300.00',
    products: [
      {
        id: 1,
        name: '重型轴承',
        model: 'TX-500',
        size: '大号',
        qty: 50,
        price: '$2,500.00',
        image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB9qBnYl_CKrDuqRP4rON46rZFuJyHVo58PXIiZzf6t1nSWKIDmmUpcK6uVATFS2Er7vOSacYjrNA7Y3ct1tLOQSkwcPk2YoRgJ-GI7MoXzkJtneTHxdLmTE1mI8J3I9Ula7DstqE59YSJVV5imNw4Xi7sfjogSfCvGeoYaqpzMweBXfxRCEb7G-3AMMTKwNymfTSK4BV57z8R2YVFqrHkaUOsONt8dFC86WrJulssInsqkM5RcaqeEZsj37g4ELxHvFihuFUNkXeA'
      },
      {
        id: 2,
        name: '钢制支架',
        model: 'BKT-2',
        size: '标准',
        qty: 120,
        price: '$1,800.00',
        image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDuqrZlsbuURs7J5K_qOtEkC_9G3zPcVB7paCyeO0IuYwe9TcdfhlOW9QPgLJdtbXnzqtN2eLZzYcufLFWcNSxSVcefj-Yxgf5czlEEwvGbTo1bJcZmW4S9v2MtnC5euMOu5Cq4rTd7GQIjBx_fJpP3ubqGISUBRoxji3-9nHt_YZ_qSGiGVhJ75BXoPYKFU7TX7yU3KhsUnL18Ua65vqA5ShXq_-LTE68K_Ge0I0aB68NL4OiuK7QkWYRjmykpGoBElEAEaQeGqwM'
      }
    ]
  },
  {
    id: '12346',
    company: 'Acme 集团',
    date: '10月26日, 14:20 PM',
    status: '待处理',
    total: '$1,500.00',
    products: [
      {
        id: 1,
        name: '工业级润滑油',
        model: 'LUB-100',
        size: '5加仑',
        qty: 10,
        price: '$1,500.00',
        image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDuqrZlsbuURs7J5K_qOtEkC_9G3zPcVB7paCyeO0IuYwe9TcdfhlOW9QPgLJdtbXnzqtN2eLZzYcufLFWcNSxSVcefj-Yxgf5czlEEwvGbTo1bJcZmW4S9v2MtnC5euMOu5Cq4rTd7GQIjBx_fJpP3ubqGISUBRoxji3-9nHt_YZ_qSGiGVhJ75BXoPYKFU7TX7yU3KhsUnL18Ua65vqA5ShXq_-LTE68K_Ge0I0aB68NL4OiuK7QkWYRjmykpGoBElEAEaQeGqwM'
      }
    ]
  },
  {
    id: '12344',
    company: '星辰实业',
    date: '10月23日, 14:15 PM',
    status: '已送达',
    total: '$8,500.00',
    products: [
      {
        id: 1,
        name: '电路板 v2',
        model: 'CB-2024',
        size: '微型',
        qty: 200,
        price: '$8,500.00',
        image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCRGYc_onha2lZ0arzfEWdlG-4MyBaI_g_G7MexJm56kHsVTjRwt07z9JwUI2n4GNGyS4VT0f3c0c-TtFKLnKNSPaYwmUBo7voYW8OE7IqyE8g4kCkWAQLlHqd_oJrJWCEYBhBIOWA2B8aDFvmlLW-VniD5AT6yxOBjClDGWP6WeuDEg8Mf87f_-yVhcuRkiwQbU4LilK6VyzsYXQ1w98yncq_4kz4gUovYpoW2-vA2cMDw_phNMO0J6LCu_2EwNWPDgKQunfmBijE'
      }
    ]
  },
  {
    id: '12347',
    company: '星辰实业',
    date: '10月21日, 16:45 PM',
    status: '已送达',
    total: '$5,600.00',
    products: [
      {
        id: 1,
        name: '重型轴承',
        model: 'TX-500',
        size: '大号',
        qty: 100,
        price: '$5,000.00',
        image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB9qBnYl_CKrDuqRP4rON46rZFuJyHVo58PXIiZzf6t1nSWKIDmmUpcK6uVATFS2Er7vOSacYjrNA7Y3ct1tLOQSkwcPk2YoRgJ-GI7MoXzkJtneTHxdLmTE1mI8J3I9Ula7DstqE59YSJVV5imNw4Xi7sfjogSfCvGeoYaqpzMweBXfxRCEb7G-3AMMTKwNymfTSK4BV57z8R2YVFqrHkaUOsONt8dFC86WrJulssInsqkM5RcaqeEZsj37g4ELxHvFihuFUNkXeA'
      },
      {
        id: 2,
        name: '钢制支架',
        model: 'BKT-2',
        size: '标准',
        qty: 40,
        price: '$600.00',
        image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDuqrZlsbuURs7J5K_qOtEkC_9G3zPcVB7paCyeO0IuYwe9TcdfhlOW9QPgLJdtbXnzqtN2eLZzYcufLFWcNSxSVcefj-Yxgf5czlEEwvGbTo1bJcZmW4S9v2MtnC5euMOu5Cq4rTd7GQIjBx_fJpP3ubqGISUBRoxji3-9nHt_YZ_qSGiGVhJ75BXoPYKFU7TX7yU3KhsUnL18Ua65vqA5ShXq_-LTE68K_Ge0I0aB68NL4OiuK7QkWYRjmykpGoBElEAEaQeGqwM'
      }
    ]
  },
  {
    id: '12348',
    company: '创新动力',
    date: '10月26日, 11:20 AM',
    status: '待处理',
    total: '$3,400.00',
    products: [
      {
        id: 1,
        name: '电路板 v2',
        model: 'CB-2024',
        size: '微型',
        qty: 80,
        price: '$3,400.00',
        image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCRGYc_onha2lZ0arzfEWdlG-4MyBaI_g_G7MexJm56kHsVTjRwt07z9JwUI2n4GNGyS4VT0f3c0c-TtFKLnKNSPaYwmUBo7voYW8OE7IqyE8g4kCkWAQLlHqd_oJrJWCEYBhBIOWA2B8aDFvmlLW-VniD5AT6yxOBjClDGWP6WeuDEg8Mf87f_-yVhcuRkiwQbU4LilK6VyzsYXQ1w98yncq_4kz4gUovYpoW2-vA2cMDw_phNMO0J6LCu_2EwNWPDgKQunfmBijE'
      }
    ]
  }
]

export const customerSubFilters: CustomerSubFilter[] = ['全部', '待处理', '已发货', '已送达']

export const customerSubOrdersById: Record<number, CustomerSubOrder[]> = {
  1: [
    { id: 'CUST-1001', date: '10月24日', amount: '$4,300', status: '已发货' },
    { id: 'CUST-1002', date: '10月19日', amount: '$2,150', status: '待处理' }
  ],
  2: [
    { id: 'CUST-1003', date: '10月25日', amount: '$1,200', status: '待处理' },
    { id: 'CUST-1004', date: '10月03日', amount: '$9,800', status: '已送达' }
  ],
  3: [
    { id: 'CUST-1005', date: '10月23日', amount: '$8,500', status: '已送达' },
    { id: 'CUST-1006', date: '10月21日', amount: '$5,600', status: '已送达' }
  ],
  4: [{ id: 'CUST-1007', date: '10月26日', amount: '$3,400', status: '待处理' }]
}

export const navItems: NavItem[] = [
  { key: 'dashboard', label: '主页', Icon: AppsOutlined },
  { key: 'customers', label: '客户', Icon: FriendsOutlined },
  { key: 'orders', label: '订单', Icon: OrdersOutlined },
  { key: 'accounting', label: '财务', Icon: BalanceOutlined }
]

export const getStatusTone = (status: OrderStatus) => {
  if (status === '待处理') {
    return { bg: 'sales-status-amber', text: 'sales-status-amber-text' }
  }
  if (status === '已送达') {
    return { bg: 'sales-status-emerald', text: 'sales-status-emerald-text' }
  }
  return { bg: 'sales-status-blue', text: 'sales-status-blue-text' }
}

export const accountingSummaryCards = [
  {
    key: 'sales',
    icon: BarChartOutlined,
    title: '总销售额',
    value: '$45,230',
    progressLabel: '已达成 $50k 目标的 92%',
    progressWidth: '92%',
    cardClassName: 'sales-summary-card sales-summary-card--blue',
    iconClassName: 'sales-primary-text',
    accentClassName: 'sales-summary-progress-track',
    fillClassName: 'sales-summary-progress-fill'
  },
  {
    key: 'commission',
    icon: BalanceOutlined,
    title: '预计佣金',
    value: '$2,261',
    progressLabel: '较上月增长 15%',
    progressWidth: '',
    cardClassName: 'sales-summary-card sales-summary-card--green',
    iconClassName: 'sales-summary-green-text',
    accentClassName: '',
    fillClassName: ''
  }
]

export const accountingListIcon = Logistics
