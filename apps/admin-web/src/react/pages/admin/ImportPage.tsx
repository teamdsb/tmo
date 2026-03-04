import { AdminTopbar } from '../../layout/AdminTopbar';

export const ImportPage = () => {
  return (
    <>
      <div>
        <AdminTopbar
          searchPlaceholder="搜索订单、商品..."
          leftSlot={
            <div className="flex items-center gap-3 text-slate-900 dark:text-white">
              <div className="w-8 h-8 text-primary bg-primary/10 rounded-lg flex items-center justify-center">
                <span className="material-symbols-outlined text-xl">dataset</span>
              </div>
              <h2 className="text-lg font-bold leading-tight tracking-tight">管理控制台</h2>
            </div>
          }
        />
        <main className="flex-1 w-full max-w-7xl mx-auto px-6 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">从 Excel 导入订单</h1>
          </div>
          <div className="mb-10">
            <div className="relative flex justify-between w-full max-w-3xl mx-auto">
              <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-200 dark:bg-slate-700 -translate-y-1/2 z-0 rounded-full" />
              <div className="relative z-10 flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center ring-4 ring-background-light dark:ring-background-dark shadow-sm">
                  <span className="material-symbols-outlined text-xl">upload_file</span>
                </div>
                <span className="text-sm font-semibold text-primary">上传</span>
              </div>
              <div className="relative z-10 flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center ring-4 ring-white dark:ring-slate-900 shadow-lg ring-offset-2 ring-offset-primary/20">
                  <span className="material-symbols-outlined text-xl">analytics</span>
                </div>
                <span className="text-sm font-semibold text-primary">解析与匹配</span>
              </div>
              <div className="relative z-10 flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center ring-4 ring-background-light dark:ring-background-dark">
                  <span className="material-symbols-outlined text-xl">checklist</span>
                </div>
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">复核</span>
              </div>
              <div className="relative z-10 flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center ring-4 ring-background-light dark:ring-background-dark">
                  <span className="material-symbols-outlined text-xl">check_circle</span>
                </div>
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">完成</span>
              </div>
            </div>
            <div className="mt-8 max-w-3xl mx-auto bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-white dark:bg-blue-800 flex items-center justify-center shrink-0">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
              <div className="flex-1">
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">正在分析文件内容...</span>
                  <span className="text-sm font-medium text-primary">85%</span>
                </div>
                <div className="h-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{width: '85%'}} />
                </div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="space-y-6">
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-slate-900 dark:text-white">当前文件</h3>
                  <button className="text-xs text-red-500 hover:text-red-600 font-medium">移除</button>
                </div>
                <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-700">
                  <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded flex items-center justify-center text-green-600 dark:text-green-400">
                    <span className="material-symbols-outlined">table_view</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">Q4_Bulk_Order_Sheet_v2.xlsx</p>
                    <p className="text-xs text-slate-500">2.4 MB • 142 行</p>
                  </div>
                  <span className="material-symbols-outlined text-green-500 text-lg">check_circle</span>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                  <div className="w-full h-32 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg flex flex-col items-center justify-center text-center p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group">
                    <span className="material-symbols-outlined text-slate-400 group-hover:text-primary mb-1 transition-colors">upload_file</span>
                    <span className="text-xs text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300">拖拽新文件以替换</span>
                  </div>
                </div>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm">
                <h3 className="font-semibold text-slate-900 dark:text-white mb-4">解析汇总</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-500" /> 已匹配</span>
                    <span className="text-sm font-bold text-slate-900 dark:text-white">128</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-amber-500" /> 待复核</span>
                    <span className="text-sm font-bold text-amber-600 dark:text-amber-400">12</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-500" /> 错误</span>
                    <span className="text-sm font-bold text-red-600 dark:text-red-400">2</span>
                  </div>
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-900 dark:text-white">总价值</span>
                    <span className="text-lg font-bold text-primary">$42,590.00</span>
                  </div>
                </div>
                <button className="w-full mt-6 py-2.5 bg-primary hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm shadow-blue-500/30 transition-all flex items-center justify-center gap-2">
                  <span>确认加入购物车</span>
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </button>
              </div>
            </div>
            <div className="lg:col-span-2 flex flex-col h-full min-h-[600px] bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
              <div className="flex border-b border-slate-200 dark:border-slate-700">
                <button className="flex-1 py-4 text-sm font-medium text-primary border-b-2 border-primary bg-blue-50/50 dark:bg-blue-900/10 transition-colors">匹配候选（128）</button>
                <button className="flex-1 py-4 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 border-b-2 border-transparent transition-colors flex items-center justify-center gap-2">待处理 / 错误 <span className="px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 text-xs font-bold">14</span></button>
              </div>
              <div className="p-4 flex items-center justify-between bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400"><span className="material-symbols-outlined text-[18px]">search</span></span>
                    <input className="pl-9 pr-4 py-1.5 text-sm rounded-md border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-1 focus:ring-primary focus:border-primary w-48" placeholder="筛选结果..." type="text" />
                  </div>
                  <div className="h-4 w-px bg-slate-200 dark:bg-slate-600" />
                  <button className="text-sm text-slate-500 hover:text-primary flex items-center gap-1"><span className="material-symbols-outlined text-[18px]">filter_list</span> 筛选</button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">显示 1-10 / 共 128</span>
                  <div className="flex gap-1">
                    <button className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400"><span className="material-symbols-outlined text-[18px]">chevron_left</span></button>
                    <button className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"><span className="material-symbols-outlined text-[18px]">chevron_right</span></button>
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 sticky top-0 z-10">
                    <tr>
                      <th className="py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-12 text-center"><input className="rounded border-slate-300 text-primary focus:ring-primary h-4 w-4 bg-white dark:bg-slate-700 dark:border-slate-600" type="checkbox" /></th>
                      <th className="py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">商品</th>
                      <th className="py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">SKU / 编号</th>
                      <th className="py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">数量</th>
                      <th className="py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">价格</th>
                      <th className="py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-center">状态</th>
                      <th className="py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    <tr className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group">
                      <td className="py-3 px-4 text-center"><input defaultChecked className="rounded border-slate-300 text-primary focus:ring-primary h-4 w-4 bg-white dark:bg-slate-700 dark:border-slate-600" type="checkbox" /></td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded bg-slate-100 dark:bg-slate-700 overflow-hidden shrink-0"><img alt="White minimalistic watch product" className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAZxi-cognLCgbYkS5-H9AjrFXxW_9aILlLdSM3K94MgK4eADykHWkSRigeS7LCafbueiOQuOeuACb-Rpl_UBq2GiTOVK4viZAnHXgwJUsgkv4A4KNXyxL1K31BxKTnlUlYZBcDV5xP6sXHuZWRhDlVUwTvWXp8ogwsdND0iQnSDfJby6Y_NtxF8-x8rsaZM9YwT2KdFB8aIiX8PVdxrwzVcGrPsER1xRZIV_eivrsVPASJSDS7DRUFhp0ACQTI_2t7Tw8ung1xWIw" /></div>
                          <div>
                            <div className="font-medium text-slate-900 dark:text-white text-sm">极简手表</div>
                            <div className="text-xs text-slate-500">规格：银色 / 40mm</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-300 font-mono">MW-40-SLV</td>
                      <td className="py-3 px-4 text-right"><input className="w-16 px-2 py-1 text-right text-sm border-slate-200 dark:border-slate-600 rounded bg-transparent focus:ring-1 focus:ring-primary focus:border-primary" type="number" defaultValue={50} /></td>
                      <td className="py-3 px-4 text-right text-sm font-medium text-slate-900 dark:text-white">$1,250.00</td>
                      <td className="py-3 px-4 text-center"><span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">已匹配</span></td>
                      <td className="py-3 px-4 text-right"><button className="text-slate-400 hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"><span className="material-symbols-outlined text-[20px]">edit</span></button></td>
                    </tr>
                    <tr className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group">
                      <td className="py-3 px-4 text-center"><input defaultChecked className="rounded border-slate-300 text-primary focus:ring-primary h-4 w-4 bg-white dark:bg-slate-700 dark:border-slate-600" type="checkbox" /></td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded bg-slate-100 dark:bg-slate-700 overflow-hidden shrink-0"><img alt="Headphones product shot" className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAhc2HNRRJ_nvDqi5AHsZJ6CA6YtZNASX6OGLnjgmpSAusC4WV7lbug83Ol0QP_lWEUG5FNiIIqJc-9ovQcTmN0gxPwTaVw-a_JV81zCxS0uru8fgReJtD7dbsqvvxZIHWASly4GAdzsGrN3Dv4PfG09azBzoiEXziHgSGOQFsFmgBq72O36PJxayqwCm76qwcO667a91SYpuMf6f4HOI8ML8PsQeaFY2yeDThJxhPqfUSTGDzzSCu9SDcZ7ETkyN7CajcHQX8ZVFM" /></div>
                          <div>
                            <div className="font-medium text-slate-900 dark:text-white text-sm">无线耳机</div>
                            <div className="text-xs text-slate-500">规格：午夜黑</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-300 font-mono">WH-BLK-01</td>
                      <td className="py-3 px-4 text-right"><input className="w-16 px-2 py-1 text-right text-sm border-slate-200 dark:border-slate-600 rounded bg-transparent focus:ring-1 focus:ring-primary focus:border-primary" type="number" defaultValue={20} /></td>
                      <td className="py-3 px-4 text-right text-sm font-medium text-slate-900 dark:text-white">$3,980.00</td>
                      <td className="py-3 px-4 text-center"><span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">已匹配</span></td>
                      <td className="py-3 px-4 text-right"><button className="text-slate-400 hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"><span className="material-symbols-outlined text-[20px]">edit</span></button></td>
                    </tr>
                    <tr className="bg-amber-50/50 dark:bg-amber-900/10 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors group border-l-4 border-l-amber-400">
                      <td className="py-3 px-4 text-center"><input defaultChecked className="rounded border-slate-300 text-primary focus:ring-primary h-4 w-4 bg-white dark:bg-slate-700 dark:border-slate-600" type="checkbox" /></td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded bg-slate-100 dark:bg-slate-700 overflow-hidden shrink-0 flex items-center justify-center text-slate-400"><span className="material-symbols-outlined">image_not_supported</span></div>
                          <div>
                            <div className="font-medium text-slate-900 dark:text-white text-sm">皮革桌垫</div>
                            <div className="text-xs text-amber-600 dark:text-amber-400 font-medium">警告：库存不足（需求：100，可用：45）</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-300 font-mono">LDP-BRN-XL</td>
                      <td className="py-3 px-4 text-right"><input className="w-16 px-2 py-1 text-right text-sm border-amber-300 dark:border-amber-600 rounded bg-white dark:bg-slate-800 text-amber-700 dark:text-amber-400 focus:ring-1 focus:ring-amber-500 focus:border-amber-500" type="number" defaultValue={100} /></td>
                      <td className="py-3 px-4 text-right text-sm font-medium text-slate-900 dark:text-white">$4,500.00</td>
                      <td className="py-3 px-4 text-center"><span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">库存不足</span></td>
                      <td className="py-3 px-4 text-right"><button className="text-slate-400 hover:text-primary opacity-100 transition-opacity"><span className="material-symbols-outlined text-[20px]">edit</span></button></td>
                    </tr>
                    <tr className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group">
                      <td className="py-3 px-4 text-center"><input defaultChecked className="rounded border-slate-300 text-primary focus:ring-primary h-4 w-4 bg-white dark:bg-slate-700 dark:border-slate-600" type="checkbox" /></td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded bg-slate-100 dark:bg-slate-700 overflow-hidden shrink-0"><img alt="Red Nike sneaker product" className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDHcKdVeym2us4uUcB33hCjzNgd_M31pp8XZPR5obqPrJ_KdrqnPyscDSxPBfHGaZEkFqauWHRdbbe0s9IIlRuvv2LbOKPBEm_zaE9Qu4BibzDsZcuT-t8dYhyTGDHdnj58A4p3xYKzB0RJeczWQLHktW7nP-xEUAhjzBBJAOTDHdnXAbL71HANALCL47UU9tiTvFBNMtkSEyTJOipIYBHSaoH8XbWyfOImOlfl-rv3DE6PGDFXjQC43BGfpRgrJNIey7ohPhyJ_FU" /></div>
                          <div>
                            <div className="font-medium text-slate-900 dark:text-white text-sm">跑步运动鞋 <span className="text-xs font-normal text-slate-400">（按名称匹配）</span></div>
                            <div className="text-xs text-slate-500">输入："Red Sneaker v2"</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-300 font-mono">NK-RUN-RD</td>
                      <td className="py-3 px-4 text-right"><input className="w-16 px-2 py-1 text-right text-sm border-slate-200 dark:border-slate-600 rounded bg-transparent focus:ring-1 focus:ring-primary focus:border-primary" type="number" defaultValue={15} /></td>
                      <td className="py-3 px-4 text-right text-sm font-medium text-slate-900 dark:text-white">$1,350.00</td>
                      <td className="py-3 px-4 text-center"><span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">模糊匹配</span></td>
                      <td className="py-3 px-4 text-right"><button className="text-slate-400 hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"><span className="material-symbols-outlined text-[20px]">edit</span></button></td>
                    </tr>
                    <tr className="bg-red-50/50 dark:bg-red-900/10 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors group border-l-4 border-l-red-400">
                      <td className="py-3 px-4 text-center"><input className="rounded border-slate-300 text-primary focus:ring-primary h-4 w-4 bg-white dark:bg-slate-700 dark:border-slate-600" type="checkbox" /></td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-red-400 shrink-0"><span className="material-symbols-outlined text-lg">broken_image</span></div>
                          <div>
                            <div className="font-medium text-red-600 dark:text-red-400 text-sm">未知商品</div>
                            <div className="text-xs text-red-500">输入 SKU："INVALID-SKU-99"</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-red-500 font-mono">---</td>
                      <td className="py-3 px-4 text-right"><span className="text-sm text-slate-400">10</span></td>
                      <td className="py-3 px-4 text-right text-sm font-medium text-slate-400">---</td>
                      <td className="py-3 px-4 text-center"><button className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-white border border-red-200 text-red-700 dark:bg-slate-800 dark:border-red-800 dark:text-red-400 shadow-sm hover:bg-red-50 transition-colors"><span className="material-symbols-outlined text-[14px]">search</span>查找商品</button></td>
                      <td className="py-3 px-4 text-right"><button className="text-red-400 hover:text-red-600 opacity-100 transition-opacity"><span className="material-symbols-outlined text-[20px]">delete</span></button></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 p-4 text-xs text-slate-500 text-center">提示：确认前可直接在表格中编辑数量。</div>
            </div>
          </div>
        </main>
      </div>
      
    </>
  );
};
