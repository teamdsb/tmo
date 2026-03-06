import { RbacPage } from '../pages/admin/RbacPage';
import { mountAdminPage } from '../runtime/mountAdminPage';
import { ensureProtectedPage } from '../../lib/guard';

void mountAdminPage(<RbacPage />, async () => {
  await ensureProtectedPage();
});
