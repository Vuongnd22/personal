/** Unit tests: pure logic, no database. */
module.exports = {
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: { '^.+\\.ts$': 'ts-jest' },
  testEnvironment: 'node',
  collectCoverageFrom: ['**/*.ts', '!**/*.spec.ts', '!main.ts', '!**/*.module.ts', '!**/dto/**'],
  coverageDirectory: '../coverage/unit',
};
