import { RbacPage } from '../pages/admin/RbacPage';
import { mountAdminPage } from '../runtime/mountAdminPage';

void mountAdminPage(<RbacPage />, async () => {
  await import('../../rbac.js');
});
