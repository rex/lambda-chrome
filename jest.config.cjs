module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/extension/test-unit/**/*.spec.js'],
  setupFilesAfterEnv: ['<rootDir>/extension/test-unit/jest-setup.js'],
  verbose: true,
  testTimeout: 10000,
  transform: {
    '^.+\\.js$': 'babel-jest'
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(parse5)/)'
  ]
}
