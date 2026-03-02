const normalizePath = (value) => {
  if (!value || value === '/') return '/dashboard.html';
  return value;
};

const currentPath = normalizePath(window.location.pathname);
const supportedPaths = new Set(['/products.html', '/orders.html', '/import.html', '/inquiries.html']);

if (!supportedPaths.has(currentPath)) {
  // Dashboard already has native sidebar; login page should not have sidebar.
} else if (!document.querySelector('[data-admin-unified-sidebar="true"]')) {
  const navItems = [
    { key: 'dashboard', href: '/dashboard.html', icon: 'dashboard', label: 'Dashboard' },
    { key: 'products', href: '/products.html', icon: 'inventory_2', label: 'Products' },
    { key: 'orders', href: '/orders.html', icon: 'shopping_cart', label: 'Orders', badge: '12' },
    { key: 'logistics', href: '/import.html', icon: 'local_shipping', label: 'Logistics' },
    { key: 'sourcing', href: '/inquiries.html', icon: 'language', label: 'Sourcing' },
    { key: 'users', href: '#', icon: 'group', label: 'Users' }
  ];

  const currentKey = (() => {
    if (currentPath === '/products.html') return 'products';
    if (currentPath === '/orders.html') return 'orders';
    if (currentPath === '/import.html') return 'logistics';
    if (currentPath === '/inquiries.html') return 'sourcing';
    return 'dashboard';
  })();

  const itemClass = (key) => {
    if (key === currentKey) {
      return 'flex items-center gap-2.5 rounded-lg bg-primary/10 px-3 py-1.5 text-primary transition-colors';
    }
    return 'flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 transition-colors';
  };

  const sidebar = document.createElement('aside');
  sidebar.setAttribute('data-admin-unified-sidebar', 'true');
  sidebar.className = 'hidden md:flex w-64 h-screen shrink-0 overflow-hidden flex-col border-r border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800';

  const menuHtml = navItems.map((item) => {
    return `
      <a class="${itemClass(item.key)}" href="${item.href}">
        <span class="material-symbols-outlined">${item.icon}</span>
        <span class="font-medium">${item.label}</span>
        ${item.badge ? `<span class="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400">${item.badge}</span>` : ''}
      </a>
    `;
  }).join('');

  sidebar.innerHTML = `
    <div class="flex h-14 items-center gap-2.5 px-5 border-b border-slate-100 dark:border-slate-800">
      <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-white">
        <span class="material-symbols-outlined text-xl">dataset</span>
      </div>
      <h1 class="text-base font-bold text-slate-900 dark:text-white">AdminPanel</h1>
    </div>
    <nav class="flex-1 overflow-hidden px-2 py-2 space-y-0.5">
      ${menuHtml}
      <div class="my-2 border-t border-slate-200 dark:border-slate-800"></div>
      <div class="px-3 py-1.5">
        <p class="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Settings</p>
        <a class="flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 transition-colors" href="#">
          <span class="material-symbols-outlined">settings</span>
          <span class="font-medium">General</span>
        </a>
        <a class="flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 transition-colors" href="#">
          <span class="material-symbols-outlined">security</span>
          <span class="font-medium">Security</span>
        </a>
      </div>
    </nav>
    <div class="border-t border-slate-200 p-3 dark:border-slate-800">
      <div class="flex items-center gap-3">
        <div class="h-10 w-10 overflow-hidden rounded-full bg-slate-200 bg-cover bg-center" style="background-image: url('https://lh3.googleusercontent.com/aida-public/AB6AXuBPy8Zn4eTa8nLrSVxsJOuCpCUau5cDk1bcbi64t2ZdScbx9T_WYEHoZGyxwwuF-uRTEw-c_7FeK0a8aS8HmTCyF7XHqdETDILn36tuimXW7W9RhnWA_NX5-VRIzzRRstS3pDShkofKyDvukaUV2tLCLiacnsBSYfBp1wXruvemUlLGeiA2TcoEpGAGtwXI4E1v5i594_40WlbP9gQX-_knZAnho6J29vAeZ7EcMoU7sT-d6L9g_zhvTVA48r_93NS6HWAl-bfPXYo');"></div>
        <div class="flex flex-col">
          <span class="text-sm font-semibold text-slate-900 dark:text-white">Alex Morgan</span>
          <span class="text-xs text-slate-500 dark:text-slate-400">Senior Admin</span>
        </div>
      </div>
    </div>
  `;

  const mainColumn = document.createElement('div');
  mainColumn.className = 'flex min-w-0 flex-1 h-screen flex-col overflow-hidden';

  const body = document.body;
  const pageNodes = Array.from(body.children).filter((node) => node.tagName !== 'SCRIPT');
  pageNodes.forEach((node) => mainColumn.appendChild(node));

  const topLevelMain = Array.from(mainColumn.children).find((node) => node.tagName === 'MAIN');
  if (topLevelMain) {
    const existingClassName = topLevelMain.getAttribute('class') ?? '';
    const hasOverflowClass = /\boverflow(?:-[xy])?-(?:auto|hidden|scroll)\b/.test(existingClassName);
    const requiredClasses = hasOverflowClass
      ? 'flex-1 min-h-0'
      : 'flex-1 min-h-0 overflow-y-auto';
    topLevelMain.setAttribute('class', `${existingClassName} ${requiredClasses}`.trim());
  }

  const wrapper = document.createElement('div');
  wrapper.className = 'flex h-screen w-full flex-row overflow-hidden';
  wrapper.appendChild(sidebar);
  wrapper.appendChild(mainColumn);

  const firstScript = body.querySelector('script');
  body.insertBefore(wrapper, firstScript);
}
