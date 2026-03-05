import { ensureProtectedPage } from './lib/guard';

// 导出页入口：目前仅负责登录态与权限守卫。
const initExportsPage = async () => {
  await ensureProtectedPage();
};

void initExportsPage();
