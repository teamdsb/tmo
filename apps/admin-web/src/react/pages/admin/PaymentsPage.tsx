export const PaymentsPage = () => {
  return (
    <>
      <div>
        <header className="bg-white border-b border-slate-200 px-8 py-6 shrink-0 z-10 shadow-sm">
          <div className="max-w-[1400px] mx-auto w-full">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">System Activity &amp; Financials</h1>
                <p className="mt-1 text-slate-500">Monitor real-time transaction flows and detailed system audit trails.</p>
              </div>
              <div className="flex gap-3">
                <button className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-sm font-medium transition-colors shadow-sm">
                  <span className="material-symbols-outlined text-[20px]">download</span>
                  Export Report
                </button>
              </div>
            </div>
            <div className="flex gap-8 mt-8 border-b border-slate-100">
              <a className="pb-3 border-b-2 border-primary text-primary font-semibold text-sm flex items-center gap-2" href="#">
                <span className="material-symbols-outlined text-[20px]">payments</span>
                Transactions
              </a>
              <a className="pb-3 border-b-2 border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300 font-medium text-sm flex items-center gap-2 transition-all" href="#">
                <span className="material-symbols-outlined text-[20px]">manage_history</span>
                Audit Logs
              </a>
              <a className="pb-3 border-b-2 border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300 font-medium text-sm flex items-center gap-2 transition-all" href="#">
                <span className="material-symbols-outlined text-[20px]">webhook</span>
                Webhooks
              </a>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-[1400px] mx-auto w-full flex flex-col gap-6">
            <div className="flex flex-col xl:flex-row gap-4 justify-between items-start xl:items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex flex-wrap gap-3 items-center w-full xl:w-auto">
                <div className="relative group w-full sm:w-80">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400 group-focus-within:text-primary transition-colors">
                    <span className="material-symbols-outlined text-[20px]">search</span>
                  </div>
                  <input className="block w-full pl-10 pr-3 py-2 bg-slate-50 hover:bg-slate-100 focus:bg-white border border-transparent focus:border-primary/20 rounded-lg text-sm placeholder-slate-400 focus:ring-2 focus:ring-primary/20 text-slate-700 transition-all shadow-sm" placeholder="Search Transaction ID, User, or Order #" type="text" />
                </div>
                <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
                  <button className="whitespace-nowrap flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-slate-50 rounded-lg text-xs font-medium text-slate-600 transition-colors border border-slate-200 hover:border-slate-300 shadow-sm">
                    <span className="material-symbols-outlined text-[16px] text-slate-400">calendar_today</span>
                    Last 30 Days
                  </button>
                  <button className="whitespace-nowrap flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-slate-50 rounded-lg text-xs font-medium text-slate-600 transition-colors border border-slate-200 hover:border-slate-300 shadow-sm">
                    <span className="material-symbols-outlined text-[16px] text-slate-400">filter_list</span>
                    Status: All
                  </button>
                  <button className="whitespace-nowrap flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-slate-50 rounded-lg text-xs font-medium text-slate-600 transition-colors border border-slate-200 hover:border-slate-300 shadow-sm">
                    <span className="material-symbols-outlined text-[16px] text-slate-400">credit_card</span>
                    Channel: All
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-4 self-end xl:self-auto">
                <span className="text-xs font-medium text-slate-500">Showing 1-10 of 2,450 results</span>
                <div className="flex gap-1">
                  <button className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 disabled:opacity-50 transition-colors border border-transparent hover:border-slate-200">
                    <span className="material-symbols-outlined text-[20px]">chevron_left</span>
                  </button>
                  <button className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors border border-transparent hover:border-slate-200">
                    <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                  </button>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full min-h-[500px]">
              <div className="lg:col-span-2 flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">list_alt</span>
                    Recent Transactions
                  </h2>
                  <button className="text-primary text-xs font-semibold hover:underline">View All</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-3 tracking-wide">Transaction ID</th>
                        <th className="px-6 py-3 tracking-wide">Channel</th>
                        <th className="px-6 py-3 tracking-wide text-right">Amount</th>
                        <th className="px-6 py-3 tracking-wide text-center">Status</th>
                        <th className="px-6 py-3 tracking-wide text-right">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr className="group hover:bg-slate-50 transition-colors cursor-pointer">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-slate-800">TXN_849202</div>
                          <div className="text-xs text-slate-500">Order #3321 • User: alex_m</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="size-6 rounded-full bg-white border border-slate-100 flex items-center justify-center p-1 shrink-0 shadow-sm">
                              <img alt="PayPal" className="w-full h-full object-contain" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDsMH5r78CqOb1xPm7CkNB2G7UVC9R8-BNlS5exzIbsPvir79NtloyXWSfdPt7PFkQ7eMm8WZAeMKWA5HgnYXgjRHsTXrmntatslUVVXS97FiZHUwcsDSuHYyy--vTWHY0jEHLIQpVrdMTzVK8unbc_INtITevbsxSJIgLE0FNOIElBp8Gab7nYg8DB5M0UrZVnHmzb6CeUYKZ4HrUSwXa58jZWH5tiBhCIitaaaLnQ-dg-WYgzE9qvOMzpvr9rBffBFLzix44USEo" />
                            </div>
                            <span className="text-slate-600 font-medium">PayPal</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-slate-800">$1,240.00</td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                            <span className="size-1.5 rounded-full bg-emerald-500" />
                            Paid
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right text-slate-400 text-xs">Oct 24, 2023<br />14:30 PM</td>
                      </tr>
                      <tr className="group hover:bg-slate-50 transition-colors cursor-pointer">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-slate-800">TXN_849201</div>
                          <div className="text-xs text-slate-500">Order #3320 • User: sarah_k</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="size-6 rounded-full bg-slate-800 flex items-center justify-center p-1 shrink-0 text-white text-[10px] font-bold shadow-sm">ST</div>
                            <span className="text-slate-600 font-medium">Stripe</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-slate-800">$45.50</td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-100">
                            <span className="size-1.5 rounded-full bg-amber-500" />
                            Pending
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right text-slate-400 text-xs">Oct 24, 2023<br />14:15 PM</td>
                      </tr>
                      <tr className="group hover:bg-slate-50 transition-colors cursor-pointer bg-red-50/30">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-slate-800">TXN_849199</div>
                          <div className="text-xs text-slate-500">Order #3319 • User: guest_02</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="size-6 rounded-full bg-black flex items-center justify-center p-1 shrink-0 text-white text-[8px] font-bold shadow-sm">AP</div>
                            <span className="text-slate-600 font-medium">Apple Pay</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-slate-800">$210.00</td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-100">
                            <span className="material-symbols-outlined text-[14px]">close</span>
                            Failed
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right text-slate-400 text-xs">Oct 24, 2023<br />13:55 PM</td>
                      </tr>
                      <tr className="group hover:bg-slate-50 transition-colors cursor-pointer">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-slate-800">TXN_849198</div>
                          <div className="text-xs text-slate-500">Ref #9921 • User: mark_tw</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="size-6 rounded-full bg-slate-800 flex items-center justify-center p-1 shrink-0 text-white text-[10px] font-bold shadow-sm">ST</div>
                            <span className="text-slate-600 font-medium">Stripe</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-slate-800">-$55.00</td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                            <span className="material-symbols-outlined text-[14px]">replay</span>
                            Refunded
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right text-slate-400 text-xs">Oct 24, 2023<br />12:10 PM</td>
                      </tr>
                      <tr className="group hover:bg-slate-50 transition-colors cursor-pointer">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-slate-800">TXN_849195</div>
                          <div className="text-xs text-slate-500">Order #3318 • User: j_doe</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="size-6 rounded-full bg-white border border-slate-100 flex items-center justify-center p-1 shrink-0 shadow-sm">
                              <img alt="PayPal" className="w-full h-full object-contain" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDP894EEQzPBeNujU_j6KYTQquMfh1QsosASOQvyrIiE-hFOHYjNmj6V5wQ7fVGO9bKcxehgMvTN3xzfZawkfodqsQ2xugYWuSpOWof67G8IczKVOU6KeOLPKyi9qRknEDgONINpDVYnsG7OdBPEyGoFVJc0VgUVKRzua4Ldppp8q7RLFyneyv8B1mto7tVufaQsNl_k1mDLB9rUZq0uYLc7Qf3CVeRX62K7kqiql8EiGzs8oLLwJg9Ju286iFDQvvy8vA2VWO6ogk" />
                            </div>
                            <span className="text-slate-600 font-medium">PayPal</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-slate-800">$89.99</td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                            <span className="size-1.5 rounded-full bg-emerald-500" />
                            Paid
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right text-slate-400 text-xs">Oct 24, 2023<br />11:45 AM</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="flex flex-col gap-6">
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="text-lg font-bold text-slate-800">Audit Trail</h3>
                      <p className="text-xs text-slate-500">Recent system operations</p>
                    </div>
                    <button className="text-slate-400 hover:text-primary transition-colors">
                      <span className="material-symbols-outlined">filter_list</span>
                    </button>
                  </div>
                  <div className="relative pl-4 border-l border-slate-200 space-y-8">
                    <div className="relative group">
                      <div className="absolute -left-[21px] top-1 bg-white border border-slate-200 rounded-full p-1 group-hover:border-primary/50 transition-colors">
                        <div className="size-2 rounded-full bg-primary" />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-primary tracking-wide">STATUS_UPDATE</span>
                          <span className="text-[10px] text-slate-400 font-mono">14:32:05</span>
                        </div>
                        <p className="text-sm text-slate-700">Changed status to <span className="font-semibold text-emerald-700">Paid</span></p>
                        <div className="bg-slate-50 p-2 rounded-lg text-[11px] font-mono text-slate-500 border border-slate-100 mt-1">
                          User: system_bot<br />
                          IP: 192.168.1.10
                        </div>
                      </div>
                    </div>
                    <div className="relative group">
                      <div className="absolute -left-[21px] top-1 bg-white border border-slate-200 rounded-full p-1 group-hover:border-slate-400 transition-colors">
                        <div className="size-2 rounded-full bg-slate-400" />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-slate-600 tracking-wide">CALLBACK_RECEIVED</span>
                          <span className="text-[10px] text-slate-400 font-mono">14:32:02</span>
                        </div>
                        <p className="text-sm text-slate-700">Webhook received from PayPal</p>
                        <div className="bg-slate-50 p-2 rounded-lg text-[11px] font-mono text-slate-500 border border-slate-100 mt-1 truncate">ID: PAY-129381923...</div>
                      </div>
                    </div>
                    <div className="relative group">
                      <div className="absolute -left-[21px] top-1 bg-white border border-slate-200 rounded-full p-1 group-hover:border-amber-400 transition-colors">
                        <div className="size-2 rounded-full bg-amber-400" />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-amber-600 tracking-wide">MANUAL_OVERRIDE</span>
                          <span className="text-[10px] text-slate-400 font-mono">14:15:22</span>
                        </div>
                        <p className="text-sm text-slate-700">Admin verified address</p>
                        <div className="flex items-center gap-2 mt-1 px-2 py-1 bg-slate-50 rounded-lg w-fit">
                          <div className="bg-center bg-no-repeat bg-cover rounded-full size-5 shadow-sm" style={{backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuBKFnQ852eyj1iR2szKoFACeYI3wNzwkjh_e1nachAMrKarf9F2WdZ31Mbrg_AjOul6XATSvttbj-pEBfjgMkYpAtiK1uA0U9THMc_fiYh5INiVZzVMTRkYg8AJ-iVHdn3mj8NxVSKYDoD1hhsrjtDmJfNTr1-np6crwrO66RxGrkR7YEgk0BGEsLqqhc4IcEOIL04zV3IevFHGHSepkyAe1gdgPU9NCqVWWiFOVlMUZqiwXjLY3OpV3zQO8SIjvKNgmwB81ViPYmg")'}} />
                          <span className="text-xs text-slate-500 font-medium">Admin: Sarah</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <button className="w-full mt-8 py-2.5 text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-50 border border-dashed border-slate-200 rounded-lg transition-colors">View Full Audit Log</button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-primary p-4 rounded-xl text-white shadow-md shadow-primary/20 bg-gradient-to-br from-primary to-[#0f3a9a]">
                    <div className="flex items-center justify-between mb-2 opacity-90">
                      <span className="text-xs font-medium">Daily Volume</span>
                      <span className="material-symbols-outlined text-[18px]">show_chart</span>
                    </div>
                    <div className="text-2xl font-bold tracking-tight">$42.5k</div>
                    <div className="text-[10px] mt-1 flex items-center gap-1 font-medium">
                      <span className="bg-white/20 rounded px-1.5 py-0.5">+12%</span>
                      <span className="opacity-80">vs yesterday</span>
                    </div>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-2 text-slate-500">
                      <span className="text-xs font-medium">Failed Rate</span>
                      <span className="material-symbols-outlined text-[18px]">warning</span>
                    </div>
                    <div className="text-2xl font-bold text-slate-800 tracking-tight">1.2%</div>
                    <div className="text-[10px] mt-1 flex items-center gap-1 text-emerald-600 font-medium">
                      <span className="material-symbols-outlined text-[12px]">trending_down</span>
                      <span>-0.5% stable</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
      
    </>
  );
};
