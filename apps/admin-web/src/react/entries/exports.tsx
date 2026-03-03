import { ExportsPage } from '../pages/admin/ExportsPage';
import { mountAdminPage } from '../runtime/mountAdminPage';

void mountAdminPage(<ExportsPage />, async () => {
  await import('../../exports.js');
});
