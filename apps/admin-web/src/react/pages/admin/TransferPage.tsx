import { AdminTopbar } from '../../layout/AdminTopbar';

const transferMetrics = [
  { label: '已选中', value: '12' },
  { label: '客户终身价值总额', value: '$145,200' },
  { label: '待处理订单', value: '3' },
  { label: '平均忠诚度', value: '8.5' }
] as const;

const transferRows = [
  { initial: '张', initialClass: 'bg-purple-100 text-purple-600', name: '约翰·多伊', from: '莎拉·詹金斯', to: '迈克尔·罗斯', value: '$12,450' },
  { initial: '艾', initialClass: 'bg-orange-100 text-orange-600', name: '艾丽丝·史密斯', from: '莎拉·詹金斯', to: '迈克尔·罗斯', value: '$8,320' },
  { initial: '罗', initialClass: 'bg-teal-100 text-teal-600', name: '罗伯特·布朗', from: '莎拉·詹金斯', to: '迈克尔·罗斯', value: '$45,100' }
] as const;

const activityItems = [
  { title: '已发起转移', subtitle: '今天 10:23（管理员）', active: true },
  { title: '客户已选中', subtitle: '今天 10:15', active: false },
  { title: '已应用批量筛选', subtitle: '今天 10:10', active: false }
] as const;

