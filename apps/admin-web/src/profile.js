import { ensureProtectedPage } from './lib/guard';

// 个人资料页入口：仅负责登录态与权限守卫。
const initProfilePage = async () => {
  await ensureProtectedPage();
};

void initProfilePage();
