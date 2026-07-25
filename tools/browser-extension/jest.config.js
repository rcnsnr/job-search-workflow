// jest.config.js
module.exports = {
  projects: [
    {
      displayName: "unit",
      testEnvironment: "node",
      testMatch: [
        "**/tests/filters.test.js",
        "**/tests/workflow_profile.test.js",
        "**/tests/workflow_exporter.test.js",
        "**/tests/scan_planner.test.js",
        "**/tests/service_worker_alarms.test.js",
      ],
    },
    {
      displayName: "dom",
      testEnvironment: "jsdom",
      testMatch: ["**/tests/dom.test.js", "**/tests/autoscan.test.js", "**/tests/options_unattended.test.js"],
    },
    {
      displayName: "e2e",
      testEnvironment: "node",
      testMatch: ["**/tests/e2e.test.js"],
      testTimeout: 60000,
    },
  ],
  collectCoverageFrom: [
    "*.js",
    "content/*.js",
    "!jest.config.js",
    "!scripts/**",
  ],
  coverageDirectory: "coverage",
  verbose: true,
};