export const TransferPage = () => {
  return (
    <>
      <AdminTopbar
        searchPlaceholder="搜索客户、订单、销售代表..."
        leftSlot={
          <div className="flex items-center gap-3 text-primary dark:text-blue-400">
            <span className="material-symbols-outlined text-3xl">admin_panel_settings</span>
            <h2 className="text-lg font-bold leading-tight tracking-tight text-text-primary-light dark:text-text-primary-dark">管理</h2>
          </div>
        }
      />

      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8 md:px-10 lg:px-20">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-text-primary-light dark:text-text-primary-dark">转移客户归属</h1>
        </div>

        <div className="mb-10 rounded-xl border border-border-light bg-surface-light p-6 shadow-sm dark:border-border-dark dark:bg-surface-dark">
          <div className="relative mx-auto flex w-full max-w-4xl items-center justify-between">
            <div className="absolute top-1/2 left-0 -z-0 h-0.5 w-full bg-border-light dark:bg-border-dark"></div>
            <div className="group relative z-10 flex cursor-pointer flex-col items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500 text-sm font-bold text-white shadow-md">
                <span className="material-symbols-outlined text-lg">check</span>
              </div>
              <span className="text-xs font-semibold text-green-600 dark:text-green-400">选择客户</span>
            </div>
            <div className="relative z-10 flex flex-col items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-white shadow-md ring-4 ring-blue-100 dark:ring-blue-900/30">
                2
              </div>
              <span className="text-xs font-bold text-primary dark:text-blue-400">核验与原因</span>
            </div>
            <div className="relative z-10 flex flex-col items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-border-light bg-surface-light text-sm font-bold text-text-secondary-light dark:border-border-dark dark:bg-surface-dark dark:text-text-secondary-dark">
                3
              </div>
              <span className="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark">确认转移</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="space-y-8 lg:col-span-2">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {transferMetrics.map((metric) => (
                <div
                  key={metric.label}
                  className="rounded-xl border border-border-light bg-surface-light p-4 shadow-sm dark:border-border-dark dark:bg-surface-dark"
                >
                  <p className="mb-1 text-xs font-medium tracking-wider text-text-secondary-light uppercase dark:text-text-secondary-dark">
                    {metric.label}
                  </p>
                  <p className="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark">{metric.value}</p>
                </div>
              ))}
            </div>

            <div className="overflow-hidden rounded-xl border border-border-light bg-surface-light shadow-sm dark:border-border-dark dark:bg-surface-dark">
              <div className="flex items-center justify-between border-b border-border-light bg-gray-50/50 px-6 py-4 dark:border-border-dark dark:bg-gray-900/50">
                <h3 className="font-semibold text-text-primary-light dark:text-text-primary-dark">转移校验</h3>
                <span className="rounded bg-blue-100 px-2 py-1 text-xs font-medium text-primary dark:bg-blue-900/40 dark:text-blue-300">
                  批量操作
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border-light bg-gray-50 font-medium text-text-secondary-light dark:border-border-dark dark:bg-gray-800/50 dark:text-text-secondary-dark">
                    <tr>
                      <th className="px-6 py-3">客户名称</th>
                      <th className="px-6 py-3">当前负责人</th>
                      <th className="px-6 py-3 text-center">
                        <span className="material-symbols-outlined align-middle text-base">arrow_forward</span>
                      </th>
                      <th className="px-6 py-3">目标负责人</th>
                      <th className="px-6 py-3 text-right">客户终身价值</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-light dark:divide-border-dark">
                    {transferRows.map((row) => (
                      <tr key={row.name} className="group transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/30">
                        <td className="flex items-center gap-3 px-6 py-4 font-medium text-text-primary-light dark:text-text-primary-dark">
                          <div className={`h-8 w-8 rounded-full ${row.initialClass} flex items-center justify-center text-xs font-bold`}>
                            {row.initial}
                          </div>
                          {row.name}
                        </td>
                        <td className="px-6 py-4 text-text-secondary-light dark:text-text-secondary-dark">{row.from}</td>
                        <td className="px-6 py-4 text-center text-text-secondary-light/50">
                          <span className="material-symbols-outlined text-sm">arrow_right_alt</span>
                        </td>
                        <td className="px-6 py-4 font-medium text-primary">{row.to}</td>
                        <td className="px-6 py-4 text-right text-text-primary-light dark:text-text-primary-dark">{row.value}</td>
                      </tr>
                    ))}
                    <tr>
                      <td
                        className="bg-gray-50/50 px-6 py-3 text-center text-xs font-medium text-text-secondary-light dark:bg-gray-800/20 dark:text-text-secondary-dark"
                        colSpan={5}
                      >
                        + 9 位更多客户
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-xl border border-border-light bg-surface-light p-6 shadow-sm dark:border-border-dark dark:bg-surface-dark">
              <h3 className="mb-4 flex items-center gap-2 font-semibold text-text-primary-light dark:text-text-primary-dark">
                <span className="material-symbols-outlined text-primary">edit_note</span>
                转移详情
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark">
                    转移原因
                  </label>
                  <select className="w-full rounded-lg border-border-light bg-background-light text-sm text-text-primary-light focus:border-primary focus:ring-primary dark:border-border-dark dark:bg-background-dark dark:text-text-primary-dark">
                    <option>员工离职</option>
                    <option>区域重分配</option>
                    <option>负载均衡</option>
                    <option>绩效问题</option>
                    <option>其他</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark">
                    补充说明
                  </label>
                  <textarea
                    className="w-full rounded-lg border-border-light bg-background-light text-sm text-text-primary-light placeholder:text-text-secondary-light/50 focus:border-primary focus:ring-primary dark:border-border-dark dark:bg-background-dark dark:text-text-primary-dark"
                    placeholder="请补充新负责人所需的具体背景信息..."
                    rows={4}
                  ></textarea>
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <input
                    className="rounded border-border-light bg-background-light text-primary focus:ring-primary dark:border-border-dark dark:bg-background-dark"
                    id="notify"
                    type="checkbox"
                  />
                  <label className="text-sm text-text-primary-light dark:text-text-primary-dark" htmlFor="notify">
                    通过邮件通知客户
                  </label>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border-light bg-surface-light p-6 shadow-sm dark:border-border-dark dark:bg-surface-dark">
              <h3 className="mb-4 text-sm font-semibold tracking-wide text-text-primary-light uppercase dark:text-text-primary-dark">
                最近活动
              </h3>
              <div className="relative space-y-6 border-l-2 border-border-light pl-4 dark:border-border-dark">
                {activityItems.map((item) => (
                  <div key={item.title} className="relative">
                    <div
                      className={`absolute -left-[21px] top-1 h-3 w-3 rounded-full border-2 border-surface-light dark:border-surface-dark ${
                        item.active ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    ></div>
                    <p
                      className={`text-sm font-medium ${
                        item.active ? 'text-text-primary-light dark:text-text-primary-dark' : 'text-text-secondary-light dark:text-text-secondary-dark'
                      }`}
                    >
                      {item.title}
                    </p>
                    <p className="mt-0.5 text-xs text-text-secondary-light dark:text-text-secondary-dark">{item.subtitle}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-2">
              <button className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 font-medium text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-700">
                <span>复核并确认</span>
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </button>
              <button className="w-full rounded-lg border border-transparent bg-transparent px-4 py-3 font-medium text-text-secondary-light transition-all hover:border-border-light hover:bg-gray-100 dark:text-text-secondary-dark dark:hover:border-border-dark dark:hover:bg-gray-800">
                取消
              </button>
            </div>
          </div>
        </div>
      </main>
    </>
  );
};
