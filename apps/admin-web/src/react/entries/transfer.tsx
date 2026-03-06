import { TransferPage } from '../pages/admin/TransferPage';
import { mountAdminPage } from '../runtime/mountAdminPage';
import { ensureProtectedPage } from '../../lib/guard';

void mountAdminPage(<TransferPage />, async () => {
  await ensureProtectedPage();
});
