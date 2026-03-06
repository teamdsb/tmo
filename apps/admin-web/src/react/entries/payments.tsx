import { PaymentsPage } from '../pages/admin/PaymentsPage';
import { mountAdminPage } from '../runtime/mountAdminPage';
import { ensureProtectedPage } from '../../lib/guard';

void mountAdminPage(<PaymentsPage />, async () => {
  await ensureProtectedPage();
});
