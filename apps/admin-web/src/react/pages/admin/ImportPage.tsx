import { useMemo, useState } from 'react';

import { AdminTopbar } from '../../layout/AdminTopbar';

type ShipmentStatus = '待发货' | '已发货' | '运输中' | '已送达';
type FilterStatus = '全部' | ShipmentStatus;
type RowAction = 'addTracking' | 'menuOnly' | 'quickEdit' | 'updateStatus' | 'viewDetail';

type TabItem = {
  label: FilterStatus;
  count?: number;
};

type OrderRow = {
  orderNo: string;
  customerName: string;
  customerEmail: string;
  customerInitials: string;
  status: ShipmentStatus;
  carrier?: string;
  trackingNo?: string;
  lastUpdated: string;
  action: RowAction;
};

const tabs: readonly TabItem[] = [
  { label: '全部' },
  { label: '待发货', count: 12 },
  { label: '已发货' },
  { label: '运输中' },
  { label: '已送达' }
];

const orders: readonly OrderRow[] = [
  {
    orderNo: '#ORD-1001',
    customerName: 'Alice Smith',
    customerEmail: 'alice@example.com',
    customerInitials: 'AS',
    status: '待发货',
    lastUpdated: '刚刚',
    action: 'addTracking'
  },
  {
    orderNo: '#ORD-1005',
    customerName: 'Eve Davis',
    customerEmail: 'eve.d@example.com',
    customerInitials: 'ED',
    status: '待发货',
    lastUpdated: '2小时前',
    action: 'menuOnly'
  },
  {
    orderNo: '#ORD-1002',
    customerName: 'Bob Jones',
    customerEmail: 'bob.j@example.com',
    customerInitials: 'BJ',
    status: '已发货',
    carrier: 'FedEx',
    trackingNo: 'FX-123456789',
    lastUpdated: '1小时前',
    action: 'quickEdit'
  },
  {
    orderNo: '#ORD-1003',
    customerName: 'Charlie Brown',
    customerEmail: 'charlie@example.com',
    customerInitials: 'CB',
    status: '运输中',
    carrier: 'UPS',
    trackingNo: '1Z9999999999999999',
    lastUpdated: '4小时前',
    action: 'updateStatus'
  },
  {
    orderNo: '#ORD-1004',
    customerName: 'David Lee',
    customerEmail: 'david@example.com',
    customerInitials: 'DL',
    status: '已送达',
    carrier: 'USPS',
    trackingNo: '940010000000000000',
    lastUpdated: '1天前',
    action: 'viewDetail'
  }
];

const statusStyleMap: Record<ShipmentStatus, { wrapper: string; dot: string }> = {
  待发货: {
    wrapper: 'bg-amber-50 text-amber-700 border border-amber-200',
    dot: 'bg-amber-500'
  },
  已发货: {
    wrapper: 'bg-blue-50 text-blue-700 border border-blue-200',
    dot: 'bg-blue-500'
  },
  运输中: {
    wrapper: 'bg-purple-50 text-purple-700 border border-purple-200',
    dot: 'bg-purple-500'
  },
  已送达: {
    wrapper: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    dot: 'bg-emerald-500'
  }
};

const renderRowAction = (action: RowAction) => {
  if (action === 'addTracking') {
    return (
      <button
        className="inline-flex items-center justify-center rounded-lg bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
        type="button"
      >
        添加物流
      </button>
    );
  }

  if (action === 'menuOnly') {
    return (
      <button
        className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
        type="button"
      >
        <span className="material-symbols-outlined text-xl">more_vert</span>
      </button>
    );
  }

  const label =
    action === 'quickEdit' ? '快速编辑' :
    action === 'updateStatus' ? '更新状态' :
    '查看详情';

  return (
    <div className="inline-flex items-center justify-end">
      <button
        className="mr-3 text-sm font-medium text-slate-400 transition-colors hover:text-primary"
        type="button"
      >
        {label}
      </button>
      <button
        className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
        type="button"
      >
        <span className="material-symbols-outlined text-xl">more_vert</span>
      </button>
    </div>
  );
};

