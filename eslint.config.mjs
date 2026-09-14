import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

export default defineConfig(
  {
    ignores: ['node_modules/**', 'dist/**', 'target/**', 'test-results/**', 'playwright-report/**'],
  },
  {
    files: ['**/*.{js,mjs,ts,mts}'],
    extends: [js.configs.recommended],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      'no-var': 'error',
      'prefer-const': 'error',
    },
  },
  { files: ['client/**/*.ts'], languageOptions: { globals: globals.browser } },
  { files: ['scripts/**/*.{ts,mjs}', '*.{ts,mjs}'], languageOptions: { globals: globals.node } },
  // Integration helpers execute callbacks in the browser as well as the Node runner.
  {
    files: ['tests/**/*.{ts,mts,mjs}'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  {
    files: ['**/*.{ts,mts}'],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  prettier,
);
