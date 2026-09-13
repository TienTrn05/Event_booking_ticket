import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import prettier from 'eslint-config-prettier';
import { builtinModules } from 'node:module';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/.local/**', '**/coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['BE/**/*.{ts,tsx,mjs}', 'Fe/*.ts', 'Fe/tests/**/*.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['Fe/src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      'no-restricted-globals': [
        'error',
        'process',
        'Buffer',
        'global',
        '__dirname',
        '__filename',
        'require',
        'module',
        'exports',
      ],
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['error', { allowConstantExport: true }],
      'no-restricted-imports': [
        'error',
        {
          paths: builtinModules,
          patterns: [
            '**/BE/**',
            '@event-ticketing/api',
            '@event-ticketing/api/**',
            '**/.env*',
            'node:*',
            'mysql2*',
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    files: ['BE/src/**/*.ts', 'Fe/src/**/*.{ts,tsx}'],
    languageOptions: { parserOptions: { projectService: true } },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
    },
  },
  prettier,
);
