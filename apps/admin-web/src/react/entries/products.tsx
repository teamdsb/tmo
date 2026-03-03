import { ProductsPage } from '../pages/admin/ProductsPage';
import { mountAdminPage } from '../runtime/mountAdminPage';

void mountAdminPage(<ProductsPage />, async () => {
  await import('../../products.js');
});
