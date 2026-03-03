export const ExportsPage = () => {
  return (
    <>
      <div>
        <header className="flex items-center justify-between whitespace-nowrap border-b border-slate-200 dark:border-slate-800 bg-surface-light dark:bg-surface-dark px-10 py-3 sticky top-0 z-50">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-4">
              <div className="size-8 text-primary">
                <svg className="w-full h-full" fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                  <path d="M24 45.8096C19.6865 45.8096 15.4698 44.5305 11.8832 42.134C8.29667 39.7376 5.50128 36.3314 3.85056 32.3462C2.19985 28.361 1.76794 23.9758 2.60947 19.7452C3.451 15.5145 5.52816 11.6284 8.57829 8.5783C11.6284 5.52817 15.5145 3.45101 19.7452 2.60948C23.9758 1.76795 28.361 2.19986 32.3462 3.85057C36.3314 5.50129 39.7376 8.29668 42.134 11.8833C44.5305 15.4698 45.8096 19.6865 45.8096 24L24 24L24 45.8096Z" fill="currentColor" />
                </svg>
              </div>
              <h2 className="text-lg font-bold leading-tight tracking-[-0.015em]">Marketplace Admin</h2>
            </div>
            <label className="flex flex-col min-w-40 !h-10 max-w-64 hidden md:flex">
              <div className="flex w-full flex-1 items-stretch rounded-lg h-full ring-1 ring-slate-200 dark:ring-slate-700 bg-background-light dark:bg-slate-800">
                <div className="text-text-muted dark:text-text-mutedDark flex items-center justify-center pl-4">
                  <span className="material-symbols-outlined text-[20px]">search</span>
                </div>
                <input className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg bg-transparent focus:outline-0 focus:ring-0 border-none h-full placeholder:text-text-muted dark:placeholder:text-text-mutedDark px-4 text-sm font-normal leading-normal" placeholder="Search orders, products..." defaultValue />
              </div>
            </label>
          </div>
          <div className="flex flex-1 justify-end gap-8 items-center">
            <div className="hidden lg:flex items-center gap-9">
              <a className="text-sm font-medium leading-normal hover:text-primary transition-colors" href="/dashboard.html">Dashboard</a>
              <a className="text-sm font-medium leading-normal hover:text-primary transition-colors" href="/orders.html">Orders</a>
              <a className="text-sm font-medium leading-normal hover:text-primary transition-colors" href="/products.html">Products</a>
              <a className="text-sm font-medium leading-normal hover:text-primary transition-colors" href="/transfer.html">Customers</a>
              <a className="text-sm font-medium leading-normal hover:text-primary transition-colors" href="/exports.html">Reports</a>
            </div>
            <div className="flex gap-2">
              <button className="flex items-center justify-center rounded-lg size-10 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-text-main dark:text-text-dark">
                <span className="material-symbols-outlined">notifications</span>
              </button>
              <button className="flex items-center justify-center rounded-lg size-10 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-text-main dark:text-text-dark">
                <span className="material-symbols-outlined">settings</span>
              </button>
              <div className="bg-center bg-no-repeat bg-cover rounded-full size-10 ml-2 border border-slate-200 dark:border-slate-700" style={{backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuAXwGzHDGFpzB0oM5mCSj9jXGYf2_Wnad0DQjwrwtj-OOQVMQM2FOWXNV0n78UJ87h8JP-5eFDj3x0eWASlGPjELRucxzcIUKH9OwtLfvRbkbQRajSwvWLoO2sCjG2G0vE7sv8eSt6QYMKTjOmKM0gclyPcL5-Qjk9iKxB5z2-3ZYt-Wtym3sKCC171q5QrQlqspljMzvcjPwDXXNrKzmfyhHjM9fdXdgMFyDWYbRUhi1quUTaaKYqGwDWumOvy_a5peNIkISJQJw4")'}} />
            </div>
          </div>
        </header>
        <main className="flex-1 flex flex-col p-6 lg:p-10 gap-8 min-w-0 w-full max-w-[1440px] mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="flex flex-col gap-1">
              <h1 className="text-3xl font-black tracking-tight text-text-main dark:text-text-dark">Export &amp; Batch Task Center</h1>
              <p className="text-text-muted dark:text-text-mutedDark text-base">Monitor your background exports and bulk shipment operations.</p>
            </div>
            <div className="flex gap-3">
              <button className="flex items-center gap-2 h-10 px-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-surface-light dark:bg-surface-dark text-text-main dark:text-text-dark text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                <span className="material-symbols-outlined text-[18px]">refresh</span>
                Refresh
              </button>
              <button className="flex items-center gap-2 h-10 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark transition-colors shadow-sm shadow-primary/30">
                <span className="material-symbols-outlined text-[18px]">add</span>
                New Export
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex flex-col p-5 rounded-xl border border-blue-100 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-900/10">
              <div className="flex items-center justify-between mb-3">
                <p className="text-blue-700 dark:text-blue-300 text-sm font-semibold">In Progress</p>
                <span className="material-symbols-outlined text-blue-500 animate-spin text-[20px]">progress_activity</span>
              </div>
              <p className="text-3xl font-bold text-text-main dark:text-text-dark">2 <span className="text-lg font-normal text-text-muted dark:text-text-mutedDark">tasks</span></p>
              <div className="mt-4 h-1.5 w-full bg-blue-200 dark:bg-blue-800 rounded-full overflow-hidden">
                <div className="h-full bg-primary w-[45%] rounded-full" />
              </div>
            </div>
            <div className="flex flex-col p-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-surface-light dark:bg-surface-dark">
              <div className="flex items-center justify-between mb-3">
                <p className="text-text-muted dark:text-text-mutedDark text-sm font-medium">Completed Today</p>
                <span className="material-symbols-outlined text-green-500 text-[20px]">check_circle</span>
              </div>
              <p className="text-3xl font-bold text-text-main dark:text-text-dark">1,240</p>
              <p className="text-xs text-green-600 dark:text-green-400 mt-2 flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">trending_up</span>
                +12% vs yesterday
              </p>
            </div>
            <div className="flex flex-col p-5 rounded-xl border border-red-100 dark:border-red-900/50 bg-red-50/30 dark:bg-red-900/5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-red-700 dark:text-red-400 text-sm font-semibold">Failed</p>
                <span className="material-symbols-outlined text-red-500 text-[20px]">error</span>
              </div>
              <p className="text-3xl font-bold text-text-main dark:text-text-dark">5 <span className="text-lg font-normal text-text-muted dark:text-text-mutedDark">tasks</span></p>
              <button className="mt-auto text-left text-xs text-red-600 dark:text-red-400 font-medium hover:underline">View error details</button>
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <h2 className="text-xl font-bold text-text-main dark:text-text-dark">Recent Data Exports</h2>
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-surface-light dark:bg-surface-dark overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs uppercase text-text-muted dark:text-text-mutedDark font-medium">
                    <tr>
                      <th className="px-6 py-4">Task Name</th>
                      <th className="px-6 py-4">Type</th>
                      <th className="px-6 py-4">Date Initiated</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Size</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                    <tr className="group hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4 font-medium text-text-main dark:text-text-dark">
                        Weekly Sales Report - Q3
                        <div className="text-xs text-text-muted font-normal mt-0.5">Generated by System</div>
                      </td>
                      <td className="px-6 py-4 text-text-muted dark:text-text-mutedDark">CSV Export</td>
                      <td className="px-6 py-4 text-text-muted dark:text-text-mutedDark">Oct 24, 2023 • 14:30</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800">
                          <span className="size-1.5 rounded-full bg-green-500" />
                          Ready
                        </span>
                      </td>
                      <td className="px-6 py-4 text-text-muted dark:text-text-mutedDark">4.2 MB</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <span className="text-xs text-text-muted hidden xl:block">Expires in 6 days</span>
                          <button className="text-primary hover:text-primary-dark font-medium text-sm flex items-center gap-1">
                            Download
                            <span className="material-symbols-outlined text-[16px]">download</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                    <tr className="group hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4 font-medium text-text-main dark:text-text-dark">
                        Customer List (All Regions)
                        <div className="text-xs text-text-muted font-normal mt-0.5">Requested by Admin</div>
                      </td>
                      <td className="px-6 py-4 text-text-muted dark:text-text-mutedDark">Excel (XLSX)</td>
                      <td className="px-6 py-4 text-text-muted dark:text-text-mutedDark">Oct 24, 2023 • 10:15</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                          <span className="size-1.5 rounded-full bg-blue-500 animate-pulse" />
                          Processing (65%)
                        </span>
                      </td>
                      <td className="px-6 py-4 text-text-muted dark:text-text-mutedDark">--</td>
                      <td className="px-6 py-4 text-right">
                        <button className="text-text-muted hover:text-red-600 transition-colors font-medium text-sm">Cancel</button>
                      </td>
                    </tr>
                    <tr className="group hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4 font-medium text-text-main dark:text-text-dark">
                        Inventory Snapshot - Warehouse B
                        <div className="text-xs text-text-muted font-normal mt-0.5">Automated Backup</div>
                      </td>
                      <td className="px-6 py-4 text-text-muted dark:text-text-mutedDark">JSON Dump</td>
                      <td className="px-6 py-4 text-text-muted dark:text-text-mutedDark">Oct 23, 2023 • 09:00</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700">Expired</span>
                      </td>
                      <td className="px-6 py-4 text-text-muted dark:text-text-mutedDark">128 MB</td>
                      <td className="px-6 py-4 text-right">
                        <button className="text-text-muted hover:text-primary transition-colors font-medium text-sm flex items-center gap-1 justify-end ml-auto">
                          <span className="material-symbols-outlined text-[16px]">replay</span>
                          Regenerate
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-text-main dark:text-text-dark">Shipment Batch Imports</h2>
              <button className="text-primary text-sm font-medium hover:underline">View Import History</button>
            </div>
            <div className="grid gap-4">
              <div className="flex flex-col md:flex-row gap-4 p-5 rounded-xl border border-red-200 dark:border-red-900/40 bg-white dark:bg-surface-dark shadow-sm">
                <div className="flex items-start gap-4 flex-1">
                  <div className="size-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0 text-red-600 dark:text-red-400">
                    <span className="material-symbols-outlined">local_shipping</span>
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-text-main dark:text-text-dark">Batch #SHP-2023-992</h3>
                    <p className="text-sm text-text-muted dark:text-text-mutedDark mt-1">FedEx Logistics Update • 452 Records</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-100 dark:border-red-800">Failed (Data Validation)</span>
                      <span className="text-xs text-text-muted flex items-center">
                        <span className="material-symbols-outlined text-[14px] mr-1">schedule</span>
                        Today, 08:32 AM
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col md:items-end justify-center gap-2 pl-0 md:pl-4 md:border-l border-slate-100 dark:border-slate-800 min-w-[200px]">
                  <div className="text-sm text-right w-full"><span className="font-bold text-red-600 dark:text-red-400">42 Errors</span> found in row 12-54</div>
                  <div className="flex gap-2 w-full md:w-auto">
                    <button className="flex-1 md:flex-none flex items-center justify-center gap-2 h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-medium transition-colors">
                      <span className="material-symbols-outlined text-[16px]">file_download</span>
                      Error Log
                    </button>
                    <button className="flex-1 md:flex-none flex items-center justify-center gap-2 h-9 px-3 rounded-lg bg-primary text-white hover:bg-primary-dark text-sm font-medium transition-colors shadow-sm shadow-primary/20">
                      <span className="material-symbols-outlined text-[16px]">edit_note</span>
                      Fix &amp; Retry
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex flex-col md:flex-row gap-4 p-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-surface-dark shadow-sm">
                <div className="flex items-start gap-4 flex-1">
                  <div className="size-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0 text-green-600 dark:text-green-400">
                    <span className="material-symbols-outlined">inventory_2</span>
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-text-main dark:text-text-dark">Batch #UPS-INV-004</h3>
                    <p className="text-sm text-text-muted dark:text-text-mutedDark mt-1">UPS Tracking Sync • 1,200 Records</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-100 dark:border-green-800">Completed Successfully</span>
                      <span className="text-xs text-text-muted flex items-center">
                        <span className="material-symbols-outlined text-[14px] mr-1">schedule</span>
                        Yesterday, 16:45 PM
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col md:items-end justify-center gap-2 pl-0 md:pl-4 md:border-l border-slate-100 dark:border-slate-800 min-w-[200px]">
                  <div className="text-sm text-right w-full"><span className="font-bold text-green-600 dark:text-green-400">100% Processed</span></div>
                  <button className="w-full md:w-auto flex items-center justify-center gap-2 h-9 px-3 rounded-lg text-text-muted hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-medium transition-colors">
                    View Details
                    <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-auto pt-6 border-t border-slate-200 dark:border-slate-800 flex flex-col md:flex-row justify-between items-center text-xs text-text-muted dark:text-text-mutedDark gap-4">
            <p>© 2023 Marketplace Inc. All rights reserved.</p>
            <div className="flex gap-6">
              <a className="hover:text-primary" href="#">Support</a>
              <a className="hover:text-primary" href="#">API Documentation</a>
              <a className="hover:text-primary" href="#">Server Status: <span className="text-green-600 dark:text-green-400">Operational</span></a>
            </div>
          </div>
        </main>
      </div>
      
    </>
  );
};
