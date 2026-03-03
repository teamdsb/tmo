const settingNavItems = [
  { href: '#general', label: 'General', active: true },
  { href: '#security', label: 'Security', active: false },
  { href: '#notifications', label: 'Notifications', active: false },
  { href: '#integrations', label: 'Integrations', active: false }
] as const;

const configHistoryRows = [
  {
    dotColor: 'bg-green-500',
    setting: 'Guest Checkout',
    changedBy: 'Admin User',
    date: 'Oct 24, 2023 14:30',
    actionLabel: 'Enabled',
    actionClass: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
  },
  {
    dotColor: 'bg-orange-500',
    setting: 'Password Policy',
    changedBy: 'System',
    date: 'Oct 22, 2023 09:15',
    actionLabel: 'Updated',
    actionClass: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
  }
] as const;

type ToggleRowProps = {
  inputId: string;
  title: string;
  description: string;
  defaultChecked?: boolean;
};

const ToggleRow = ({ inputId, title, description, defaultChecked = false }: ToggleRowProps) => {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <label className="block text-sm font-medium text-text-main dark:text-gray-200" htmlFor={inputId}>
          {title}
        </label>
        <p className="mt-1 text-xs text-text-muted">{description}</p>
      </div>
      <label className="relative inline-flex cursor-pointer items-center">
        <input className="sr-only peer" defaultChecked={defaultChecked} id={inputId} type="checkbox" />
        <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/20 dark:bg-gray-700"></div>
      </label>
    </div>
  );
};

const passwordPolicies = [
  { label: 'Require at least one special character', defaultChecked: true },
  { label: 'Require uppercase & lowercase', defaultChecked: true },
  { label: 'Enforce password rotation (90 days)', defaultChecked: false }
] as const;

