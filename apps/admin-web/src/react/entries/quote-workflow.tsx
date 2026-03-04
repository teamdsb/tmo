import { QuoteWorkflowPage } from '../pages/admin/QuoteWorkflowPage';
import { mountAdminPage } from '../runtime/mountAdminPage';

void mountAdminPage(<QuoteWorkflowPage />, async () => {
  await import('../../quote-workflow.js');
});
