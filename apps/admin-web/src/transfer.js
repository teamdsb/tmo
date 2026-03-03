import { ensureProtectedPage } from './lib/guard';

const initTransferPage = async () => {
  await ensureProtectedPage();
};

void initTransferPage();
