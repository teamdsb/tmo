import { ensureProtectedPage } from './lib/guard';

const initExportsPage = async () => {
  await ensureProtectedPage();
};

void initExportsPage();
