import { InquiriesPage } from '../pages/admin/InquiriesPage';
import { mountAdminPage } from '../runtime/mountAdminPage';
import { ensureProtectedPage } from '../../lib/guard';

void mountAdminPage(<InquiriesPage />, async () => {
  await ensureProtectedPage();
});
