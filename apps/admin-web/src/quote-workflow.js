import { ensureProtectedPage } from './lib/guard';

// 询报价流程页入口：当前仅负责登录态与权限守卫。
const initQuoteWorkflowPage = async () => {
  await ensureProtectedPage();
};

void initQuoteWorkflowPage();
