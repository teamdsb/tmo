import { useState } from 'react'
import { Text, View } from '@tarojs/components'
import { navItems } from './data'
import type { SalesTab } from './types'
import { AccountingView, CustomersView, DashboardView, OrdersView } from './views'

export default function SalesPage() {
  const [activeTab, setActiveTab] = useState<SalesTab>('dashboard')

  return (
    <View className='sales-page-shell sales-font h-screen w-full text-slate-900'>
      <View className='sales-main-container relative mx-auto flex h-screen w-full max-w-md flex-col overflow-hidden shadow-2xl'>
        <View className='min-h-0 flex-1'>
          {activeTab === 'dashboard' ? <DashboardView /> : null}
          {activeTab === 'customers' ? <CustomersView /> : null}
          {activeTab === 'orders' ? <OrdersView /> : null}
          {activeTab === 'accounting' ? <AccountingView /> : null}
        </View>

        <View className='sales-bottom-nav sales-bottom-nav-shadow absolute bottom-0 left-0 right-0 z-50 flex gap-2 border-t border-slate-200 bg-white px-4 pb-6 pt-3'>
          {navItems.map(({ key, label, Icon }) => {
            const active = activeTab === key
            const iconStyle = { fontSize: active ? '44rpx' : '40rpx' }

            return (
              <View
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex flex-1 flex-col items-center justify-end gap-1 ${active ? 'sales-primary-text' : 'text-slate-500'}`}
              >
                <View className={`flex h-8 w-12 items-center justify-center rounded-full ${active ? 'sales-primary-soft-bg' : ''}`}>
                  <Icon className={active ? 'sales-primary-text' : 'text-slate-500'} style={iconStyle} />
                </View>
                <Text className='text-10 font-semibold leading-normal tracking-wide uppercase'>{label}</Text>
              </View>
            )
          })}
        </View>
      </View>
    </View>
  )
}
