import { AdminTopbar } from '../../layout/AdminTopbar';

export const InquiriesPage = () => {
  return (
    <>
      <div>
        <AdminTopbar
          searchPlaceholder="按订单号、客户或商品搜索..."
          leftSlot={
            <div className="flex items-center gap-3 text-primary dark:text-blue-400">
              <span className="material-symbols-outlined text-3xl">inventory_2</span>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">需求订单后台</h1>
            </div>
          }
        />
        <div className="flex flex-1 overflow-hidden">
          <main className="flex-1 overflow-hidden flex flex-col md:flex-row bg-background-light dark:bg-background-dark">
            <div className="w-full md:w-80 lg:w-96 border-r border-border-color bg-surface-light dark:bg-surface-dark flex flex-col h-full">
              <div className="p-4 border-b border-border-color">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-lg text-slate-800 dark:text-white">需求列表</h2>
                  <button className="text-primary hover:bg-primary/10 p-1.5 rounded-lg transition-colors">
                    <span className="material-symbols-outlined text-xl">filter_list</span>
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    className="bg-primary text-white text-xs px-3 py-1.5 rounded-full font-medium shadow-sm hover:shadow-md transition-all"
                    data-role="inquiry-status-filter"
                    data-status="IN_PROGRESS"
                  >
                    进行中
                  </button>
                  <button
                    className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs px-3 py-1.5 rounded-full font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                    data-role="inquiry-status-filter"
                    data-status="PENDING"
                  >
                    待处理
                  </button>
                  <button
                    className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs px-3 py-1.5 rounded-full font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                    data-role="inquiry-status-filter"
                    data-status="CLOSED"
                  >
                    已关闭
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto" data-role="inquiry-list">
                <div className="p-4 border-b border-border-color bg-primary/5 border-l-4 border-l-primary cursor-pointer" data-role="inquiry-list-item" data-inquiry-status="IN_PROGRESS">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-xs font-bold text-primary">#2024-8932</span>
                    <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold border border-red-200">高优先级</span>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1 line-clamp-1">批量采购：机械键盘</h3>
                  <p className="text-xs text-text-sub line-clamp-2 mb-2">需求 500 套定制配列机械键盘，使用高品质机械轴体...</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px] font-bold">技</div>
                      <span className="text-xs text-slate-500">科技方案公司</span>
                    </div>
                    <span className="text-[10px] text-slate-400">2小时前</span>
                  </div>
                </div>
                <div className="p-4 border-b border-border-color hover:bg-background-light dark:hover:bg-slate-800 cursor-pointer transition-colors border-l-4 border-l-transparent" data-role="inquiry-list-item" data-inquiry-status="PENDING">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-xs font-medium text-slate-500">#2024-8930</span>
                    <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold border border-amber-200">中优先级</span>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1 line-clamp-1">办公椅人体工学方案</h3>
                  <p className="text-xs text-text-sub line-clamp-2 mb-2">需要 50 把高端人体工学办公椅报价，用于新的旧金山办公室...</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-[10px] font-bold">环</div>
                      <span className="text-xs text-slate-500">环球企业</span>
                    </div>
                    <span className="text-[10px] text-slate-400">5小时前</span>
                  </div>
                </div>
                <div className="p-4 border-b border-border-color hover:bg-background-light dark:hover:bg-slate-800 cursor-pointer transition-colors border-l-4 border-l-transparent" data-role="inquiry-list-item" data-inquiry-status="CLOSED">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-xs font-medium text-slate-500">#2024-8928</span>
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-semibold border border-slate-200">低优先级</span>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1 line-clamp-1">多功能扩展坞（1000件）</h3>
                  <p className="text-xs text-text-sub line-clamp-2 mb-2">需要标准 7 合 1 扩展坞，需支持品牌定制，目标价低于 $15/件。</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-[10px] font-bold">像</div>
                      <span className="text-xs text-slate-500">像素工作室</span>
                    </div>
                    <span className="text-[10px] text-slate-400">1天前</span>
                  </div>
                </div>
                <div className="p-4 border-b border-border-color hover:bg-background-light dark:hover:bg-slate-800 cursor-pointer transition-colors border-l-4 border-l-transparent" data-role="inquiry-list-item" data-inquiry-status="PENDING">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-xs font-medium text-slate-500">#2024-8925</span>
                    <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold border border-amber-200">中优先级</span>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1 line-clamp-1">双臂显示器支架</h3>
                  <p className="text-xs text-text-sub line-clamp-2 mb-2">需求已附，需核验指定显示器的通用支架标准兼容性。</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-[10px] font-bold">顶</div>
                      <span className="text-xs text-slate-500">顶点设计</span>
                    </div>
                    <span className="text-[10px] text-slate-400">2天前</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-white dark:bg-slate-900/50">
              <div className="p-6 border-b border-border-color sticky top-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm z-10">
                <div className="flex flex-wrap justify-between items-start gap-4 mb-4">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">需求单 #2024-8932</h1>
                      <span className="bg-blue-100 text-blue-700 text-xs px-2.5 py-0.5 rounded-full font-semibold border border-blue-200">进行中</span>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button className="px-4 py-2 border border-border-color rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">驳回</button>
                    <button className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium shadow hover:bg-blue-700 transition-colors flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm">edit</span>
                      编辑需求
                    </button>
                  </div>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-lg p-4 flex items-center justify-between relative overflow-hidden">
                  <div className="absolute top-1/2 left-4 right-4 h-0.5 bg-slate-300 dark:bg-slate-600 -translate-y-1/2 z-0" />
                  <div className="relative z-10 flex flex-col items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center shadow-sm">
                      <span className="material-symbols-outlined text-sm">check</span>
                    </div>
                    <span className="text-xs font-semibold text-green-600">已接收</span>
                  </div>
                  <div className="relative z-10 flex flex-col items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center shadow-sm ring-4 ring-blue-50 dark:ring-blue-900/30">
                      <span className="material-symbols-outlined text-sm">cached</span>
                    </div>
                    <span className="text-xs font-semibold text-primary">需求订单中</span>
                  </div>
                  <div className="relative z-10 flex flex-col items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-400 flex items-center justify-center border-2 border-white dark:border-slate-800">
                      <span className="material-symbols-outlined text-sm">gavel</span>
                    </div>
                    <span className="text-xs font-medium text-slate-500">议价中</span>
                  </div>
                  <div className="relative z-10 flex flex-col items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-400 flex items-center justify-center border-2 border-white dark:border-slate-800">
                      <span className="material-symbols-outlined text-sm">local_shipping</span>
                    </div>
                    <span className="text-xs font-medium text-slate-500">交付中</span>
                  </div>
                </div>
              </div>
              <div className="p-6 grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2 space-y-6">
                  <div className="bg-surface-light dark:bg-surface-dark border border-border-color rounded-xl p-5 shadow-sm">
                    <h3 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary">info</span>
                      需求详情
                    </h3>
                    <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                      <div>
                        <p className="text-xs font-medium text-text-sub uppercase mb-1">客户姓名</p>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">艾丽丝·陈</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-text-sub uppercase mb-1">公司</p>
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 bg-slate-200 rounded flex items-center justify-center text-[10px] font-bold">技</div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">科技方案有限公司</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-text-sub uppercase mb-1">联系邮箱</p>
                        <p className="text-sm text-slate-700 dark:text-slate-300">客户联系邮箱（已隐藏）</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-text-sub uppercase mb-1">电话</p>
                        <p className="text-sm text-slate-700 dark:text-slate-300">+1 (555) 012-3456</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-text-sub uppercase mb-1">目标单价</p>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">$450.00 <span className="text-xs font-normal text-slate-400">/件</span></p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-text-sub uppercase mb-1">数量</p>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">500 件</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-surface-light dark:bg-surface-dark border border-border-color rounded-xl p-5 shadow-sm">
                    <h3 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary">description</span>
                      规格与附件
                    </h3>
                    <div className="space-y-4">
                      <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg text-sm text-slate-700 dark:text-slate-300 leading-relaxed border border-slate-100 dark:border-slate-800">
                        <p>客户需要高品质机械键盘，规格如下：</p>
                        <ul className="list-disc list-inside mt-2 space-y-1 ml-1">
                          <li>全尺寸 104 键布局</li>
                          <li>高品质机械轴体（红轴或茶轴）</li>
                          <li>多色背光（支持软件控制）</li>
                          <li>耐磨注塑键帽</li>
                          <li>可拆卸通用接口线缆</li>
                        </ul>
                      </div>
                      <div className="flex gap-3 mt-4">
                        <div className="flex items-center gap-3 p-3 border border-border-color rounded-lg hover:border-primary/50 hover:bg-blue-50/30 transition-colors cursor-pointer group w-full md:w-auto">
                          <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                            <span className="material-symbols-outlined text-red-500">picture_as_pdf</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-slate-900 dark:text-white group-hover:text-primary">技术规格（版本二）</span>
                            <span className="text-xs text-text-sub">2.4 兆字节</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 border border-border-color rounded-lg hover:border-primary/50 hover:bg-blue-50/30 transition-colors cursor-pointer group w-full md:w-auto">
                          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <span className="material-symbols-outlined text-blue-500">image</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-slate-900 dark:text-white group-hover:text-primary">参考设计图</span>
                            <span className="text-xs text-text-sub">4.1 兆字节</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="xl:col-span-1 flex flex-col gap-6">
                  <div className="bg-surface-light dark:bg-surface-dark border border-border-color rounded-xl p-5 shadow-sm">
                    <h3 className="text-xs font-bold text-text-sub uppercase mb-3">跟进负责人</h3>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-cover bg-center ring-2 ring-white dark:ring-slate-800 shadow-sm" data-alt="跟进人员头像" style={{backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuD_wYuUd8bdILwziU8s4Ugh5eL3F21YgRlKMffjAfXFdjpS4n7acT0591OU-RJMBdTsxMFSTC0zeJB-FHR13rdjAam1X4zvgr2kSlovCtlPr5zgswrWF70YxkWK_9Fru0fo_bQmih6VtA7q43sqURfj_paciYtwfqNnLug65XlWEZll2dE5r1H1ECuAv31E-Tv23BJjltL5aZ7IHRd_33Jk-FdqBOcXnfXRjI950ZKaQ7F-IZUbHh9kCuX-IFpMRV0mbzWs4JapfmE")'}} />
                      <div className="flex-1">
                        <p className="text-sm font-bold text-slate-900 dark:text-white">马克·威尔逊</p>
                        <p className="text-xs text-text-sub">产品专员</p>
                      </div>
                      <button className="text-primary hover:text-blue-700 text-xs font-semibold">更换</button>
                    </div>
                  </div>
                  <div className="bg-surface-light dark:bg-surface-dark border border-border-color rounded-xl flex flex-col shadow-sm flex-1 min-h-[500px]">
                    <div className="p-4 border-b border-border-color flex justify-between items-center">
                      <h3 className="font-bold text-slate-800 dark:text-white">活动动态</h3>
                      <div className="flex gap-2">
                        <button className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-500"><span className="material-symbols-outlined text-lg">history</span></button>
                        <button className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-500"><span className="material-symbols-outlined text-lg">more_horiz</span></button>
                      </div>
                    </div>
                    <div className="flex-1 p-4 space-y-6 overflow-y-auto bg-slate-50/50 dark:bg-slate-900/20 max-h-[600px]">
                      <div className="flex gap-3">
                        <div className="flex flex-col items-center gap-1">
                          <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                            <span className="material-symbols-outlined text-sm text-slate-500">settings</span>
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-baseline justify-between mb-1">
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">系统</span>
                            <span className="text-[10px] text-slate-400">10月24日 10:23</span>
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-400 italic">需求已通过企业采购门户创建，优先级已设为高。</p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-cover bg-center shrink-0" style={{backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuDLSiqQL-_5Q8UYdhd938QFQsrHuMWYB4QgyMIumDq2X-Cc9S8hU7as4k3tl_lQWupN7YYreqUc_A4yBtLfBe_LbasHZqrzLVpv9bi-8bzEj3X3xYSDEUw-3XcfJxYA5L_fNZ8G8-K0PoCRRXCHypZTQTLX0Y7rJCHzYtWOSb9i2moo3sFRq6ENAU_rMu9z9NHCsvPq8m7woy81cNPfINiOiGYGctrLpcvGZFO-uypzqLJIP8pMa46nKDAHDrkXlqmpU_8eEVgJxjg")'}} />
                        <div className="flex-1">
                          <div className="flex items-baseline justify-between mb-1">
                            <span className="text-xs font-bold text-primary">马克·威尔逊</span>
                            <span className="text-[10px] text-slate-400">昨天 14:15</span>
                          </div>
                          <div className="bg-white dark:bg-slate-800 p-3 rounded-tr-xl rounded-b-xl shadow-sm border border-slate-100 dark:border-slate-700">
                            <p className="text-sm text-slate-700 dark:text-slate-300">我已审核规格。我们在深圳有两家符合条件的潜在供应商，我今天会联系并获取报价。</p>
                          </div>
                          <div className="flex gap-2 mt-1">
                            <span className="text-[10px] font-medium text-slate-400 cursor-pointer hover:text-slate-600">内部备注</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 font-bold text-xs">艾</div>
                        <div className="flex-1">
                          <div className="flex items-baseline justify-between mb-1">
                            <span className="text-xs font-bold text-slate-800 dark:text-white">艾丽丝·陈</span>
                            <span className="text-[10px] text-slate-400">今天 09:30</span>
                          </div>
                          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-tl-xl rounded-b-xl shadow-sm border border-blue-100 dark:border-blue-900/30">
                            <p className="text-sm text-slate-800 dark:text-slate-200">你好，马克，补充一下：如果可以的话，我们更偏好哑光黑机身。谢谢！</p>
                          </div>
                          <div className="flex gap-2 mt-1">
                            <span className="text-[10px] font-medium text-primary cursor-pointer hover:underline flex items-center gap-1"><span className="material-symbols-outlined text-[12px]">reply</span> 通过邮件回复</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="p-3 border-t border-border-color bg-white dark:bg-surface-dark rounded-b-xl">
                      <div className="flex gap-2 mb-2">
                        <button className="text-[10px] font-medium bg-primary/10 text-primary px-2 py-1 rounded hover:bg-primary/20 transition-colors">内部备注</button>
                        <button className="text-[10px] font-medium text-text-sub px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">发送邮件给客户</button>
                      </div>
                      <div className="relative">
                        <textarea className="w-full text-sm border-border-color rounded-lg focus:ring-primary focus:border-primary bg-slate-50 dark:bg-slate-800 dark:text-white resize-none pr-10" placeholder="在此输入备注..." rows={3} defaultValue={""} />
                        <div className="absolute bottom-2 right-2 flex gap-1">
                          <button className="p-1 text-slate-400 hover:text-primary transition-colors"><span className="material-symbols-outlined text-lg">attach_file</span></button>
                          <button className="p-1 text-primary hover:text-blue-700 transition-colors bg-primary/10 rounded-md"><span className="material-symbols-outlined text-lg">send</span></button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
      
    </>
  );
};
