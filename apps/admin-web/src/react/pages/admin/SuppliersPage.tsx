import { AdminTopbar } from '../../layout/AdminTopbar';

// 供应商页（当前为前端展示壳）。
export const SuppliersPage = () => {
  return (
    <>
      <div className="relative flex h-auto min-h-screen w-full flex-col overflow-x-hidden">
        <div className="flex h-full grow flex-col">
          <AdminTopbar
            searchPlaceholder="搜索供应商、订单或商品编号..."
            leftSlot={
              <>
                <div className="flex items-center gap-3 text-slate-900 dark:text-white">
                  <div className="size-8 rounded bg-primary/10 text-primary flex items-center justify-center">
                    <span className="material-symbols-outlined">inventory_2</span>
                  </div>
                  <h2 className="text-lg font-bold leading-tight tracking-tight">管理控制台</h2>
                </div>
                <nav className="hidden lg:flex items-center gap-6">
                  <a className="text-slate-500 hover:text-primary text-sm font-medium transition-colors" href="/dashboard.html">仪表盘</a>
                  <a className="text-primary text-sm font-medium bg-primary/5 px-3 py-1.5 rounded-full transition-colors" href="/suppliers.html">供应商</a>
                  <a className="text-slate-500 hover:text-primary text-sm font-medium transition-colors" href="/orders.html">订单</a>
                  <a className="text-slate-500 hover:text-primary text-sm font-medium transition-colors" href="/products.html">库存</a>
                  <a className="text-slate-500 hover:text-primary text-sm font-medium transition-colors" href="/inquiries.html">分析</a>
                </nav>
              </>
            }
          />
          <main className="px-8 py-8 w-full max-w-[1600px] mx-auto flex flex-col gap-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
              <div className="flex flex-col gap-2">
                <h1 className="text-slate-900 text-3xl font-bold tracking-tight">供应商管理</h1>
              </div>
              <div className="flex gap-3">
                <button className="flex items-center justify-center gap-2 rounded-lg h-10 px-4 bg-white border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 shadow-sm transition-colors">
                  <span className="material-symbols-outlined text-[20px]">file_download</span>
                  <span>导出报表</span>
                </button>
                <button className="flex items-center justify-center gap-2 rounded-lg h-10 px-4 bg-primary text-white text-sm font-bold shadow-md hover:bg-blue-700 hover:shadow-lg transition-all">
                  <span className="material-symbols-outlined text-[20px]">add</span>
                  <span>新增供应商</span>
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="flex flex-col gap-1 rounded-xl p-5 bg-white border border-slate-200 shadow-sm relative overflow-hidden group">
                <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <span className="material-symbols-outlined text-6xl text-primary">groups</span>
                </div>
                <p className="text-slate-500 text-sm font-medium">供应商总数</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <p className="text-slate-900 text-3xl font-bold">142</p>
                  <span className="text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded text-xs font-bold flex items-center"><span className="material-symbols-outlined text-[14px]">arrow_upward</span> 5%</span>
                </div>
                <p className="text-slate-400 text-xs mt-2">较上月</p>
              </div>
              <div className="flex flex-col gap-1 rounded-xl p-5 bg-white border border-slate-200 shadow-sm relative overflow-hidden group">
                <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <span className="material-symbols-outlined text-6xl text-primary">verified</span>
                </div>
                <p className="text-slate-500 text-sm font-medium">活跃合作数</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <p className="text-slate-900 text-3xl font-bold">118</p>
                  <span className="text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded text-xs font-bold flex items-center"><span className="material-symbols-outlined text-[14px]">arrow_upward</span> 2%</span>
                </div>
                <p className="text-slate-400 text-xs mt-2">83% 利用率</p>
              </div>
              <div className="flex flex-col gap-1 rounded-xl p-5 bg-white border border-slate-200 shadow-sm relative overflow-hidden group">
                <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <span className="material-symbols-outlined text-6xl text-primary">local_shipping</span>
                </div>
                <p className="text-slate-500 text-sm font-medium">平均交付评分</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <p className="text-slate-900 text-3xl font-bold">94%</p>
                  <span className="text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded text-xs font-bold flex items-center"><span className="material-symbols-outlined text-[14px]">arrow_upward</span> 1.5%</span>
                </div>
                <p className="text-slate-400 text-xs mt-2">准时足量交付率</p>
              </div>
              <div className="flex flex-col gap-1 rounded-xl p-5 bg-white border border-slate-200 shadow-sm relative overflow-hidden group">
                <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <span className="material-symbols-outlined text-6xl text-primary">request_quote</span>
                </div>
                <p className="text-slate-500 text-sm font-medium">待处理报价</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <p className="text-slate-900 text-3xl font-bold">23</p>
                  <span className="text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded text-xs font-bold flex items-center"><span className="material-symbols-outlined text-[14px]">remove</span> 0%</span>
                </div>
                <p className="text-slate-400 text-xs mt-2">需关注</p>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-slate-900 text-lg font-bold">交付绩效趋势</h3>
                    <p className="text-slate-500 text-sm">近 6 个月供应商准时足量交付率汇总</p>
                  </div>
                  <select className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2">
                    <option>近6个月</option>
                    <option>近1年</option>
                  </select>
                </div>
                <div className="relative h-64 w-full flex items-end justify-between gap-2 px-2">
                  <div className="absolute inset-0 flex flex-col justify-between pointer-events-none z-0">
                    <div className="w-full h-px bg-slate-100" /><div className="w-full h-px bg-slate-100" /><div className="w-full h-px bg-slate-100" /><div className="w-full h-px bg-slate-100" /><div className="w-full h-px bg-slate-100" />
                  </div>
                  <div className="relative z-10 flex-1 flex flex-col items-center group cursor-pointer"><div className="w-full max-w-[40px] bg-primary/20 h-[60%] rounded-t-sm group-hover:bg-primary/30 transition-all relative"><div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs px-2 py-1 rounded transition-opacity whitespace-nowrap">82%</div></div><span className="text-xs text-slate-500 mt-2">1月</span></div>
                  <div className="relative z-10 flex-1 flex flex-col items-center group cursor-pointer"><div className="w-full max-w-[40px] bg-primary/30 h-[75%] rounded-t-sm group-hover:bg-primary/40 transition-all relative"><div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs px-2 py-1 rounded transition-opacity whitespace-nowrap">88%</div></div><span className="text-xs text-slate-500 mt-2">2月</span></div>
                  <div className="relative z-10 flex-1 flex flex-col items-center group cursor-pointer"><div className="w-full max-w-[40px] bg-primary/40 h-[65%] rounded-t-sm group-hover:bg-primary/50 transition-all relative"><div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs px-2 py-1 rounded transition-opacity whitespace-nowrap">85%</div></div><span className="text-xs text-slate-500 mt-2">3月</span></div>
                  <div className="relative z-10 flex-1 flex flex-col items-center group cursor-pointer"><div className="w-full max-w-[40px] bg-primary/60 h-[85%] rounded-t-sm group-hover:bg-primary/70 transition-all relative"><div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs px-2 py-1 rounded transition-opacity whitespace-nowrap">91%</div></div><span className="text-xs text-slate-500 mt-2">4月</span></div>
                  <div className="relative z-10 flex-1 flex flex-col items-center group cursor-pointer"><div className="w-full max-w-[40px] bg-primary/80 h-[90%] rounded-t-sm group-hover:bg-primary/90 transition-all relative"><div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs px-2 py-1 rounded transition-opacity whitespace-nowrap">93%</div></div><span className="text-xs text-slate-500 mt-2">5月</span></div>
                  <div className="relative z-10 flex-1 flex flex-col items-center group cursor-pointer"><div className="w-full max-w-[40px] bg-primary h-[94%] rounded-t-sm group-hover:bg-blue-700 transition-all relative shadow-lg shadow-primary/20"><div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs px-2 py-1 rounded transition-opacity whitespace-nowrap">94%</div></div><span className="text-xs text-slate-500 mt-2 font-bold text-primary">6月</span></div>
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col gap-6">
                <div>
                  <h3 className="text-slate-900 text-lg font-bold">价格偏差</h3>
                  <p className="text-slate-500 text-sm mb-4">对比市场均值</p>
                  <div className="flex items-center gap-4">
                    <div className="flex-1 bg-slate-100 h-2 rounded-full overflow-hidden"><div className="bg-emerald-500 h-full w-[65%]" /></div>
                    <span className="text-sm font-bold text-slate-900">-2.3%</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-2">当前供应商价格低于市场平均水平。</p>
                </div>
                <div className="h-px bg-slate-100" />
                <div>
                  <h3 className="text-slate-900 text-lg font-bold">风险评估</h3>
                  <p className="text-slate-500 text-sm mb-4">供应商稳定性指数</p>
                  <div className="flex gap-2">
                    <div className="flex-1 flex flex-col gap-1 items-center p-3 rounded-lg bg-emerald-50 border border-emerald-100"><span className="text-emerald-700 font-bold text-xl">112</span><span className="text-emerald-600 text-xs">低风险</span></div>
                    <div className="flex-1 flex flex-col gap-1 items-center p-3 rounded-lg bg-amber-50 border border-amber-100"><span className="text-amber-700 font-bold text-xl">24</span><span className="text-amber-600 text-xs">中风险</span></div>
                    <div className="flex-1 flex flex-col gap-1 items-center p-3 rounded-lg bg-red-50 border border-red-100"><span className="text-red-700 font-bold text-xl">6</span><span className="text-red-600 text-xs">高风险</span></div>
                  </div>
                </div>
                <div className="mt-auto"><button className="w-full text-primary text-sm font-semibold hover:bg-primary/5 py-2 rounded-lg transition-colors">查看风险明细</button></div>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-slate-900 text-lg font-bold">供应商名录</h3>
                  <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2 py-0.5 rounded-full">142</span>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                  <button className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50"><span className="material-symbols-outlined text-[18px]">filter_list</span><span>筛选</span></button>
                  <button className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50"><span className="material-symbols-outlined text-[18px]">sort</span><span>排序</span></button>
                  <div className="relative flex-1 md:w-64"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 material-symbols-outlined text-[18px]">search</span><input className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:bg-white transition-all" placeholder="搜索供应商名称..." type="text" /></div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500 font-semibold tracking-wider">
                      <th className="px-6 py-4">供应商档案</th>
                      <th className="px-6 py-4">品类</th>
                      <th className="px-6 py-4 text-center">状态</th>
                      <th className="px-6 py-4 text-center">评分</th>
                      <th className="px-6 py-4">最近报价</th>
                      <th className="px-6 py-4 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    <tr className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4"><div className="flex items-center gap-3"><div className="size-10 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm shrink-0">环</div><div><p className="text-sm font-bold text-slate-900">环球科技方案</p><p className="text-xs text-slate-500">美国圣何塞 • 编号 #88392</p></div></div></td>
                      <td className="px-6 py-4"><div className="flex flex-wrap gap-1"><span className="inline-flex items-center px-2 py-1 rounded bg-slate-100 text-slate-600 text-xs font-medium">电子</span><span className="inline-flex items-center px-2 py-1 rounded bg-slate-100 text-slate-600 text-xs font-medium">芯片</span></div></td>
                      <td className="px-6 py-4 text-center"><span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold"><span className="size-1.5 rounded-full bg-emerald-600" /> 合作中</span></td>
                      <td className="px-6 py-4 text-center"><div className="flex flex-col items-center"><span className="text-sm font-bold text-slate-900">98%</span><div className="w-16 h-1 bg-slate-200 rounded-full mt-1"><div className="h-full w-[98%] bg-emerald-500 rounded-full" /></div></div></td>
                      <td className="px-6 py-4"><div className="text-sm text-slate-900">$12,450.00</div><div className="text-xs text-slate-500">2天前</div></td>
                      <td className="px-6 py-4 text-right"><button className="text-slate-400 hover:text-primary transition-colors p-1"><span className="material-symbols-outlined text-[20px]">more_vert</span></button></td>
                    </tr>
                    <tr className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4"><div className="flex items-center gap-3"><div className="size-10 rounded-lg bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-sm shrink-0">顶</div><div><p className="text-sm font-bold text-slate-900">顶点高分子材料</p><p className="text-xs text-slate-500">美国休斯敦 • 编号 #44210</p></div></div></td>
                      <td className="px-6 py-4"><div className="flex flex-wrap gap-1"><span className="inline-flex items-center px-2 py-1 rounded bg-slate-100 text-slate-600 text-xs font-medium">原材料</span><span className="inline-flex items-center px-2 py-1 rounded bg-slate-100 text-slate-600 text-xs font-medium">塑料</span></div></td>
                      <td className="px-6 py-4 text-center"><span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-bold"><span className="size-1.5 rounded-full bg-amber-600" /> 暂停合作</span></td>
                      <td className="px-6 py-4 text-center"><div className="flex flex-col items-center"><span className="text-sm font-bold text-slate-900">74%</span><div className="w-16 h-1 bg-slate-200 rounded-full mt-1"><div className="h-full w-[74%] bg-amber-500 rounded-full" /></div></div></td>
                      <td className="px-6 py-4"><div className="text-sm text-slate-900">$4,200.00</div><div className="text-xs text-slate-500">3周前</div></td>
                      <td className="px-6 py-4 text-right"><button className="text-slate-400 hover:text-primary transition-colors p-1"><span className="material-symbols-outlined text-[20px]">more_vert</span></button></td>
                    </tr>
                    <tr className="hover:bg-slate-50/50 transition-colors group bg-primary/5">
                      <td className="px-6 py-4 border-l-4 border-l-primary"><div className="flex items-center gap-3"><img alt="公司标识" className="size-10 rounded-lg object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDH8iwNEofFPtUefGaZOQKqUfQvLciZ26AUCbcvycvG67sEpBKIMJBHaaHQ7MhRyiGIH6NvlrhAACBkv9ZGsbiL3zGEeU_m6BobTmpAmT4hGqMwnJOqNP5_r-W1yBr4Th5GP4nXY2IdGHeaRQ6p69yXGxU4PvlDWDxkDSMA3rDUpEFKSyiy55YbJZ8sP3A5Flf-Q5-7-DWmjxDPUCs6mLlcB2rwsGzWs2dlgo5lZtFqWM1JFJAqP225-jwDQM_1bhKU_NqyE6zOjS4" /><div><p className="text-sm font-bold text-slate-900">子午线物流</p><p className="text-xs text-slate-500">德国汉堡 • 编号 #99102</p></div></div></td>
                      <td className="px-6 py-4"><div className="flex flex-wrap gap-1"><span className="inline-flex items-center px-2 py-1 rounded bg-slate-100 text-slate-600 text-xs font-medium">运输</span><span className="inline-flex items-center px-2 py-1 rounded bg-slate-100 text-slate-600 text-xs font-medium">货运</span></div></td>
                      <td className="px-6 py-4 text-center"><span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold"><span className="size-1.5 rounded-full bg-emerald-600" /> 合作中</span></td>
                      <td className="px-6 py-4 text-center"><div className="flex flex-col items-center"><span className="text-sm font-bold text-slate-900">92%</span><div className="w-16 h-1 bg-slate-200 rounded-full mt-1"><div className="h-full w-[92%] bg-emerald-500 rounded-full" /></div></div></td>
                      <td className="px-6 py-4"><div className="text-sm text-slate-900">$85,000.00</div><div className="text-xs text-slate-500">昨天</div></td>
                      <td className="px-6 py-4 text-right"><button className="text-slate-400 hover:text-primary transition-colors p-1"><span className="material-symbols-outlined text-[20px]">more_vert</span></button></td>
                    </tr>
                    <tr className="bg-slate-50/50">
                      <td className="px-6 py-6" colSpan={6}>
                        <div className="flex flex-col lg:flex-row gap-6 bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                          <div className="lg:w-1/3 flex flex-col gap-4 border-b lg:border-b-0 lg:border-r border-slate-100 pb-4 lg:pb-0 lg:pr-6">
                            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide">联系信息</h4>
                            <div className="flex flex-col gap-3">
                              <div className="flex items-start gap-3"><span className="material-symbols-outlined text-slate-400 text-[20px] mt-0.5">person</span><div><p className="text-sm font-medium text-slate-900">汉斯·韦伯</p><p className="text-xs text-slate-500">高级客户经理</p></div></div>
                              <div className="flex items-center gap-3"><span className="material-symbols-outlined text-slate-400 text-[20px]">mail</span><p className="text-sm text-slate-600">联系邮箱（已隐藏）</p></div>
                              <div className="flex items-center gap-3"><span className="material-symbols-outlined text-slate-400 text-[20px]">call</span><p className="text-sm text-slate-600">+49 40 3389 1200</p></div>
                              <div className="flex items-start gap-3"><span className="material-symbols-outlined text-slate-400 text-[20px] mt-0.5">location_on</span><p className="text-sm text-slate-600">德国汉堡港区</p></div>
                            </div>
                            <div className="mt-auto pt-4"><button className="w-full py-2 px-3 bg-white border border-slate-300 hover:border-slate-400 text-slate-700 text-sm font-medium rounded-lg transition-colors shadow-sm">查看完整档案</button></div>
                          </div>
                          <div className="lg:w-1/3 flex flex-col gap-4 border-b lg:border-b-0 lg:border-r border-slate-100 pb-4 lg:pb-0 lg:pr-6">
                            <div className="flex justify-between items-center"><h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide">报价历史</h4><a className="text-xs text-primary font-medium hover:underline" href="#">查看全部</a></div>
                            <div className="flex flex-col gap-3">
                              <div className="flex justify-between items-center p-2 rounded bg-slate-50 border border-slate-100"><div className="flex flex-col"><span className="text-xs font-bold text-slate-900">报价单-2023-889</span><span className="text-[10px] text-slate-500">2023年10月24日</span></div><div className="text-right"><span className="text-xs font-medium text-slate-900">$85,000.00</span><span className="block text-[10px] text-emerald-600">已批准</span></div></div>
                              <div className="flex justify-between items-center p-2 rounded bg-slate-50 border border-slate-100"><div className="flex flex-col"><span className="text-xs font-bold text-slate-900">报价单-2023-742</span><span className="text-[10px] text-slate-500">2023年9月12日</span></div><div className="text-right"><span className="text-xs font-medium text-slate-900">$12,400.00</span><span className="block text-[10px] text-emerald-600">已履约</span></div></div>
                              <div className="flex justify-between items-center p-2 rounded bg-slate-50 border border-slate-100"><div className="flex flex-col"><span className="text-xs font-bold text-slate-900">报价单-2023-550</span><span className="text-[10px] text-slate-500">2023年8月5日</span></div><div className="text-right"><span className="text-xs font-medium text-slate-900">$3,200.00</span><span className="block text-[10px] text-slate-500">已过期</span></div></div>
                            </div>
                          </div>
                          <div className="lg:w-1/3 flex flex-col gap-4">
                            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide">绩效指标</h4>
                            <div className="space-y-4">
                              <div><div className="flex justify-between text-xs mb-1"><span className="text-slate-500">质量控制</span><span className="text-slate-900 font-bold">98/100</span></div><div className="w-full bg-slate-100 rounded-full h-1.5"><div className="bg-primary h-1.5 rounded-full" style={{width: '98%'}} /></div></div>
                              <div><div className="flex justify-between text-xs mb-1"><span className="text-slate-500">沟通协作</span><span className="text-slate-900 font-bold">4.5/5</span></div><div className="flex text-amber-400 text-[14px]"><span className="material-symbols-outlined filled text-[16px]">star</span><span className="material-symbols-outlined filled text-[16px]">star</span><span className="material-symbols-outlined filled text-[16px]">star</span><span className="material-symbols-outlined filled text-[16px]">star</span><span className="material-symbols-outlined filled text-[16px]">star_half</span></div></div>
                              <div><div className="flex justify-between text-xs mb-1"><span className="text-slate-500">价格竞争力</span><span className="text-slate-900 font-bold">高</span></div><div className="w-full bg-slate-100 rounded-full h-1.5"><div className="bg-emerald-500 h-1.5 rounded-full" style={{width: '85%'}} /></div></div>
                            </div>
                            <div className="mt-auto flex gap-2"><button className="flex-1 py-2 bg-primary text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-colors">发起询价</button><button className="px-3 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"><span className="material-symbols-outlined text-[18px]">chat</span></button></div>
                          </div>
                        </div>
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4"><div className="flex items-center gap-3"><div className="size-10 rounded-lg bg-teal-100 flex items-center justify-center text-teal-600 font-bold text-sm shrink-0">北</div><div><p className="text-sm font-bold text-slate-900">北辰制造</p><p className="text-xs text-slate-500">加拿大多伦多 • 编号 #33219</p></div></div></td>
                      <td className="px-6 py-4"><div className="flex flex-wrap gap-1"><span className="inline-flex items-center px-2 py-1 rounded bg-slate-100 text-slate-600 text-xs font-medium">纺织</span></div></td>
                      <td className="px-6 py-4 text-center"><span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-100 text-red-700 text-xs font-bold"><span className="size-1.5 rounded-full bg-red-600" /> 已终止</span></td>
                      <td className="px-6 py-4 text-center"><div className="flex flex-col items-center"><span className="text-sm font-bold text-slate-900">42%</span><div className="w-16 h-1 bg-slate-200 rounded-full mt-1"><div className="h-full w-[42%] bg-red-500 rounded-full" /></div></div></td>
                      <td className="px-6 py-4"><div className="text-sm text-slate-900">$1,100.00</div><div className="text-xs text-slate-500">6个月前</div></td>
                      <td className="px-6 py-4 text-right"><button className="text-slate-400 hover:text-primary transition-colors p-1"><span className="material-symbols-outlined text-[20px]">more_vert</span></button></td>
                    </tr>
                    <tr className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4"><div className="flex items-center gap-3"><div className="size-10 rounded-lg bg-purple-100 flex items-center justify-center text-purple-600 font-bold text-sm shrink-0">量</div><div><p className="text-sm font-bold text-slate-900">量子零件</p><p className="text-xs text-slate-500">中国深圳 • 编号 #99321</p></div></div></td>
                      <td className="px-6 py-4"><div className="flex flex-wrap gap-1"><span className="inline-flex items-center px-2 py-1 rounded bg-slate-100 text-slate-600 text-xs font-medium">电子</span><span className="inline-flex items-center px-2 py-1 rounded bg-slate-100 text-slate-600 text-xs font-medium">电路板</span></div></td>
                      <td className="px-6 py-4 text-center"><span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold"><span className="size-1.5 rounded-full bg-emerald-600" /> 合作中</span></td>
                      <td className="px-6 py-4 text-center"><div className="flex flex-col items-center"><span className="text-sm font-bold text-slate-900">88%</span><div className="w-16 h-1 bg-slate-200 rounded-full mt-1"><div className="h-full w-[88%] bg-emerald-500 rounded-full" /></div></div></td>
                      <td className="px-6 py-4"><div className="text-sm text-slate-900">$34,220.00</div><div className="text-xs text-slate-500">1周前</div></td>
                      <td className="px-6 py-4 text-right"><button className="text-slate-400 hover:text-primary transition-colors p-1"><span className="material-symbols-outlined text-[20px]">more_vert</span></button></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="border-t border-slate-200 px-6 py-4 flex items-center justify-between bg-slate-50">
                <p className="text-xs text-slate-500">显示 <span className="font-bold">1-5</span> / 共 <span className="font-bold">142</span> 个供应商</p>
                <div className="flex gap-2">
                  <button className="px-3 py-1 text-xs font-medium text-slate-500 bg-white border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50">上一页</button>
                  <button className="px-3 py-1 text-xs font-medium text-white bg-primary border border-primary rounded hover:bg-blue-700">1</button>
                  <button className="px-3 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded hover:bg-slate-50">2</button>
                  <button className="px-3 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded hover:bg-slate-50">3</button>
                  <span className="px-2 py-1 text-xs text-slate-400">...</span>
                  <button className="px-3 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded hover:bg-slate-50">12</button>
                  <button className="px-3 py-1 text-xs font-medium text-slate-500 bg-white border border-slate-200 rounded hover:bg-slate-50">下一页</button>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
      
    </>
  );
};
