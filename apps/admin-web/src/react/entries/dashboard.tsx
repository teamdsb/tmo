import { DashboardPage } from '../pages/admin/DashboardPage';
import { mountAdminPage } from '../runtime/mountAdminPage';

void mountAdminPage(<DashboardPage />, async () => {
  await import('../../dashboard.js');
});
