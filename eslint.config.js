import js from "@eslint/js";
import typescript from "@typescript-eslint/eslint-plugin";
import typescriptParser from "@typescript-eslint/parser";

export default [
  // Ignore patterns
  {
    ignores: ["dist/**", "node_modules/**", "coverage/**", "*.d.ts"],
  },

  // Base config for all TypeScript files
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        project: "./tsconfig.json",
      },
      globals: {
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": typescript,
    },
    rules: {
      // Essential JS rules (but override problematic ones)
      ...js.configs.recommended.rules,
      "no-unused-vars": "off", // Turn off base rule
      "no-undef": "off", // TypeScript handles this better

      // Essential TypeScript rules
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          args: "after-used",
        },
      ],
      "@typescript-eslint/no-explicit-any": [
        "warn",
        {
          ignoreRestArgs: true,
          // Allow any in decorators and complex generic scenarios
          fixToUnknown: false,
        },
      ],
      "@typescript-eslint/prefer-nullish-coalescing": [
        "warn", // Downgrade to warning
        {
          ignoreConditionalTests: true,
          ignorePrimitives: { string: true, number: true, boolean: true },
        },
      ],
      "@typescript-eslint/prefer-optional-chain": "warn", // Downgrade to warning
      "@typescript-eslint/no-floating-promises": "error",

      // Basic code quality
      "prefer-const": "error",
      "no-var": "error",
      eqeqeq: "error",
    },
  },

  // Relax rules for test and config files
  {
    files: ["**/*.test.ts", "**/*.spec.ts", "**/*.config.ts", "**/*.config.js"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-floating-promises": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "no-console": "off",
    },
  },

  // Relax rules for decorators and framework code
  {
    files: ["**/decorators/**/*.ts", "**/core/**/*.ts", "**/*decorator*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/prefer-nullish-coalescing": "off",
    },
  },
];
