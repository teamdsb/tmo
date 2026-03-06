import { SuppliersPage } from '../pages/admin/SuppliersPage';
import { mountAdminPage } from '../runtime/mountAdminPage';
import { ensureProtectedPage } from '../../lib/guard';

void mountAdminPage(<SuppliersPage />, async () => {
  await ensureProtectedPage();
});
