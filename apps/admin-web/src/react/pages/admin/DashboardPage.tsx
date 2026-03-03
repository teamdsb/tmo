export const DashboardPage = () => {
  return (
    <>
      <div>
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6 dark:bg-slate-900 dark:border-slate-800">
          <div className="text-sm font-semibold text-slate-900">Dashboard</div>
          <div className="flex items-center gap-4">
            <div className="relative hidden sm:block">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <span className="material-symbols-outlined text-[20px]">search</span>
              </span>
              <input className="h-9 w-64 rounded-lg border-none bg-slate-100 pl-10 pr-4 text-sm text-slate-900 placeholder-slate-500 focus:ring-2 focus:ring-primary dark:bg-slate-800 dark:text-white dark:placeholder-slate-400" placeholder="Search orders, products..." type="text" />
            </div>
            <button className="relative rounded-full bg-slate-100 p-2 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700">
              <span className="material-symbols-outlined text-[20px]">notifications</span>
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-slate-900" />
            </button>
            <button className="md:hidden rounded-lg bg-slate-100 p-2 text-slate-500 dark:bg-slate-800">
              <span className="material-symbols-outlined">menu</span>
            </button>
          </div>
        </header>
        <main className="flex-1 min-h-0 overflow-y-auto bg-background-light p-6 dark:bg-background-dark">
          <div className="mx-auto max-w-7xl">
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">System Overview</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Welcome back, here's what's happening today.</p>
              </div>
              <div className="flex gap-3">
                <button className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
                  <span className="material-symbols-outlined text-[20px]">download</span>
                  Export Report
                </button>
                <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90">
                  <span className="material-symbols-outlined text-[20px]">add</span>
                  New Task
                </button>
              </div>
            </div>
            <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
                    <span className="material-symbols-outlined">shopping_bag</span>
                  </div>
                  <span className="flex items-center text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full dark:bg-green-900/20 dark:text-green-400">+2.5%</span>
                </div>
                <div className="mt-4">
                  <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Revenue</h3>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">$48,294</p>
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400">
                    <span className="material-symbols-outlined">group</span>
                  </div>
                  <span className="flex items-center text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full dark:bg-green-900/20 dark:text-green-400">+1.2%</span>
                </div>
                <div className="mt-4">
                  <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Active Users</h3>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">2,405</p>
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400">
                    <span className="material-symbols-outlined">pending_actions</span>
                  </div>
                  <span className="flex items-center text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded-full dark:bg-red-900/20 dark:text-red-400">-0.4%</span>
                </div>
                <div className="mt-4">
                  <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Pending Orders</h3>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">142</p>
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400">
                    <span className="material-symbols-outlined">verified</span>
                  </div>
                  <span className="flex items-center text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full dark:bg-green-900/20 dark:text-green-400">+8.1%</span>
                </div>
                <div className="mt-4">
                  <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Completed Tasks</h3>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">89%</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="flex flex-col gap-6 lg:col-span-2">
                <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
                    <h3 className="text-base font-semibold text-slate-900 dark:text-white">System Audit Logs</h3>
                    <a className="text-sm font-medium text-primary hover:text-primary/80" href="#">View all</a>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-500 dark:text-slate-400">
                      <thead className="bg-slate-50 text-xs uppercase text-slate-700 dark:bg-slate-800 dark:text-slate-400">
                        <tr>
                          <th className="px-6 py-3" scope="col">Action</th>
                          <th className="px-6 py-3" scope="col">User</th>
                          <th className="px-6 py-3" scope="col">Date</th>
                          <th className="px-6 py-3" scope="col">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        <tr className="bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800">
                          <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">Updated Pricing Rules</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <div className="h-6 w-6 rounded-full bg-slate-200 bg-cover bg-center" style={{backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuAy4gW00TRlzv8IiPvgR_JYYHHxtSjXV40W5Rfkaeqytf-ei7STD4dNtDMmJW5Wc7L1a4MEfnCEKS_xmcynsHaubBIqryJq6KXbKgAX2AtG_5eS6r96YVuSlZXuJimkg4_1O1iV1avBCVKIu01A7lSpRY_6yWFU9eU59oMf6UzAf-xDjCfL_UBZL4gW16jW6f6Xb6wMzhWdaEpaOhJUSVH4sCPZK34tQ_t_qE8KxA5CoMw6WB6p6WUibI_08Dty_g4ofBkRsGIZiXA")'}} />
                              <span>Sarah J.</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">Oct 24, 2023</td>
                          <td className="px-6 py-4"><span className="inline-flex items-center rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20 dark:bg-green-900/20 dark:text-green-400">Success</span></td>
                        </tr>
                        <tr className="bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800">
                          <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">Bulk Product Import</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <div className="h-6 w-6 rounded-full bg-slate-200 bg-cover bg-center" style={{backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuBkniAcIjvaIIXELBysrI1ZTIYrtVxwx-Uwpc4d-kKPUMl88SVeWRH0leDpWZArCHLjVajrQoqjxJYZdV3R6hSPQad8BWnTF7__Q9Ur7ULtmd-yLDhsxp2fyhJs3ziHkMbvPqtn6Nx8CwSANYIHT1KM28Vj4KZCExC0IuKPw_ppVAU1Z6R4ozmvnxBci0FawBt5UuN0mX7dGzIlkZDS9e6LbbLsShoh2TUJ9zoVeqrf5UG1kM3kQA1UdigQcjXTM2ewDk3qiLoTeJE")'}} />
                              <span>Mike R.</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">Oct 24, 2023</td>
                          <td className="px-6 py-4"><span className="inline-flex items-center rounded-full bg-yellow-50 px-2 py-1 text-xs font-medium text-yellow-800 ring-1 ring-inset ring-yellow-600/20 dark:bg-yellow-900/20 dark:text-yellow-400">Pending</span></td>
                        </tr>
                        <tr className="bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800">
                          <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">Deleted User #4022</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <div className="h-6 w-6 rounded-full bg-slate-200 bg-cover bg-center" style={{backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuAhVM78IdA3bICcIuo2dWrN-Ia7_BQqyt-9yDzBVWu9_q0rlb2XsRixUe8Nt5amPPt0k-JEYYcf5GJeWOHU6cQuP8c5bOyMgPqh03IVXaZg7_guHSZKr9xG4miQncTs3yuWVLGa2YY69aeWWOziGl0XX6oYRvYUq_Ng2c5B_sWXVBgMMbomJr3rYZ7v3djtyDdKJJ-RoLv746TwzJ9qM4lnug0PcIWJBbLok-7WRwH2Xy3NC7uga4jV1w5mMgq7gbqKbGIXQ2NbjkY")'}} />
                              <span>Alex M.</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">Oct 23, 2023</td>
                          <td className="px-6 py-4"><span className="inline-flex items-center rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20 dark:bg-green-900/20 dark:text-green-400">Success</span></td>
                        </tr>
                        <tr className="bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800">
                          <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">API Key Regeneration</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">S</div>
                              <span>System</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">Oct 23, 2023</td>
                          <td className="px-6 py-4"><span className="inline-flex items-center rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/10 dark:bg-red-900/20 dark:text-red-400">Failed</span></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <h3 className="mb-4 text-base font-semibold text-slate-900 dark:text-white">Pending Import Tasks</h3>
                  <div className="space-y-4">
                    <div className="flex items-start gap-4 rounded-lg border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-primary dark:bg-blue-900/30 dark:text-blue-400">
                        <span className="material-symbols-outlined">table_chart</span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium text-slate-900 dark:text-white">Q3 Product Catalog Update.csv</h4>
                          <span className="text-xs text-slate-500">2 mins ago</span>
                        </div>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Parsing 2,400 rows. Estimated time: 45s</p>
                        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                          <div className="h-full w-[65%] rounded-full bg-primary" />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start gap-4 rounded-lg border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
                        <span className="material-symbols-outlined">imagesmode</span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium text-slate-900 dark:text-white">Supplier_Images_Batch_2.zip</h4>
                          <span className="text-xs text-slate-500">15 mins ago</span>
                        </div>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Queued for processing.</p>
                        <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                          <span className="flex h-2 w-2 rounded-full bg-yellow-400" />
                          Waiting for worker node
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-6">
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <h3 className="mb-6 text-base font-semibold text-slate-900 dark:text-white">Role-based Access</h3>
                  <div className="relative flex items-center justify-center py-6">
                    <div className="relative h-48 w-48 rounded-full border-[16px] border-slate-100 dark:border-slate-800">
                      <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 36 36">
                        <path className="text-primary" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeDasharray="70, 100" strokeWidth={3} />
                        <path className="text-purple-500" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeDasharray="20, 100" strokeDashoffset={-70} strokeWidth={3} />
                        <path className="text-teal-400" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeDasharray="10, 100" strokeDashoffset={-90} strokeWidth={3} />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-3xl font-bold text-slate-900 dark:text-white">124</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">Total Roles</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4 pt-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full bg-primary" />
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Administrators</span>
                      </div>
                      <span className="text-sm font-semibold text-slate-900 dark:text-white">70%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full bg-purple-500" />
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Vendors</span>
                      </div>
                      <span className="text-sm font-semibold text-slate-900 dark:text-white">20%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full bg-teal-400" />
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Viewers</span>
                      </div>
                      <span className="text-sm font-semibold text-slate-900 dark:text-white">10%</span>
                    </div>
                  </div>
                  <button className="mt-6 w-full rounded-lg border border-slate-200 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white">
                    Manage Permissions
                  </button>
                </div>
                <div className="rounded-xl bg-gradient-to-br from-primary to-blue-700 p-6 text-white shadow-lg">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-white/20">
                    <span className="material-symbols-outlined">support_agent</span>
                  </div>
                  <h3 className="text-lg font-bold">Need Help?</h3>
                  <p className="mt-2 text-sm text-blue-100">Contact our support team for assistance with roles or imports.</p>
                  <button className="mt-4 rounded-lg bg-white px-4 py-2 text-sm font-bold text-primary hover:bg-blue-50">
                    Contact Support
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
      
    </>
  );
};
