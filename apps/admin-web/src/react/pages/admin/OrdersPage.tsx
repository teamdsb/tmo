import { AdminTopbar } from '../../layout/AdminTopbar';

type OrderTab = {
  tab: string;
  label: string;
  count: string;
  isActive?: boolean;
  isReturns?: boolean;
};

type OrderRow = {
  id: string;
  customerName: string;
  customerTier?: string;
  customerInitials: string;
  customerInitialClass: string;
  date: string;
  amount: string;
  statusLabel: string;
  statusTone: 'blue' | 'amber' | 'green' | 'gray';
  paymentStatusLabel: string;
  paymentStatusTone: 'blue' | 'amber' | 'green' | 'gray';
  paymentTransactionId: string;
  isHighlighted?: boolean;
};

type TimelineItem = {
  title: string;
  detail: string;
  isCurrent?: boolean;
};

const orderTabs: readonly OrderTab[] = [
  { tab: 'submitted', label: '已提交', count: '12' },
  { tab: 'confirmed', label: '已确认', count: '4' },
  { tab: 'shipped', label: '已发货', count: '86', isActive: true },
  { tab: 'delivered', label: '已送达', count: '324' },
  { tab: 'returns', label: '退货', count: '2', isReturns: true }
];

const orderRows: readonly OrderRow[] = [
  {
    id: '#ORD-2023-001',
    customerName: '艾丽丝·史密斯',
    customerTier: '高级会员',
    customerInitials: 'AS',
    customerInitialClass: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300',
    date: '2023-10-24',
    amount: '$120.50',
    statusLabel: '运输中',
    statusTone: 'blue',
    paymentStatusLabel: '已支付',
    paymentStatusTone: 'green',
    paymentTransactionId: 'TXN-20260305-001',
    isHighlighted: true
  },
  {
    id: '#ORD-2023-002',
    customerName: '鲍勃·琼斯',
    customerInitials: 'BJ',
    customerInitialClass: 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300',
    date: '2023-10-23',
    amount: '$45.00',
    statusLabel: '已发出',
    statusTone: 'amber',
    paymentStatusLabel: '支付失败',
    paymentStatusTone: 'gray',
    paymentTransactionId: 'TXN-20260305-002'
  },
  {
    id: '#ORD-2023-003',
    customerName: '查理·布朗',
    customerInitials: 'CB',
    customerInitialClass: 'bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300',
    date: '2023-10-23',
    amount: '$89.99',
    statusLabel: '运输中',
    statusTone: 'blue',
    paymentStatusLabel: '待支付',
    paymentStatusTone: 'amber',
    paymentTransactionId: 'TXN-20260305-003'
  },
  {
    id: '#ORD-2023-004',
    customerName: '戴安娜·普林斯',
    customerInitials: 'DP',
    customerInitialClass: 'bg-pink-100 dark:bg-pink-900 text-pink-700 dark:text-pink-300',
    date: '2023-10-22',
    amount: '$210.00',
    statusLabel: '已送达',
    statusTone: 'green',
    paymentStatusLabel: '已支付',
    paymentStatusTone: 'green',
    paymentTransactionId: 'TXN-20260305-004'
  },
  {
    id: '#ORD-2023-005',
    customerName: '埃文·赖特',
    customerInitials: 'EW',
    customerInitialClass: 'bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300',
    date: '2023-10-22',
    amount: '$35.50',
    statusLabel: '待处理',
    statusTone: 'gray',
    paymentStatusLabel: '待创建',
    paymentStatusTone: 'blue',
    paymentTransactionId: 'TXN-20260305-005'
  }
];

const sortingTimeline: readonly TimelineItem[] = [
  { title: '已到达分拨中心', detail: '旧金山，加州 • 今天 10:24', isCurrent: true },
  { title: '已离开发货网点', detail: '奥克兰，加州 • 昨天 20:00' },
  { title: '快递员已揽收', detail: '萨克拉门托，加州 • 2023-10-24 14:30' },
  { title: '订单已处理', detail: '萨克拉门托，加州 • 2023-10-24 09:15' }
];

