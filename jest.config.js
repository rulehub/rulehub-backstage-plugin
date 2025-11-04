/** @type {import('jest').Config} */
const skipCoverage = !!process.env.SKIP_COVERAGE;
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  setupFilesAfterEnv: ['<rootDir>/tests/setupTests.ts'],
  moduleNameMapper: {
    // map css/assets if needed
  },
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  collectCoverage: skipCoverage ? false : true,
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coveragePathIgnorePatterns: ['/node_modules/', '/dist/', '/tests/'],
  coverageThreshold: skipCoverage
    ? undefined
    : {
        global: {
          branches: 60,
          functions: 70,
          lines: 80,
          statements: 80,
        },
      },
};
