import { createOfflineConfig } from './playwright.offline.config.mjs';

export default createOfflineConfig({
  mode: 'hybrid', port: 5178, basePath: '/admin/',
  testMatch: /admin-access\.hybrid\.spec\.ts/,
  grep: /order payment links honor the application base path/
});