export const SettingsPage = () => {
  return (
    <main className="flex h-screen flex-1 flex-col overflow-hidden bg-background-light dark:bg-background-dark">
      <header className="z-10 shrink-0 border-b border-border-light bg-surface-light px-8 py-5 dark:border-border-dark dark:bg-surface-dark">
        <div className="mx-auto flex w-full max-w-5xl items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-text-main dark:text-white">System Configuration</h1>
            <p className="mt-1 text-sm text-text-muted">
              Manage global settings, security protocols, and operational preferences.
            </p>
          </div>
          <div className="flex gap-3">
            <button className="px-4 py-2 text-sm font-medium text-text-muted transition-colors hover:text-text-main">
              Discard Changes
            </button>
            <button className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-hover">
              <span className="material-symbols-outlined text-[18px]">save</span>
              Save Configuration
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="mx-auto flex w-full max-w-5xl gap-8">
          <div className="sticky top-0 hidden w-64 shrink-0 lg:block">
            <nav className="flex flex-col gap-1">
              {settingNavItems.map((item) => (
                <a
                  key={item.href}
                  className={
                    item.active
                      ? 'flex items-center justify-between rounded-lg border border-border-light bg-white px-4 py-3 text-sm font-medium text-primary shadow-sm dark:border-border-dark dark:bg-gray-800 dark:text-blue-400'
                      : 'flex items-center justify-between rounded-lg px-4 py-3 text-sm font-medium text-text-muted transition-colors hover:bg-white/50 hover:text-text-main dark:hover:bg-gray-800/50'
                  }
                  href={item.href}
                >
                  <span>{item.label}</span>
                  {item.active ? <span className="material-symbols-outlined text-[18px]">chevron_right</span> : null}
                </a>
              ))}
            </nav>
          </div>

          <div className="flex flex-1 flex-col gap-6 pb-20">
            <section
              className="overflow-hidden rounded-xl border border-border-light bg-surface-light shadow-sm dark:border-border-dark dark:bg-surface-dark"
              id="general"
            >
              <div className="border-b border-border-light bg-gray-50/50 px-6 py-5 dark:border-border-dark dark:bg-gray-800/50">
                <h2 className="flex items-center gap-2 text-base font-semibold text-text-main dark:text-white">
                  <span className="material-symbols-outlined text-primary">tune</span>
                  Business Operations
                </h2>
              </div>
              <div className="flex flex-col gap-6 p-6">
                <ToggleRow
                  defaultChecked
                  description="If disabled, only admins can create new accounts manually."
                  inputId="new-user-reg"
                  title="Enable New User Registration"
                />
                <hr className="border-border-light dark:border-border-dark" />

                <ToggleRow
                  description="Customers can purchase without creating an account."
                  inputId="guest-checkout"
                  title="Allow Guest Checkout"
                />
                <hr className="border-border-light dark:border-border-dark" />

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-text-main dark:text-gray-200">Default Pagination Limit</label>
                    <select className="w-full rounded-lg border-border-light bg-white text-sm focus:border-primary focus:ring-primary dark:border-border-dark dark:bg-gray-800">
                      <option>20 items per page</option>
                      <option>50 items per page</option>
                      <option>100 items per page</option>
                    </select>
                    <p className="mt-1 text-xs text-text-muted">Applies to order and product lists.</p>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-text-main dark:text-gray-200">Maintenance Mode</label>
                    <div className="flex items-center gap-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 dark:border-red-900/30 dark:bg-red-900/10">
                      <span className="material-symbols-outlined text-[20px] text-red-600">warning</span>
                      <span className="text-sm font-medium text-red-800 dark:text-red-400">System is Online</span>
                      <button className="ml-auto text-xs font-semibold text-red-600 underline hover:text-red-700">
                        Switch to Maintenance
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section
              className="overflow-hidden rounded-xl border border-border-light bg-surface-light shadow-sm dark:border-border-dark dark:bg-surface-dark"
              id="security"
            >
              <div className="border-b border-border-light bg-gray-50/50 px-6 py-5 dark:border-border-dark dark:bg-gray-800/50">
                <h2 className="flex items-center gap-2 text-base font-semibold text-text-main dark:text-white">
                  <span className="material-symbols-outlined text-primary">shield</span>
                  Security & Access Control
                </h2>
              </div>
              <div className="flex flex-col gap-6 p-6">
                <div>
                  <h3 className="mb-3 text-sm font-semibold text-text-main dark:text-gray-200">Password Policy</h3>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {passwordPolicies.map((policy) => (
                      <label
                        key={policy.label}
                        className="flex cursor-pointer items-center gap-3 rounded-lg border border-border-light p-3 transition-colors hover:bg-gray-50 dark:border-border-dark dark:hover:bg-gray-800"
                      >
                        <input
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                          defaultChecked={policy.defaultChecked}
                          type="checkbox"
                        />
                        <span className="text-sm text-text-muted">{policy.label}</span>
                      </label>
                    ))}
                    <div className="p-3">
                      <label className="mb-1 block text-xs font-medium text-text-muted">Minimum Length</label>
                      <div className="flex items-center gap-2">
                        <input
                          className="h-1 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 accent-primary"
                          defaultValue="12"
                          max="32"
                          min="8"
                          type="range"
                        />
                        <span className="w-6 text-right text-sm font-bold text-text-main">12</span>
                      </div>
                    </div>
                  </div>
                </div>
                <hr className="border-border-light dark:border-border-dark" />

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-text-main dark:text-gray-200">Session Timeout (Minutes)</label>
                    <div className="relative">
                      <input
                        className="w-full rounded-lg border-border-light bg-white pl-10 text-sm focus:border-primary focus:ring-primary dark:border-border-dark dark:bg-gray-800"
                        defaultValue="30"
                        type="number"
                      />
                      <span className="material-symbols-outlined absolute top-2.5 left-3 text-[18px] text-text-muted">timer</span>
                    </div>
                    <p className="mt-1 text-xs text-text-muted">Automatic logout after inactivity.</p>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-text-main dark:text-gray-200">2FA Enforcement</label>
                    <select
                      className="w-full rounded-lg border-border-light bg-white text-sm focus:border-primary focus:ring-primary dark:border-border-dark dark:bg-gray-800"
                      defaultValue="Mandatory for Admins"
                    >
                      <option>Optional for all users</option>
                      <option>Mandatory for Admins</option>
                      <option>Mandatory for Everyone</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-text-main dark:text-gray-200">Admin Access IP Whitelist</label>
                  <div className="min-h-[80px] rounded-lg border border-border-light bg-background-light p-2 dark:border-border-dark dark:bg-gray-900">
                    <div className="flex flex-wrap gap-2">
                      {['192.168.1.45', '10.0.0.12'].map((ip) => (
                        <span
                          key={ip}
                          className="inline-flex items-center gap-1 rounded border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-text-main shadow-sm dark:border-gray-700 dark:bg-gray-800"
                        >
                          {ip}
                          <button className="text-gray-400 hover:text-red-500">
                            <span className="material-symbols-outlined text-[14px]">close</span>
                          </button>
                        </span>
                      ))}
                      <input
                        className="w-32 bg-transparent p-1 text-xs text-text-main placeholder-gray-400 focus:ring-0"
                        placeholder="Add IP address..."
                        type="text"
                      />
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-text-muted">Leave empty to allow access from any IP.</p>
                </div>
              </div>
            </section>

            <section className="mt-4" id="notifications">
              <div className="mb-3 flex items-center justify-between px-1">
                <h3 className="text-sm font-semibold text-text-main dark:text-gray-200">Recent Configuration Changes</h3>
                <a className="text-xs text-primary hover:underline" href="#">
                  View Full Audit Log
                </a>
              </div>
              <div className="overflow-hidden rounded-xl border border-border-light bg-surface-light shadow-sm dark:border-border-dark dark:bg-surface-dark">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border-light bg-gray-50 text-xs font-medium uppercase text-text-muted dark:border-border-dark dark:bg-gray-800">
                    <tr>
                      <th className="px-6 py-3">Setting</th>
                      <th className="px-6 py-3">Changed By</th>
                      <th className="px-6 py-3">Date</th>
                      <th className="px-6 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-light dark:divide-border-dark">
                    {configHistoryRows.map((row) => (
                      <tr key={`${row.setting}-${row.date}`} className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-2">
                            <span className={`h-1.5 w-1.5 rounded-full ${row.dotColor}`}></span>
                            <span className="font-medium text-text-main dark:text-gray-200">{row.setting}</span>
                          </div>
                        </td>
                        <td className="px-6 py-3 text-text-muted">{row.changedBy}</td>
                        <td className="px-6 py-3 text-text-muted">{row.date}</td>
                        <td className="px-6 py-3 text-right">
                          <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${row.actionClass}`}>
                            {row.actionLabel}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section id="integrations"></section>
          </div>
        </div>
      </div>
    </main>
  );
};
