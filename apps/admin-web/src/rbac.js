import { ensureProtectedPage } from './lib/guard';

const initRbacPage = async () => {
  await ensureProtectedPage();
};

void initRbacPage();
