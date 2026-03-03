import { SuppliersPage } from '../pages/admin/SuppliersPage';
import { mountAdminPage } from '../runtime/mountAdminPage';

void mountAdminPage(<SuppliersPage />, async () => {
  await import('../../suppliers.js');
});
