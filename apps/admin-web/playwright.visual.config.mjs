import { createOfflineConfig } from './playwright.offline.config.mjs';

export default createOfflineConfig({ mode: 'mock', port: 5174, testMatch: /resources\.mock\.spec\.ts/ });
