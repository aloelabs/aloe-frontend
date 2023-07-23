/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverage: false,
  displayName: {
    name: 'SHARED',
    color: 'yellow',
  },
  silent: true,
};