const statusToneClass: Record<OrderRow['statusTone'], { badge: string; dot: string }> = {
  blue: {
    badge: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    dot: 'bg-blue-600 dark:bg-blue-400'
  },
  amber: {
    badge: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    dot: 'bg-amber-600 dark:bg-amber-400'
  },
  green: {
    badge: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800',
    dot: 'bg-green-600 dark:bg-green-400'
  },
  gray: {
    badge: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700',
    dot: 'bg-gray-500'
  }
};

type StatusBadgeProps = {
  label: string;
  tone: OrderRow['statusTone'];
};

// 订单状态徽标。
const StatusBadge = ({ label, tone }: StatusBadgeProps) => {
  const toneClass = statusToneClass[tone];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${toneClass.badge}`}
    >
      <span className={`size-1.5 rounded-full ${toneClass.dot}`}></span>
      {label}
    </span>
  );
};

type OrderTableRowProps = {
  row: OrderRow;
};

// 订单表格行。
const OrderTableRow = ({ row }: OrderTableRowProps) => {
  return (
    <tr
      className={`group cursor-pointer transition-colors hover:bg-background-light dark:hover:bg-background-dark/50 ${
        row.isHighlighted ? 'bg-primary-light/30 dark:bg-primary/5' : ''
      }`}
    >
      <td className={`px-6 py-4 font-medium ${row.isHighlighted ? 'text-primary' : 'text-text-main dark:text-text-main-dark'}`}>{row.id}</td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <div className={`size-8 rounded-full flex items-center justify-center font-bold text-xs ${row.customerInitialClass}`}>
            {row.customerInitials}
          </div>
          <div>
            <p className="font-medium text-text-main dark:text-text-main-dark">{row.customerName}</p>
            {row.customerTier ? <p className="text-xs text-text-sub dark:text-text-sub-dark">{row.customerTier}</p> : null}
          </div>
        </div>
      </td>
      <td className="px-6 py-4 text-text-sub dark:text-text-sub-dark">{row.date}</td>
      <td className="px-6 py-4 font-medium text-text-main dark:text-text-main-dark">{row.amount}</td>
      <td className="px-6 py-4">
        <StatusBadge label={row.statusLabel} tone={row.statusTone} />
      </td>
      <td className="px-6 py-4">
        <div className="flex flex-col gap-1">
          <StatusBadge label={row.paymentStatusLabel} tone={row.paymentStatusTone} />
          <a
            className="text-xs font-medium text-primary hover:text-primary-dark"
            href={`/payments.html?q=${encodeURIComponent(row.paymentTransactionId)}`}
          >
            {row.paymentTransactionId}
          </a>
        </div>
      </td>
      <td className="px-6 py-4 text-right">
        <button
          className={`text-sm font-medium ${
            row.isHighlighted ? 'text-primary hover:text-primary-dark' : 'text-text-sub hover:text-primary dark:text-text-sub-dark'
          }`}
        >
          查看
        </button>
      </td>
    </tr>
  );
};

type TabLinkProps = {
  tab: OrderTab;
};

// 顶部状态筛选 Tab。
const TabLink = ({ tab }: TabLinkProps) => {
  if (tab.isReturns) {
    return (
      <a
        className="group border-b-2 border-transparent py-4 px-1 text-sm font-medium text-red-500 hover:border-red-500 hover:text-red-600"
        data-role="order-tab"
        data-tab={tab.tab}
        href="#"
      >
        {tab.label}
        <span
          className="ml-2 rounded-full bg-red-50 py-0.5 px-2.5 text-xs font-medium text-red-600 dark:bg-red-900/20 dark:text-red-400"
          data-role="order-tab-count"
        >
          {tab.count}
        </span>
      </a>
    );
  }

  if (tab.isActive) {
    return (
      <a
        aria-current="page"
        className="border-b-2 border-primary py-4 px-1 text-sm font-bold text-primary"
        data-role="order-tab"
        data-tab={tab.tab}
        href="#"
      >
        {tab.label}
        <span className="ml-2 rounded-full bg-primary/10 py-0.5 px-2.5 text-xs font-medium text-primary" data-role="order-tab-count">
          {tab.count}
        </span>
      </a>
    );
  }

  return (
    <a
      className="group border-b-2 border-transparent py-4 px-1 text-sm font-medium text-text-sub hover:border-text-sub hover:text-text-sub-dark dark:text-text-sub-dark dark:hover:text-text-main-dark"
      data-role="order-tab"
      data-tab={tab.tab}
      href="#"
    >
      {tab.label}
      <span
        className="ml-2 rounded-full bg-background-light py-0.5 px-2.5 text-xs font-medium text-text-sub group-hover:bg-gray-200 dark:bg-background-dark dark:text-text-sub-dark dark:group-hover:bg-gray-700"
        data-role="order-tab-count"
      >
        {tab.count}
      </span>
    </a>
  );
};

// 订单页（当前主要承载 React 容器与静态视图）。
export const OrdersPage = () => {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <AdminTopbar
        searchPlaceholder="搜索订单..."
        leftSlot={
          <div className="flex items-center gap-3">
            <div className="size-8 flex items-center justify-center rounded-lg bg-primary text-primary-content">
              <span className="material-symbols-outlined text-xl">local_shipping</span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-text-main dark:text-text-main-dark">订单管理</h2>
          </div>
        }
      />

      <main className="mx-auto flex h-full min-h-0 w-full max-w-[1400px] flex-1 flex-col gap-8 px-6 py-8">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div className="space-y-2">
            <h1 className="text-3xl font-black tracking-tight text-text-main dark:text-text-main-dark md:text-4xl">订单履约</h1>
          </div>
          <a
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-content shadow-sm transition-colors hover:bg-primary-dark active:scale-95"
            href="/import.html"
          >
            <span className="material-symbols-outlined text-[20px]">upload_file</span>
            批量导入物流（Excel）
          </a>
        </div>

        <div className="border-b border-border-light dark:border-border-dark">
          <nav aria-label="Tabs" className="flex gap-8 overflow-x-auto" data-role="order-tabs">
            {orderTabs.map((tab) => (
              <TabLink key={tab.tab} tab={tab} />
            ))}
          </nav>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 items-stretch gap-8 lg:grid-cols-3">
          <div className="flex min-h-0 flex-col gap-4 lg:col-span-2">
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border-light bg-surface-light shadow-sm dark:border-border-dark dark:bg-surface-dark">
              <div className="flex-1 overflow-x-auto">
                <table className="w-full whitespace-nowrap text-left text-sm">
                  <thead className="border-b border-border-light bg-background-light dark:border-border-dark dark:bg-background-dark">
                    <tr>
                      <th className="px-6 py-4 font-semibold text-text-main dark:text-text-main-dark" scope="col">
                        订单号
                      </th>
                      <th className="px-6 py-4 font-semibold text-text-main dark:text-text-main-dark" scope="col">
                        客户
                      </th>
                      <th className="px-6 py-4 font-semibold text-text-main dark:text-text-main-dark" scope="col">
                        日期
                      </th>
                      <th className="px-6 py-4 font-semibold text-text-main dark:text-text-main-dark" scope="col">
                        金额
                      </th>
                      <th className="px-6 py-4 font-semibold text-text-main dark:text-text-main-dark" scope="col">
                        状态
                      </th>
                      <th className="px-6 py-4 font-semibold text-text-main dark:text-text-main-dark" scope="col">
                        支付
                      </th>
                      <th className="px-6 py-4 text-right font-semibold text-text-main dark:text-text-main-dark" scope="col">
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-light dark:divide-border-dark" data-role="orders-body">
                    {orderRows.map((row) => (
                      <OrderTableRow key={row.id} row={row} />
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between border-t border-border-light bg-surface-light px-6 py-4 dark:border-border-dark dark:bg-surface-dark">
                <p className="text-sm text-text-sub dark:text-text-sub-dark" data-role="orders-summary">
                  显示第 <span className="font-medium text-text-main dark:text-text-main-dark">1</span> 到{' '}
                  <span className="font-medium text-text-main dark:text-text-main-dark">5</span> 条，共{' '}
                  <span className="font-medium text-text-main dark:text-text-main-dark">86</span> 条结果
                </p>
                <div className="flex gap-2">
                  <button
                    className="rounded-lg border border-border-light px-3 py-1 text-sm font-medium text-text-sub hover:bg-background-light disabled:opacity-50 dark:border-border-dark dark:text-text-sub-dark dark:hover:bg-background-dark"
                    data-role="orders-prev-page"
                  >
                    上一页
                  </button>
                  <button
                    className="rounded-lg border border-border-light px-3 py-1 text-sm font-medium text-text-sub hover:bg-background-light dark:border-border-dark dark:text-text-sub-dark dark:hover:bg-background-dark"
                    data-role="orders-next-page"
                  >
                    下一页
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex min-h-0 flex-col gap-6 lg:col-span-1">
            <div className="rounded-xl border border-border-light bg-surface-light p-6 shadow-sm dark:border-border-dark dark:bg-surface-dark">
              <div className="mb-6 flex items-center justify-between">
                <h3 className="text-lg font-bold text-text-main dark:text-text-main-dark">物流详情</h3>
                <span className="inline-flex items-center justify-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                  实时
                </span>
              </div>
              <div className="mb-8 flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-border-light bg-gray-50 p-2 dark:border-border-dark dark:bg-gray-800">
                  <img
                    alt="FedEx Logo"
                    className="h-auto w-full object-contain"
                    data-alt="FedEx logo graphic"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuDJAG-x9WX_0_Z7X9ZJIoRnrx8OCtAHphBg7dyWoAi2f5vvoTcQYyc2HYRPuQKUcQgQZRJb5I7HDzq4ZJc7hH5pr5Muy7DRhztsmIoQHo4gfhW03kXtyljFSuJQWXyefxivezCIIMOtGNvHV6nZloIX2HcltENrwV-By06WDRc1SRiFXxHJDoTXhl1P4szpp-QW2nkBcySlspS8uBPL2BcND91NL0_BTWFqSiXv25O6oAN8qF_wTrp9ckshd52XCTmFb89Jo5ReIfE"
                  />
                </div>
                <div>
                  <p className="text-sm font-medium text-text-sub dark:text-text-sub-dark">物流单号</p>
                  <div className="flex items-center gap-2">
                    <p className="text-base font-bold text-text-main dark:text-text-main-dark" data-role="tracking-number">
                      789012349981
                    </p>
                    <button className="text-text-sub hover:text-primary dark:text-text-sub-dark">
                      <span className="material-symbols-outlined text-[16px]">content_copy</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="relative mb-8 h-48 w-full overflow-hidden rounded-lg border border-border-light bg-background-light dark:border-border-dark dark:bg-background-dark">
                <img
                  className="h-full w-full object-cover opacity-80"
                  data-alt="Map showing delivery location in San Francisco"
                  data-location="San Francisco map view"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuDwvx29aG-vbkEfyNaY6v8AT020sDpwc7ALKpfaCFUqfQ3u69kKBzXyZ1oeS9n5ru_uI7o4urPEVRzsFDFg8VbQewPumR68hH6gdzGTvr3gB12zgDWSXK8m1PisDRchUmYL7oOmDSQYAhZlmY95B2YGLYWLLe_aFtQjSKlBVqHIv5ATPOecQ9faPkqhaDzozhCt1dZXdwyT7ll1I8hF9dM3Tn3Lj665Maif-K0JyZc3VvHe-wYUhL9xo3Q5pymvHbz7b0jjeg6c8Ts"
                  style={{
                    backgroundImage:
                      "url('https://lh3.googleusercontent.com/aida-public/AB6AXuCwBUJjVVwWJo4LuEY0-3oM3cdiFja9kIvpvXOro_HzN3XP-UBC1uiKNOZlI0qo24soU41U-t_WEtOE2l7l_rg_krtW7eIpPzLj0Ovt2Q-oDgOSc1BG11of-yalR2ULi4LX2a3sOyiM6zIDcejRvDKNzGyxKZPVtuV_ooRhp8jKgxBu0gtsIFEYEWe6Dpazvif8UpWl6JrTzsDWQnJzKmebuKjJbJkxNEAJdvuDRJh1G_kv7Eh__eTv9f5bmEQDbnlAV-QhIjpORvI')"
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/5">
                  <div className="flex items-center gap-1 rounded-md bg-surface-light p-2 shadow-lg dark:bg-surface-dark">
                    <span className="material-symbols-outlined text-xl text-primary">local_shipping</span>
                    <span className="text-xs font-bold text-text-main dark:text-text-main-dark" data-role="shipping-badge-label">
                      运输途中
                    </span>
                  </div>
                </div>
              </div>

              <div className="relative space-y-8 border-l-2 border-border-light pl-4 dark:border-border-dark" data-role="sorting-timeline">
                {sortingTimeline.map((item) => (
                  <div key={`${item.title}-${item.detail}`} className="relative">
                    {item.isCurrent ? (
                      <span className="absolute -left-[21px] top-1 flex size-3.5 items-center justify-center rounded-full border-2 border-primary bg-surface-light dark:bg-surface-dark">
                        <span className="size-1.5 rounded-full bg-primary"></span>
                      </span>
                    ) : (
                      <span className="absolute -left-[21px] top-1 flex size-3.5 items-center justify-center rounded-full border-2 border-border-light bg-background-light dark:border-border-dark dark:bg-background-dark"></span>
                    )}
                    <div className="flex flex-col gap-1">
                      <p className={`text-sm ${item.isCurrent ? 'font-bold text-text-main dark:text-text-main-dark' : 'font-medium text-text-sub dark:text-text-sub-dark'}`}>
                        {item.title}
                      </p>
                      <p className="text-xs text-text-sub dark:text-text-sub-dark">{item.detail}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 flex gap-3 border-t border-border-light pt-6 dark:border-border-dark">
                <button className="flex-1 rounded-lg border border-border-light bg-surface-light py-2 text-sm font-medium text-text-main transition-colors hover:bg-background-light dark:border-border-dark dark:bg-surface-dark dark:text-text-main-dark dark:hover:bg-background-dark">
                  联系承运商
                </button>
                <button className="flex-1 rounded-lg bg-primary py-2 text-sm font-medium text-primary-content transition-colors hover:bg-primary-dark">
                  下载回执
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-border-light bg-surface-light p-6 shadow-sm dark:border-border-dark dark:bg-surface-dark">
              <h3 className="mb-4 text-sm font-bold tracking-wider text-text-sub uppercase dark:text-text-sub-dark">客户信息</h3>
              <div className="flex items-start gap-4">
                <div className="size-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center font-bold text-blue-700 dark:text-blue-300">
                  AS
                </div>
                <div>
                  <p className="font-bold text-text-main dark:text-text-main-dark" data-role="customer-name">
                    艾丽丝·史密斯
                  </p>
                  <p className="text-sm text-text-sub dark:text-text-sub-dark" data-role="customer-email">
                    alice.smith@example.com
                  </p>
                  <p className="mt-1 text-sm text-text-sub dark:text-text-sub-dark" data-role="customer-phone">
                    +1 (555) 123-4567
                  </p>
                  <div className="mt-3 flex gap-2">
                    <span
                      className="rounded bg-background-light px-2 py-1 text-xs font-medium text-text-sub dark:bg-background-dark dark:text-text-sub-dark"
                      data-role="customer-order-count"
                    >
                      54 个订单
                    </span>
                    <span
                      className="rounded bg-background-light px-2 py-1 text-xs font-medium text-text-sub dark:bg-background-dark dark:text-text-sub-dark"
                      data-role="customer-ltv"
                    >
                      客户累计下单金额 $4.2k
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-4 border-t border-border-light pt-4 dark:border-border-dark">
                <p className="mb-2 text-xs font-medium text-text-sub uppercase dark:text-text-sub-dark">配送备注</p>
                <p className="text-sm italic text-text-main dark:text-text-main-dark" data-role="delivery-note">
                  “若家中无人，请将包裹放在后门门廊。门禁码 1234。”
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
