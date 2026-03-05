import { ProfilePage } from '../pages/admin/ProfilePage';
import { mountAdminPage } from '../runtime/mountAdminPage';

void mountAdminPage(<ProfilePage />, async () => {
  await import('../../profile.js');
});
