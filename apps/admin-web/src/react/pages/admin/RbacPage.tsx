type RoleItem = {
  name: string;
  description: string;
  active?: boolean;
  online?: boolean;
};

const roleItems: RoleItem[] = [
  {
    name: 'Administrator',
    description: 'Full access to all settings, financial data, and user management.',
    active: true,
    online: true
  },
  {
    name: 'Sales Manager',
    description: 'Can manage orders, view customer data, and process refunds.'
  },
  {
    name: 'Operations Staff',
    description: 'Limited access to inventory management and shipping labels.'
  },
  {
    name: 'Support Agent',
    description: 'Read-only access to orders and customer profiles.'
  }
];

type PermissionItem = {
  label: string;
  description: string;
  defaultChecked?: boolean;
};

type PermissionSection = {
  icon: string;
  title: string;
  subtitle: string;
  scopeOptions: string[];
  defaultScope: string;
  permissions: PermissionItem[];
  muted?: boolean;
};

const permissionSections: PermissionSection[] = [
  {
    icon: 'shopping_bag',
    title: 'Orders & Transactions',
    subtitle: 'Manage sales, refunds, and fulfillments.',
    scopeOptions: ['All Orders', 'Assigned Only', 'Department Only'],
    defaultScope: 'All Orders',
    permissions: [
      { label: 'View Orders', description: 'Allow access to the order list and details.', defaultChecked: true },
      { label: 'Create Orders', description: 'Manually create draft orders.', defaultChecked: true },
      { label: 'Edit Orders', description: 'Modify items, shipping, or customer details.', defaultChecked: true },
      { label: 'Delete Orders', description: 'Permanently remove order records.' }
    ]
  },
  {
    icon: 'sell',
    title: 'Products & Inventory',
    subtitle: 'Catalog management and stock control.',
    scopeOptions: ['All Products', 'Vendor Only'],
    defaultScope: 'All Products',
    permissions: [
      { label: 'View Products', description: 'Browse product catalog.', defaultChecked: true },
      { label: 'Manage Inventory', description: 'Update stock levels and variants.', defaultChecked: true },
      { label: 'Edit Pricing', description: 'Modify base price and discounts.', defaultChecked: true }
    ]
  },
  {
    icon: 'group',
    title: 'Customer Data',
    subtitle: 'PII and customer relationship management.',
    scopeOptions: ['Global'],
    defaultScope: 'Global',
    permissions: [
      { label: 'View PII', description: 'See emails, phone numbers, and addresses.' },
      { label: 'Export Data', description: 'Download customer lists.' }
    ],
    muted: true
  }
];

const RoleCard = ({ role }: { role: RoleItem }) => {
  if (role.active) {
    return (
      <button className="group relative rounded-lg border border-primary bg-white p-3 text-left shadow-sm ring-1 ring-primary/20 dark:border-primary dark:bg-surface-dark">
        <div className="mb-1 flex items-start justify-between">
          <h3 className="text-sm font-semibold text-text-main dark:text-white">{role.name}</h3>
          <span className="mt-1.5 h-2 w-2 rounded-full bg-green-500"></span>
        </div>
        <p className="text-xs leading-relaxed text-text-secondary">{role.description}</p>
        <div className="absolute right-2 bottom-2 opacity-0 transition-opacity group-hover:opacity-100">
          <span className="material-symbols-outlined text-lg text-text-secondary hover:text-primary">more_horiz</span>
        </div>
      </button>
    );
  }

  return (
    <button className="group rounded-lg border border-transparent p-3 text-left transition-all hover:border-border-light hover:bg-white dark:hover:border-border-dark dark:hover:bg-surface-dark">
      <div className="mb-1 flex items-start justify-between">
        <h3 className="text-sm font-semibold text-text-main dark:text-white">{role.name}</h3>
        <span className="mt-1.5 h-2 w-2 rounded-full bg-gray-300 dark:bg-gray-600"></span>
      </div>
      <p className="text-xs leading-relaxed text-text-secondary">{role.description}</p>
    </button>
  );
};

const PermissionRow = ({ item }: { item: PermissionItem }) => {
  return (
    <label className="group flex cursor-pointer items-start gap-3">
      <input
        className="mt-1 h-4 w-4 rounded border-border-light text-primary focus:ring-primary"
        defaultChecked={item.defaultChecked}
        type="checkbox"
      />
      <div>
        <span className="block text-sm font-medium text-text-main transition-colors group-hover:text-primary dark:text-white">
          {item.label}
        </span>
        <span className="mt-0.5 block text-xs text-text-secondary">{item.description}</span>
      </div>
    </label>
  );
};

