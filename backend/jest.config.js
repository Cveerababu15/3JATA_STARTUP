module.exports = {
  testEnvironment: "<rootDir>/tests/helpers/jestNodeEnv.js",
  testMatch: ["**/tests/**/*.test.js"],
  setupFiles: ["<rootDir>/tests/setupEnv.js"],
  clearMocks: true,
  verbose: true,
  testTimeout: 120000,
};
