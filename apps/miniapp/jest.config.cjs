module.exports = {
  testEnvironment: 'jsdom',
  rootDir: '.',
  testMatch: ['<rootDir>/src/**/*.test.ts?(x)'],
  transform: {
    '^.+\\.[tj]sx?$': 'babel-jest'
  },
  setupFilesAfterEnv: ['<rootDir>/src/test-utils/setup.js'],
  moduleNameMapper: {
    '^@taroify/icons/.*$': '<rootDir>/src/test-utils/taroify-icon.js'
  }
};