export const RbacPage = () => {
  return (
    <main className="flex h-screen flex-1 flex-col overflow-hidden">
      <header className="flex shrink-0 items-center justify-between border-b border-border-light bg-surface-light px-8 py-5 dark:border-border-dark dark:bg-surface-dark">
        <div>
          <h1 className="text-2xl font-bold text-text-main dark:text-white">Roles & Permissions</h1>
        </div>
        <div className="flex gap-3">
          <button className="rounded-lg border border-border-light bg-white px-4 py-2 text-sm font-medium text-text-main shadow-sm transition-colors hover:bg-gray-50 dark:border-border-dark dark:bg-surface-dark dark:text-white dark:hover:bg-gray-800">
            Cancel
          </button>
          <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700">
            <span className="material-symbols-outlined text-lg">save</span>
            Save Changes
          </button>
        </div>
      </header>

      <div className="flex flex-1 flex-row overflow-hidden">
        <div className="flex w-80 flex-col overflow-y-auto border-r border-border-light bg-background-light dark:border-border-dark dark:bg-background-dark">
          <div className="sticky top-0 z-10 border-b border-border-light bg-surface-light/50 p-4 backdrop-blur-sm dark:border-border-dark">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-text-secondary">Roles</h2>
              <button className="rounded p-1 text-primary transition-colors hover:bg-primary-light hover:text-blue-700">
                <span className="material-symbols-outlined text-xl">add_circle</span>
              </button>
            </div>
            <div className="relative">
              <span className="material-symbols-outlined absolute top-2.5 left-2.5 text-lg text-text-secondary">search</span>
              <input
                className="w-full rounded-lg border border-border-light bg-white py-2 pr-3 pl-9 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary dark:border-border-dark dark:bg-surface-dark"
                placeholder="Search roles..."
                type="text"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 p-3">
            {roleItems.map((role) => (
              <RoleCard key={role.name} role={role} />
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-surface-light p-8 dark:bg-surface-dark">
          <div className="mx-auto max-w-4xl space-y-8">
            <div className="flex flex-col gap-6 border-b border-border-light pb-8 dark:border-border-dark">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="mb-2 text-xl font-bold text-text-main dark:text-white">Administrator Configuration</h2>
                  <p className="text-sm text-text-secondary">Define what this role can see and do within the dashboard.</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-text-secondary">Apply Template:</span>
                  <select
                    className="form-select rounded-lg border-border-light bg-background-light py-2 pl-3 pr-8 text-sm focus:border-primary focus:ring-primary dark:border-border-dark dark:bg-background-dark"
                    defaultValue="Super Admin"
                  >
                    <option>Custom Configuration</option>
                    <option>Super Admin</option>
                    <option>Store Manager</option>
                    <option>Support Lead</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              {permissionSections.map((section) => (
                <div
                  key={section.title}
                  className={`overflow-hidden rounded-xl border border-border-light bg-white shadow-sm dark:border-border-dark dark:bg-surface-dark ${
                    section.muted ? 'opacity-80' : ''
                  }`}
                >
                  <div className="flex items-center justify-between border-b border-border-light bg-background-light px-6 py-4 dark:border-border-dark dark:bg-[#1e2532]">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg border border-border-light bg-white p-2 shadow-sm dark:border-border-dark dark:bg-surface-dark">
                        <span className={`material-symbols-outlined text-xl ${section.muted ? 'text-text-secondary' : 'text-primary'}`}>
                          {section.icon}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-text-main dark:text-white">{section.title}</h3>
                        <p className="text-xs text-text-secondary">{section.subtitle}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="mr-2 text-xs font-medium uppercase tracking-wide text-text-secondary">Data Scope</label>
                      <select
                        className="form-select rounded-md border-border-light bg-white py-1.5 pl-2 pr-7 text-xs focus:border-primary focus:ring-primary dark:border-border-dark dark:bg-surface-dark"
                        defaultValue={section.defaultScope}
                      >
                        {section.scopeOptions.map((scope) => (
                          <option key={scope}>{scope}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-2">
                    {section.permissions.map((permission) => (
                      <PermissionRow key={permission.label} item={permission} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};
