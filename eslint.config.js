// apps/dashboard는 자체 oxlint(apps/dashboard/package.json "lint")를 쓴다.
// 이 설정은 apps/relay, packages/shared(Node/TS 쪽)를 검사한다.
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import prettier from 'eslint-config-prettier';

export default [
  {
    ignores: ['**/dist/**', '**/node_modules/**', 'apps/dashboard/**'],
  },
  {
    files: ['apps/relay/src/**/*.ts', 'packages/shared/src/**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        project: false,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  prettier,
];
