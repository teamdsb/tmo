import { type CSSProperties, useState } from 'react'
import { Text, View } from '@tarojs/components'
import Navbar from '@taroify/core/navbar'
import { navItems } from './data'
import type { SalesTab } from './types'
import { AccountingView, CustomersView, DashboardView, OrdersView } from './views'
import { getNavbarStyle, getNavbarTotalHeight } from '../../utils/navbar'

export default function SalesPage() {
  const [activeTab, setActiveTab] = useState<SalesTab>('dashboard')
  const isH5 = process.env.TARO_ENV === 'h5'
  const navbarStyle = getNavbarStyle()
  const pageStyle = navbarStyle as CSSProperties
  const navbarSpacerStyle = { height: `${getNavbarTotalHeight()}px` } as CSSProperties

  return (
    <View className='sales-page-shell sales-font w-full text-slate-900' style={pageStyle}>
      {isH5 ? <Navbar bordered fixed placeholder style={navbarStyle} className='app-navbar app-navbar--primary' /> : null}
      {!isH5 ? <View className='sales-safe-top-spacer' style={navbarSpacerStyle} /> : null}
      <View className='sales-main-container relative mx-auto flex w-full max-w-md flex-col'>
        <View className='sales-main-content min-h-0 flex-1'>
          {activeTab === 'dashboard' ? <DashboardView /> : null}
          {activeTab === 'customers' ? <CustomersView /> : null}
          {activeTab === 'orders' ? <OrdersView /> : null}
          {activeTab === 'accounting' ? <AccountingView /> : null}
        </View>

        <View className='sales-bottom-nav sales-bottom-nav-shadow flex gap-1 border-t border-slate-200 bg-white px-2 pt-2'>
          {navItems.map(({ key, label, Icon }) => {
            const active = activeTab === key
            const iconStyle = { fontSize: active ? '42rpx' : '38rpx' }

            return (
              <View
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex flex-1 flex-col items-center justify-end gap-1 ${active ? 'sales-primary-text' : 'text-slate-500'}`}
              >
                <View className={`sales-nav-icon-wrap ${active ? 'sales-nav-icon-wrap--active' : ''}`}>
                  <Icon className={active ? 'sales-primary-text' : 'text-slate-500'} style={iconStyle} />
                </View>
                <Text className={`sales-nav-label ${active ? 'sales-nav-label--active' : ''}`}>{label}</Text>
              </View>
            )
          })}
        </View>
      </View>
    </View>
  )
}
