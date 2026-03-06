import { ProfilePage } from '../pages/admin/ProfilePage';
import { mountAdminPage } from '../runtime/mountAdminPage';
import { ensureProtectedPage } from '../../lib/guard';

void mountAdminPage(<ProfilePage />, async () => {
  await ensureProtectedPage();
});
