type HeaderNavItem = {
  label: string;
  href: string;
  active?: boolean;
};

type WorkflowStep = {
  label: string;
  status: 'completed' | 'current' | 'pending';
};

type QuoteVersion = {
  name: string;
  date: string;
  amount: string;
  validUntil: string;
  status: string;
  statusClass: string;
  isCurrent?: boolean;
  isMuted?: boolean;
};

type SummaryLine = {
  label: string;
  value: string;
  isTotal?: boolean;
};

type ChatMessage = {
  sender: string;
  timestamp: string;
  content: string;
  avatar: string;
  self?: boolean;
};

const headerNavItems: readonly HeaderNavItem[] = [
  { label: '仪表盘', href: '/dashboard.html' },
  { label: '询价', href: '/quote-workflow.html', active: true },
  { label: '订单', href: '/orders.html' },
  { label: '库存', href: '/products.html' },
  { label: '设置', href: '/settings.html' }
];

const workflowSteps: readonly WorkflowStep[] = [
  { label: '需求', status: 'completed' },
  { label: '询价', status: 'completed' },
  { label: '已报价', status: 'current' },
  { label: '已确认', status: 'pending' }
];

const quoteVersions: readonly QuoteVersion[] = [
  {
    name: '版本3（当前）',
    date: '2023年10月24日',
    amount: '$12,500.00',
    validUntil: '2023年11月24日',
    status: '生效中',
    statusClass: 'bg-green-100 text-green-800',
    isCurrent: true
  },
  {
    name: '版本2',
    date: '2023年10月20日',
    amount: '$13,200.00',
    validUntil: '2023年11月20日',
    status: '已过期',
    statusClass: 'bg-gray-100 text-gray-800'
  },
  {
    name: '版本1',
    date: '2023年10月15日',
    amount: '$14,000.00',
    validUntil: '2023年11月15日',
    status: '已驳回',
    statusClass: 'bg-red-100 text-red-800',
    isMuted: true
  }
];

const summaryLines: readonly SummaryLine[] = [
  { label: '人体工学办公椅（20件）', value: '$5,000.00' },
  { label: '可升降办公桌（20件）', value: '$6,000.00' },
  { label: '理线配件套装（20件）', value: '$500.00' },
  { label: '运输与服务', value: '$1,000.00' },
  { label: '合计', value: '$12,500.00', isTotal: true }
];

const chatMessages: readonly ChatMessage[] = [
  {
    sender: '莎拉·詹金斯',
    timestamp: '10月21日 10:30',
    content: '可以再看一下运费吗？相比上次订单略高。另外，20件以上是否可以给到批量折扣？',
    avatar:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAZhox9hvuC6sm5nQhaS3PkdHeECohin0OeUv-a5Nwikog2NRYFaCXFd34eKq7geRmN1JNSEGNH5lgybm5oDob-nOKmBPaMmqIWXi0XZ6jsAsypkHP9m095mIvTMnrS55jwWqEOlHmaj3kikdXxP3ELjrCwhgAmE66bBHadw3Aj3Y4ZgStTmRBnOAWOmZ-mUr7P774Chsfxs8Nj4PpgP-ym7TUnk3KnixL6ijq_WEvYKiQH26RM5uS7GNtw3SeTYcIxGA0OCaKr_FY'
  },
  {
    sender: '你',
    timestamp: '10月21日 11:15',
    content: '你好，莎拉，我已更新版本3报价，办公椅给予 5% 折扣。运费部分包含上门安装服务，请确认是否可行。',
    avatar:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuD1be3i3WLXLuKPeHT0q2znKgj8pY30CuJJm8DIE4TkNsCqzNVJhV4BN7e_4cgHJle73Y6Dz-U3uqeWniuwr_FJ5Lja26DhK8Ihz03aBC73PjcO1bvvU1vlLaCsI_ul-TrU2pUrZkG630xPsluQ7TcR9PGNIoe1GW86O4pf6ZBLP9DN3TmlFNwfufmV_hfT2XaAqvh3F4fdTXWwj-uJQHLVx8o7WLHOc7nMk7qqHzrxTm5eo4Ax6_0lm_-Kqhq1AFBIigh6p7utPzo',
    self: true
  },
  {
    sender: '莎拉·詹金斯',
    timestamp: '10月21日 11:45',
    content: '感谢更新！5% 折扣很不错。我今天会和团队确认新的总价。',
    avatar:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuA1jebcSkiMTiveKOPZ-Mp0E49k0m_xyf7cdNdvVm8XG6GZPU0R-9PHIGfrnu2_IRX6f57NZYCCs3sVAyIwfsnQXtm-jScH1Z18VlDvUd2XRjBYV4UapuqaItsLKDfyg3qYMnTgMXpmb5Vkm1vQT8QNLRWjOSQc8MG3i-Oyuw1A7Yo2xJU83R3YLuDSeSJN4VUUQaOUfRgLSehC2O-L1pO2yi0MlFKub-j16D5dNR4drRIHoEzlISbn3yjlNkTVfGwq-wCvTU-W95g'
  }
];

