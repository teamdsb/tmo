import { SupportWorkspacePage } from '../pages/admin/SupportWorkspacePage';
import { mountAdminPage } from '../runtime/mountAdminPage';
import { ensureProtectedPage } from '../../lib/guard';

void mountAdminPage(<SupportWorkspacePage />, async () => {
  await ensureProtectedPage();
});
