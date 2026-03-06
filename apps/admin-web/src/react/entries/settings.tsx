import { SettingsPage } from '../pages/admin/SettingsPage';
import { mountAdminPage } from '../runtime/mountAdminPage';
import { ensureProtectedPage } from '../../lib/guard';

void mountAdminPage(<SettingsPage />, async () => {
  await ensureProtectedPage();
});