const WorkflowStepBadge = ({ step, index }: { step: WorkflowStep; index: number }) => {
  if (step.status === 'completed') {
    return (
      <div className="relative z-10 flex flex-col items-center gap-2">
        <div className="size-8 flex items-center justify-center rounded-full border-4 border-surface-light bg-primary text-white shadow-sm">
          <span className="material-symbols-outlined text-sm">check</span>
        </div>
        <span className="text-xs font-semibold text-primary">{step.label}</span>
      </div>
    );
  }

  if (step.status === 'current') {
    return (
      <div className="relative z-10 flex flex-col items-center gap-2">
        <div className="size-8 flex items-center justify-center rounded-full border-4 border-surface-light bg-primary text-white shadow-sm ring-4 ring-primary/20">
          <span className="material-symbols-outlined text-sm">more_horiz</span>
        </div>
        <span className="text-xs font-bold text-primary">{step.label}</span>
      </div>
    );
  }

  return (
    <div className="relative z-10 flex flex-col items-center gap-2">
      <div className="size-8 flex items-center justify-center rounded-full border-4 border-surface-light bg-border-light text-text-sub">
        <span className="text-xs font-medium">{index + 1}</span>
      </div>
      <span className="text-xs font-medium text-text-sub">{step.label}</span>
    </div>
  );
};

