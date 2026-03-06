import { ExportsPage } from '../pages/admin/ExportsPage';
import { mountAdminPage } from '../runtime/mountAdminPage';
import { ensureProtectedPage } from '../../lib/guard';

void mountAdminPage(<ExportsPage />, async () => {
  await ensureProtectedPage();
});
