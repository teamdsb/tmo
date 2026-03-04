import { ensureProtectedPage } from './lib/guard';

const initSettingsPage = async () => {
  await ensureProtectedPage();
};

void initSettingsPage();
