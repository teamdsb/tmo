import { PaymentsPage } from '../pages/admin/PaymentsPage';
import { mountAdminPage } from '../runtime/mountAdminPage';

void mountAdminPage(<PaymentsPage />, async () => {
  await import('../../payments.js');
});
