import type { ReactElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';

import { installZhLocalization } from '../../lib/i18n-zh';
import { AdminSidebar, type AdminRouteKey } from '../layout/AdminSidebar';

type BootstrapFn = () => Promise<unknown> | unknown;

const normalizePath = (value: string) => {
  if (!value || value === '/') return '/dashboard.html';
  return value;
};

const resolveCurrentKey = (currentPath: string): Exclude<AdminRouteKey, 'general' | 'security'> | null => {
  if (currentPath === '/dashboard.html') return 'dashboard';
  if (currentPath === '/products.html') return 'products';
  if (currentPath === '/orders.html') return 'orders';
  if (currentPath === '/payments.html') return 'orders';
  if (currentPath === '/import.html') return 'logistics';
  if (currentPath === '/exports.html') return 'logistics';
  if (currentPath === '/inquiries.html') return 'sourcing';
  if (currentPath === '/suppliers.html') return 'sourcing';
  if (currentPath === '/quote-workflow.html') return 'sourcing';
  if (currentPath === '/transfer.html') return 'users';
  if (currentPath === '/support.html') return 'users';
  return null;
};

const resolveCurrentSettingKey = (currentPath: string): Extract<AdminRouteKey, 'general' | 'security'> | null => {
  if (currentPath === '/settings.html') return 'general';
  if (currentPath === '/rbac.html') return 'security';
  return null;
};

const applyMainOverflowClass = () => {
  const mainColumn = document.querySelector('#react-admin-main-column');
  if (!(mainColumn instanceof HTMLElement)) {
    return;
  }

  let topLevelMain = Array.from(mainColumn.children).find((node) => node.tagName === 'MAIN');
  if (!topLevelMain) {
    topLevelMain = mainColumn.querySelector('main') || undefined;
  }

  if (topLevelMain instanceof HTMLElement) {
    const existingClassName = topLevelMain.getAttribute('class') ?? '';
    const hasOverflowClass = /\boverflow(?:-[xy])?-(?:auto|hidden|scroll)\b/.test(existingClassName);
    const requiredClasses = hasOverflowClass ? 'flex-1 min-h-0' : 'flex-1 min-h-0 overflow-y-auto';
    topLevelMain.setAttribute('class', `${existingClassName} ${requiredClasses}`.trim());
  }
};

type AdminPageProps = {
  content: ReactElement;
  currentPath: string;
};

const AdminPage = ({ content, currentPath }: AdminPageProps) => {
  return (
    <div className="flex h-screen w-full flex-row overflow-hidden">
      <AdminSidebar currentKey={resolveCurrentKey(currentPath)} currentSettingKey={resolveCurrentSettingKey(currentPath)} />
      <div id="react-admin-main-column" className="flex min-w-0 flex-1 h-screen flex-col overflow-hidden">
        {content}
      </div>
    </div>
  );
};

export const mountAdminPage = async (content: ReactElement, bootstrap: BootstrapFn) => {
  const rootContainer = document.createElement('div');
  rootContainer.setAttribute('data-react-admin-root', 'true');
  document.body.prepend(rootContainer);

  const currentPath = normalizePath(window.location.pathname);
  const root = createRoot(rootContainer);

  flushSync(() => {
    root.render(<AdminPage currentPath={currentPath} content={content} />);
  });

  applyMainOverflowClass();

  try {
    await bootstrap();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to bootstrap admin page module(s):', error);
  }

  installZhLocalization();
};
