import { ensureProtectedPage } from './lib/guard';

// 供应商页入口：当前仅负责登录态与权限守卫。
const initSuppliersPage = async () => {
  await ensureProtectedPage();
};

void initSuppliersPage();
