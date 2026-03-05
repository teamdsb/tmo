import { ensureProtectedPage } from './lib/guard';

// 客户转移页 legacy 入口：当前仅负责登录态与权限守卫。
const initTransferPage = async () => {
  await ensureProtectedPage();
};

void initTransferPage();
