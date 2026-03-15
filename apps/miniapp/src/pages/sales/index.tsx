import { type CSSProperties, useCallback, useEffect, useMemo, useState } from 'react'
import { Text, View } from '@tarojs/components'
import { useDidShow } from '@tarojs/taro'
import Navbar from '@taroify/core/navbar'
import { navItems } from './data'
import type { SalesTab } from './types'
import { AccountingView, CustomersView, DashboardView, OrdersView } from './views'
import { ROUTES } from '../../routes'
import { switchTabLike } from '../../utils/navigation'
import { getNavbarStyle, getNavbarTotalHeight } from '../../utils/navbar'
import { loadBootstrap } from '../../services/bootstrap'
import { gatewayServices } from '../../services/gateway'
import { identityServices } from '../../services/identity'
import { getCurrentRole } from '../../utils/authz'

type SalesQrCode = Awaited<ReturnType<typeof identityServices.me.getSalesQrCode>>

export default function SalesPage() {
  const [activeTab, setActiveTab] = useState<SalesTab>('dashboard')
  const [salesQrCode, setSalesQrCode] = useState<SalesQrCode | null>(null)
  const [salesName, setSalesName] = useState('业务员')
  const [salesRole, setSalesRole] = useState('客户经理')
  const [qrLoading, setQrLoading] = useState(false)
  const [qrError, setQrError] = useState('')
  const isH5 = process.env.TARO_ENV === 'h5'
  const navbarStyle = getNavbarStyle()
  const pageStyle = navbarStyle as CSSProperties
  const navbarSpacerStyle = { height: `${getNavbarTotalHeight()}px` } as CSSProperties
  const qrPlatformLabel = useMemo(() => {
    const platform = String(salesQrCode?.platform || 'weapp').trim().toLowerCase()
    return platform === 'alipay' ? '支付宝' : '微信'
  }, [salesQrCode?.platform])

  const refreshSalesContext = useCallback(async () => {
    let cachedBootstrap = await loadBootstrap()
    try {
      const freshBootstrap = await gatewayServices.bootstrap.get()
      cachedBootstrap = freshBootstrap
    } catch (error) {
      console.warn('refresh sales bootstrap failed', error)
    }
    const nextSalesName = cachedBootstrap?.me?.displayName?.trim() || '业务员'
    const nextSalesRole = getCurrentRole(cachedBootstrap) || '客户经理'
    setSalesName(nextSalesName)
    setSalesRole(nextSalesRole)
  }, [])

  const refreshSalesQrCode = useCallback(async () => {
    setQrLoading(true)
    setQrError('')
    try {
      const nextQr = await identityServices.me.getSalesQrCode()
      setSalesQrCode(nextQr)
    } catch (error) {
      console.warn('load sales qr failed', error)
      setSalesQrCode(null)
      setQrError('二维码生成失败，请确认当前账号为业务员并稍后重试。')
    } finally {
      setQrLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshSalesContext()
    void refreshSalesQrCode()
  }, [refreshSalesContext, refreshSalesQrCode])

  useDidShow(() => {
    void refreshSalesContext()
    void refreshSalesQrCode()
  })

  return (
    <View className='sales-page-shell sales-font w-full text-slate-900' style={pageStyle}>
      {isH5 ? <Navbar bordered fixed placeholder style={navbarStyle} className='app-navbar app-navbar--primary' /> : null}
      {!isH5 ? <View className='sales-safe-top-spacer' style={navbarSpacerStyle} /> : null}
      <View className='sales-main-container relative mx-auto flex w-full max-w-md flex-col'>
        <View className='sales-global-header'>
          <View>
            <Text className='sales-global-header-title'>业务员工作台</Text>
            <Text className='sales-global-header-copy'>查看客户、订单与结算信息</Text>
          </View>
          <View
            className='sales-global-header-action'
            onClick={() => void switchTabLike(ROUTES.home)}
          >
            <Text className='sales-global-header-action-text'>返回购物</Text>
          </View>
        </View>
        <View className='sales-main-content min-h-0 flex-1'>
          {activeTab === 'dashboard' ? (
            <DashboardView
              qrCodeUrl={salesQrCode?.qrCodeUrl || ''}
              qrError={qrError}
              qrLoading={qrLoading}
              qrPlatformLabel={qrPlatformLabel}
              qrScene={salesQrCode?.scene || ''}
              salesName={salesName}
              salesRole={salesRole}
              onRefreshQr={() => void refreshSalesQrCode()}
            />
          ) : null}
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
