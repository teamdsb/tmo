import { UserOperationsPage } from '../pages/admin/UserOperationsPage';
import { mountAdminPage } from '../runtime/mountAdminPage';
import { ensureProtectedPage } from '../../lib/guard';

void mountAdminPage(<UserOperationsPage />, async () => {
  await ensureProtectedPage();
});
