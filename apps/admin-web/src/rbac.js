import { ensureProtectedPage } from './lib/guard';

// RBAC 页入口：当前仅负责登录态与权限守卫。
const initRbacPage = async () => {
  await ensureProtectedPage();
};

void initRbacPage();
