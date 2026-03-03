import { ensureProtectedPage } from './lib/guard';

const initSuppliersPage = async () => {
  await ensureProtectedPage();
};

void initSuppliersPage();
