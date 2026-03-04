import type { ReactElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';

type BootstrapFn = () => Promise<unknown> | unknown;

export const mountLoginPage = async (page: ReactElement, bootstrap: BootstrapFn) => {
  const rootContainer = document.createElement('div');
  rootContainer.setAttribute('data-react-admin-root', 'true');
  document.body.prepend(rootContainer);

  const root = createRoot(rootContainer);
  flushSync(() => {
    root.render(page);
  });

  try {
    await bootstrap();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to bootstrap login page module(s):', error);
  }
};
