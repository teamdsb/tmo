import { createOfflineConfig } from './playwright.offline.config.mjs';

export default createOfflineConfig({ mode: 'hybrid', port: 5176, testMatch: /.*(?:\.|-)hybrid\.spec\.ts/ });
