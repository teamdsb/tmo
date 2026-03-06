import { QuoteWorkflowPage } from '../pages/admin/QuoteWorkflowPage';
import { mountAdminPage } from '../runtime/mountAdminPage';
import { ensureProtectedPage } from '../../lib/guard';

void mountAdminPage(<QuoteWorkflowPage />, async () => {
  await ensureProtectedPage();
});
