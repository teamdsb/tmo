import { SettingsPage } from '../pages/admin/SettingsPage';
import { mountAdminPage } from '../runtime/mountAdminPage';

void mountAdminPage(<SettingsPage />, async () => {
  await import('../../settings.js');
});
