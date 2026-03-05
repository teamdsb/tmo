import { ensureProtectedPage } from './lib/guard';

const initUserOperationsPage = async () => {
  await ensureProtectedPage();
};

void initUserOperationsPage();
