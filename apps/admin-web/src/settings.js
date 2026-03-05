import { ensureProtectedPage } from './lib/guard';

// 设置页入口：当前仅负责登录态与权限守卫。
const initSettingsPage = async () => {
  await ensureProtectedPage();
};

void initSettingsPage();
