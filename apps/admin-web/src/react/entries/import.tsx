import { ImportPage } from '../pages/admin/ImportPage';
import { mountAdminPage } from '../runtime/mountAdminPage';

void mountAdminPage(<ImportPage />, async () => {
  await import('../../import.js');
});
