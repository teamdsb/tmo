import { ensureProtectedPage } from './lib/guard';

const initPaymentsPage = async () => {
  await ensureProtectedPage();
};

void initPaymentsPage();
