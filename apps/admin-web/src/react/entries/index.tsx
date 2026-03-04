import { LoginPage } from '../pages/LoginPage';
import { mountLoginPage } from '../runtime/mountLoginPage';

void mountLoginPage(<LoginPage />, async () => {
  await import('../../main.js');
});
