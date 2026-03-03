import { InquiriesPage } from '../pages/admin/InquiriesPage';
import { mountAdminPage } from '../runtime/mountAdminPage';

void mountAdminPage(<InquiriesPage />, async () => {
  await import('../../inquiries.js');
});