const QuoteVersionRow = ({ item }: { item: QuoteVersion }) => {
  return (
    <tr
      className={`transition-colors hover:bg-background-light ${
        item.isCurrent ? 'group bg-primary/5 hover:bg-primary/10' : ''
      } ${item.isMuted ? 'opacity-75' : ''}`}
    >
      <td className="px-6 py-4">
        {item.isCurrent ? (
          <div className="flex items-center gap-2">
            <span className="font-semibold text-primary">{item.name}</span>
            <span className="size-2 animate-pulse rounded-full bg-primary"></span>
          </div>
        ) : (
          <span className="font-medium text-text-sub">{item.name}</span>
        )}
      </td>
      <td className="px-6 py-4 text-sm text-text-sub">{item.date}</td>
      <td className={`px-6 py-4 ${item.isCurrent ? 'font-bold text-text-main' : 'text-sm text-text-sub line-through'}`}>{item.amount}</td>
      <td className="px-6 py-4 text-sm text-text-sub">{item.validUntil}</td>
      <td className="px-6 py-4 text-center">
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${item.statusClass}`}>{item.status}</span>
      </td>
      <td className="px-6 py-4 text-right">
        <button className={`text-sm font-medium ${item.isCurrent ? 'text-primary hover:text-primary-dark' : 'text-text-sub hover:text-primary'}`}>
          查看详情
        </button>
      </td>
    </tr>
  );
};

const NegotiationMessage = ({ message }: { message: ChatMessage }) => {
  if (message.self) {
    return (
      <div className="flex flex-row-reverse gap-3">
        <div className="size-8 shrink-0 rounded-full bg-cover bg-center" style={{ backgroundImage: `url('${message.avatar}')` }}></div>
        <div className="flex flex-col items-end">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-xs text-text-sub">{message.timestamp}</span>
            <span className="text-sm font-semibold text-text-main">{message.sender}</span>
          </div>
          <div className="rounded-lg rounded-tr-none border border-primary/10 bg-primary/10 p-3 text-sm text-text-main">{message.content}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <div className="size-8 shrink-0 rounded-full bg-cover bg-center" style={{ backgroundImage: `url('${message.avatar}')` }}></div>
      <div>
        <div className="mb-1 flex items-center gap-2">
          <span className="text-sm font-semibold text-text-main">{message.sender}</span>
          <span className="text-xs text-text-sub">{message.timestamp}</span>
        </div>
        <div className="rounded-lg rounded-tl-none border border-border-light bg-white p-3 text-sm text-text-main shadow-sm">{message.content}</div>
      </div>
    </div>
  );
};

export const QuoteWorkflowPage = () => {
  return (
    <>
      <header className="sticky top-0 z-50 border-b border-border-light bg-surface-light px-6 py-3 shadow-sm">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3 text-primary">
              <div className="size-8 flex items-center justify-center rounded-lg bg-primary/10 text-primary">
                <span className="material-symbols-outlined text-xl">admin_panel_settings</span>
              </div>
              <h2 className="text-lg font-bold leading-tight tracking-tight text-text-main">管理控制台</h2>
            </div>
            <nav className="hidden items-center gap-6 md:flex">
              {headerNavItems.map((item) => (
                <a
                  key={item.href}
                  className={item.active ? 'text-sm font-medium text-primary transition-colors' : 'text-sm font-medium text-text-sub transition-colors hover:text-primary'}
                  href={item.href}
                >
                  {item.label}
                </a>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative hidden w-64 sm:flex">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-sub">
                <span className="material-symbols-outlined text-[20px]">search</span>
              </span>
              <input
                className="w-full rounded-lg border-none bg-background-light py-2 pl-10 pr-4 text-sm placeholder:text-text-sub/50 focus:ring-2 focus:ring-primary/20"
                placeholder="搜索询价单..."
                type="text"
              />
            </div>
            <button className="relative p-2 text-text-sub transition-colors hover:text-primary">
              <span className="material-symbols-outlined">notifications</span>
              <span className="absolute right-1.5 top-1.5 size-2 rounded-full border border-surface-light bg-red-500"></span>
            </button>
            <div
              className="size-9 rounded-full bg-cover bg-center ring-2 ring-primary/10"
              style={{
                backgroundImage:
                  "url('https://lh3.googleusercontent.com/aida-public/AB6AXuD8GClRHtjyM1jxyzUvwXqMOtVFuAk2gsEzEi-kNNeJLSR2a7FMEKFieNQFQ0u96UofIp6NHBe2X06rHdy_4LIkdqI9hWuS0L3TaUZcFjL8vNFrGOPj-ZJBQ7Cmt1Brl7qLUKdFyYDEEPDDXr0VGM2VPxAjTKLbU60KzaFUGPkTCqDBXEhTjMmRYNttugv8MneA97xzdQ8h0otd9ANQldskkerE-GSf07Gt8sQRRuvNMGWK-LZDjNiTkA0ThKnQB-SBC6ppUb9fSEQ')"
              }}
            ></div>
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-[1400px] flex-1 grid-cols-12 gap-8 p-6 md:p-8">
        <div className="col-span-12 flex flex-col gap-8 lg:col-span-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <div className="mb-1 flex items-center gap-3">
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold tracking-wide text-primary uppercase">
                  高优先级
                </span>
                <span className="text-sm text-text-sub">创建于 2023年10月12日</span>
              </div>
              <h1 className="mb-2 text-3xl font-bold tracking-tight text-text-main">询价单 #2023-894</h1>
              <p className="text-lg text-text-sub">办公空间定制家具需求</p>
            </div>
            <div className="flex gap-3">
              <button className="btn-secondary flex items-center gap-2 rounded-lg border border-border-light bg-white px-4 py-2 text-sm font-medium text-text-main transition-colors hover:bg-background-light">
                <span className="material-symbols-outlined text-[18px]">download</span>
                <span>导出文档</span>
              </button>
              <button className="btn-primary flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm shadow-primary/30 transition-colors hover:bg-primary/90">
                <span className="material-symbols-outlined text-[18px]">edit</span>
                <span>编辑需求</span>
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-border-light bg-surface-light p-6 shadow-sm">
            <div className="relative mb-2 flex items-center justify-between">
              <div className="absolute left-0 top-1/2 -z-0 h-1 w-full -translate-y-1/2 bg-background-light"></div>
              <div className="absolute left-0 top-1/2 -z-0 h-1 -translate-y-1/2 bg-primary transition-all duration-500" style={{ width: '66%' }}></div>
              {workflowSteps.map((step, index) => (
                <WorkflowStepBadge key={step.label} index={index} step={step} />
              ))}
            </div>
            <div className="mt-6 flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-text-sub">
                <span className="material-symbols-outlined text-[18px]">schedule</span>
                <span>2小时前更新</span>
              </div>
              <div className="font-medium text-primary">当前状态：待审批</div>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-border-light bg-surface-light shadow-sm">
            <div className="flex items-center justify-between border-b border-border-light bg-background-light/50 px-6 py-4">
              <h3 className="text-lg font-bold text-text-main">报价版本</h3>
              <span className="rounded border border-border-light bg-white px-2 py-1 text-xs font-medium text-text-sub">显示 3 个版本</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-border-light bg-background-light/50 text-xs tracking-wider text-text-sub uppercase">
                    <th className="px-6 py-3 font-semibold">版本</th>
                    <th className="px-6 py-3 font-semibold">发送日期</th>
                    <th className="px-6 py-3 font-semibold">总金额</th>
                    <th className="px-6 py-3 font-semibold">有效期至</th>
                    <th className="px-6 py-3 text-center font-semibold">状态</th>
                    <th className="px-6 py-3 text-right font-semibold">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light">
                  {quoteVersions.map((item) => (
                    <QuoteVersionRow key={item.name} item={item} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-border-light bg-surface-light p-6 shadow-sm">
              <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-text-main">
                <span className="material-symbols-outlined text-text-sub">inventory_2</span>
                明细汇总
              </h3>
              <ul className="space-y-3">
                {summaryLines.map((line) => (
                  <li
                    key={line.label}
                    className={
                      line.isTotal
                        ? 'flex items-center justify-between pt-1 text-base font-bold text-primary'
                        : line.label === '运输与服务'
                          ? 'mt-2 flex items-center justify-between border-t border-border-light pt-3 text-sm'
                          : 'flex items-center justify-between text-sm'
                    }
                  >
                    <span className={line.isTotal ? '' : 'text-text-sub'}>{line.label}</span>
                    <span className={line.isTotal ? '' : 'font-medium text-text-main'}>{line.value}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-border-light bg-surface-light p-6 shadow-sm">
              <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-text-main">
                <span className="material-symbols-outlined text-text-sub">domain</span>
                客户信息
              </h3>
              <div className="mb-4 flex items-center gap-4">
                <div
                  className="size-12 rounded-lg bg-gray-200 bg-cover bg-center"
                  style={{
                    backgroundImage:
                      "url('https://lh3.googleusercontent.com/aida-public/AB6AXuB45YwEH2_s9fKKBRW7agEnOM29AszoywiQOj32aai41L1H0hd9oMPwk54DRvxc-caeRqvpEdHNNPYgG0GULBAyXw7JvdxqHyOvFmuhdY2n7LV5LOekxUh_L78oKMiBqpF6S85FeRMIK3R9ys3UoiQ3bIq2366O_Vx-_sB0JUM8acp-xzcpvndlyoAMH4-DRnkbLAPW5xLePkN5t13VMgGIPOpiRsZXhmtrca1x64zM3f21LEcV5j8_ShXOOz9oHg-kmvxPXU44HPM')"
                  }}
                ></div>
                <div>
                  <p className="font-bold text-text-main">科技空间方案</p>
                  <p className="text-sm text-text-sub">美国旧金山</p>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex gap-2">
                  <span className="material-symbols-outlined text-[18px] text-text-sub">person</span>
                  <span className="text-text-main">莎拉·詹金斯（采购经理）</span>
                </div>
                <div className="flex gap-2">
                  <span className="material-symbols-outlined text-[18px] text-text-sub">mail</span>
                  <a className="text-primary hover:underline" href="#">
                    客户邮箱（已隐藏）
                  </a>
                </div>
                <div className="flex gap-2">
                  <span className="material-symbols-outlined text-[18px] text-text-sub">call</span>
                  <span className="text-text-main">+1 (555) 123-4567</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-span-12 flex flex-col gap-6 lg:col-span-4">
          <div className="sticky top-24 rounded-xl border border-border-light bg-surface-light p-6 shadow-sm">
            <h3 className="mb-4 text-lg font-bold text-text-main">操作</h3>
            <p className="mb-6 text-sm text-text-sub">请审核当前报价（版本3）并进入下一步。</p>
            <div className="flex flex-col gap-3">
              <button className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 font-semibold text-white shadow-md shadow-primary/20 transition-all hover:bg-primary/90">
                <span className="material-symbols-outlined">check_circle</span>批准报价
              </button>
              <button className="flex w-full items-center justify-center gap-2 rounded-lg border border-border-light bg-white px-4 py-3 font-medium text-text-main transition-all hover:bg-background-light">
                <span className="material-symbols-outlined">edit_note</span>请求修改
              </button>
              <button className="flex w-full items-center justify-center gap-2 rounded-lg border border-border-light bg-white px-4 py-3 font-medium text-red-600 transition-all hover:border-red-100 hover:bg-red-50">
                <span className="material-symbols-outlined">cancel</span>驳回
              </button>
            </div>
          </div>

          <div className="flex max-h-[600px] flex-1 flex-col rounded-xl border border-border-light bg-surface-light shadow-sm">
            <div className="flex items-center justify-between border-b border-border-light bg-background-light/30 p-4">
              <h3 className="flex items-center gap-2 font-bold text-text-main">
                <span className="material-symbols-outlined text-text-sub">forum</span>协商记录
              </h3>
              <div className="flex rounded-lg bg-background-light p-0.5">
                <button className="rounded-md bg-white px-3 py-1 text-xs font-medium text-primary shadow-sm">外部</button>
                <button className="rounded-md px-3 py-1 text-xs font-medium text-text-sub hover:text-text-main">内部</button>
              </div>
            </div>
            <div className="flex-1 space-y-6 overflow-y-auto bg-slate-50 p-4">
              {chatMessages.map((message, index) => (
                <NegotiationMessage key={`${message.sender}-${index}`} message={message} />
              ))}
            </div>
            <div className="rounded-b-xl border-t border-border-light bg-surface-light p-4">
              <div className="relative">
                <textarea
                  className="w-full resize-none rounded-lg border-border-light bg-background-light p-3 pr-12 text-sm placeholder:text-text-sub/50 focus:border-primary focus:ring-1 focus:ring-primary"
                  placeholder="输入消息..."
                  rows={3}
                ></textarea>
                <button className="absolute bottom-3 right-3 rounded-md p-1 text-primary transition-colors hover:bg-primary/10">
                  <span className="material-symbols-outlined">send</span>
                </button>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <button className="text-text-sub transition-colors hover:text-primary">
                  <span className="material-symbols-outlined text-[20px]">attach_file</span>
                </button>
                <span className="text-xs text-text-sub">按回车发送</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
};
