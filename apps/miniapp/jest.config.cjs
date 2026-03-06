module.exports = {
  testEnvironment: 'jsdom',
  rootDir: '.',
  testMatch: ['<rootDir>/src/**/*.test.ts?(x)'],
  transform: {
    '^.+\\.[tj]sx?$': 'babel-jest'
  },
  setupFilesAfterEnv: ['<rootDir>/src/test-utils/setup.js'],
  moduleNameMapper: {
    '^@tmo/payment-api-client$': '<rootDir>/../../packages/payment-api-client/src/index.ts',
    '^@tmo/payment-services$': '<rootDir>/../../packages/payment-services/src/index.ts',
    '^@tmo/platform-adapter$': '<rootDir>/../../packages/platform-adapter/src/index.ts',
    '^@tmo/shared/(.*)$': '<rootDir>/../../packages/shared/src/$1',
    '^@taroify/icons/.*$': '<rootDir>/src/test-utils/taroify-icon.js',
    '\\.(css|scss)$': '<rootDir>/src/test-utils/style-mock.js',
    '\\.(svg|png|jpe?g|gif|webp|avif)$': '<rootDir>/src/test-utils/file-mock.js'
  }
};
