import { OrdersPage } from '../pages/admin/OrdersPage';
import { mountAdminPage } from '../runtime/mountAdminPage';

void mountAdminPage(<OrdersPage />, async () => {
  await import('../../orders.js');
});
