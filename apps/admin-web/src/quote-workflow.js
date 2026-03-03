import { ensureProtectedPage } from './lib/guard';

const initQuoteWorkflowPage = async () => {
  await ensureProtectedPage();
};

void initQuoteWorkflowPage();
