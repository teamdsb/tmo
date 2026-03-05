import { UserOperationsPage } from '../pages/admin/UserOperationsPage';
import { mountAdminPage } from '../runtime/mountAdminPage';

void mountAdminPage(<UserOperationsPage />, async () => {
  await import('../../user-operations.js');
});
