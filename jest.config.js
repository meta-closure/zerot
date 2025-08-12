/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: './',
  globals: {
    'ts-jest': {
      tsconfig: {
        // Ensure these match your main tsconfig.json for decorators
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
        target: 'es2020',
        // Add paths from tsconfig.json if needed for tests
        baseUrl: './src',
        paths: {
          "zerot": ["./index.ts"],
          "zerot/*": ["./*"]
        }
      },
    },
  },
  moduleNameMapper: {
    "^zerot(|/.*)$": "<rootDir>/src/$1",
    "^@/(.*)$": "<rootDir>/examples/user-management/$1"
  },
  testMatch: [
    "<rootDir>/tests/unit/**/*.test.ts",
    "<rootDir>/tests/integration/**/*.integration.test.ts",
    "<rootDir>/examples/**/*.test.ts"
  ],
  moduleFileExtensions: ['js', 'json', 'jsx', 'ts', 'tsx', 'node'],
};