export const ImportPage = () => {
  const [activeStatus, setActiveStatus] = useState<FilterStatus>('待发货');

  const visibleOrders = useMemo(() => {
    if (activeStatus === '全部') {
      return orders;
    }

    return orders.filter((row) => row.status === activeStatus);
  }, [activeStatus]);

  return (
    <>
      <AdminTopbar
        searchPlaceholder="搜索订单..."
        leftSlot={
          <div className="flex items-center gap-4 text-slate-900 dark:text-white">
            <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <svg fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="size-5">
                <path d="M20 8h-3V4H3v13h2v-2h14v-2h-3v-3h4V8zm-2 2h-2v2h2v-2zm-6-6h-7v9h7V4zM5 10H7v2H5v-2zm2-4H5V4h2v2zM5 6h2v2H5V6zm10 14c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm-10 0c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z"></path>
              </svg>
            </div>
            <h2 className="text-lg font-bold leading-tight tracking-[-0.015em]">电商后台</h2>
          </div>
        }
      />

      <main className="flex-1 mx-auto w-full max-w-[1440px] px-6 py-8 md:px-10">
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">物流与发货管理</h1>
            <div className="flex gap-3">
              <button
                className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
                type="button"
              >
                <span className="material-symbols-outlined text-lg">download</span>
                导出列表
              </button>
              <button
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
                type="button"
              >
                <span className="material-symbols-outlined text-lg">add</span>
                批量更新
              </button>
            </div>
          </div>

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="flex gap-8 border-b border-slate-200 bg-slate-50/50 px-6 dark:border-slate-700 dark:bg-slate-800/40">
              {tabs.map((tab) => {
                const isActive = tab.label === activeStatus;

                return (
                  <button
                    className={`border-b-[3px] pb-[13px] pt-4 text-sm leading-normal transition-colors ${
                      isActive
                        ? 'border-b-primary text-primary'
                        : 'border-b-transparent text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                    }`}
                    key={tab.label}
                    onClick={() => setActiveStatus(tab.label)}
                    type="button"
                  >
                    <span className={isActive ? 'font-bold' : 'font-medium'}>
                      {tab.label}
                      {typeof tab.count === 'number' ? (
                        <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">{tab.count}</span>
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-white text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                    <th className="w-32 px-6 py-4">订单号</th>
                    <th className="w-48 px-6 py-4">客户</th>
                    <th className="w-40 px-6 py-4">订单状态</th>
                    <th className="w-40 px-6 py-4">物流承运商</th>
                    <th className="w-48 px-6 py-4">物流单号</th>
                    <th className="w-40 px-6 py-4">最后更新</th>
                    <th className="w-32 px-6 py-4 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
                  {visibleOrders.map((row) => {
                    const statusStyle = statusStyleMap[row.status];

                    return (
                      <tr className="group transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60" key={row.orderNo}>
                        <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{row.orderNo}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="size-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-medium">
                              {row.customerInitials}
                            </div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-slate-900 dark:text-white">{row.customerName}</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">{row.customerEmail}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium ${statusStyle.wrapper}`}>
                            <span className={`size-1.5 rounded-full ${statusStyle.dot}`}></span>
                            {row.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-700 dark:text-slate-300">{row.carrier ?? '-'}</td>
                        <td className="px-6 py-4">
                          {row.trackingNo ? (
                            <a
                              className="inline-flex items-center gap-1 font-mono text-xs text-primary hover:underline"
                              href="#"
                            >
                              {row.trackingNo}
                              <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                            </a>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{row.lastUpdated}</td>
                        <td className="px-6 py-4 text-right">{renderRowAction(row.action)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 bg-white px-6 py-4 dark:border-slate-700 dark:bg-slate-900">
              <p className="text-sm text-slate-500 dark:text-slate-400">显示 1 至 5 项，共 12 项</p>
              <div className="flex gap-2">
                <button
                  className="cursor-not-allowed rounded border border-slate-200 px-3 py-1 text-sm text-slate-400 dark:border-slate-700"
                  type="button"
                >
                  上一页
                </button>
                <button className="rounded bg-primary px-3 py-1 text-sm font-medium text-white" type="button">
                  1
                </button>
                <button
                  className="rounded border border-slate-200 px-3 py-1 text-sm text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  type="button"
                >
                  2
                </button>
                <button
                  className="rounded border border-slate-200 px-3 py-1 text-sm text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  type="button"
                >
                  3
                </button>
                <button
                  className="rounded border border-slate-200 px-3 py-1 text-sm text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  type="button"
                >
                  下一页
                </button>
              </div>
            </div>
          </section>

          <section className="mt-4 max-w-4xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h2 className="mb-1 text-lg font-bold leading-tight text-slate-900 dark:text-white">快速添加物流</h2>
            <p className="mb-5 text-sm text-slate-500 dark:text-slate-400">为待处理订单手动输入物流单号。</p>

            <div className="flex flex-wrap items-end gap-4">
              <label className="flex min-w-[200px] flex-1 flex-col">
                <p className="mb-1.5 text-sm font-medium leading-normal text-slate-700 dark:text-slate-300">订单号</p>
                <select
                  className="form-select w-full rounded-lg border-slate-300 text-sm text-slate-700 shadow-sm focus:border-primary focus:ring-primary dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                  defaultValue="1001"
                >
                  <option value="">选择订单</option>
                  <option value="1001">#ORD-1001 - Alice Smith</option>
                  <option value="1005">#ORD-1005 - Eve Davis</option>
                </select>
              </label>

              <label className="flex min-w-[200px] flex-1 flex-col">
                <p className="mb-1.5 text-sm font-medium leading-normal text-slate-700 dark:text-slate-300">承运商</p>
                <select
                  className="form-select w-full rounded-lg border-slate-300 text-sm text-slate-700 shadow-sm focus:border-primary focus:ring-primary dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                  defaultValue=""
                >
                  <option value="">选择承运商</option>
                  <option value="fedex">FedEx</option>
                  <option value="ups">UPS</option>
                  <option value="usps">USPS</option>
                  <option value="dhl">DHL</option>
                </select>
              </label>

              <label className="flex min-w-[200px] flex-1 flex-col">
                <p className="mb-1.5 text-sm font-medium leading-normal text-slate-700 dark:text-slate-300">物流单号</p>
                <input
                  className="form-input w-full rounded-lg border-slate-300 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-primary focus:ring-primary dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  placeholder="输入物流单号"
                  defaultValue=""
                />
              </label>

              <button
                className="mb-px h-[42px] rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
                type="button"
              >
                保存
              </button>
            </div>
          </section>
        </div>
      </main>
    </>
  );
};
