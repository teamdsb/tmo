import { TransferPage } from '../pages/admin/TransferPage';
import { mountAdminPage } from '../runtime/mountAdminPage';

void mountAdminPage(<TransferPage />, async () => {
  await import('../../transfer.js');
});
