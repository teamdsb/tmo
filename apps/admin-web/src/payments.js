import { ensureProtectedPage } from './lib/guard';

// 支付页入口：当前仅负责登录态与权限守卫。
const initPaymentsPage = async () => {
  await ensureProtectedPage();
};

void initPaymentsPage();
