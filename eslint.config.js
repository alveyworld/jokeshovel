import js from '@eslint/js';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/.wrangler/**',
      '**/test-results/**',
      '**/playwright-report/**',
      'packages/shared/src/database.types.ts',
      'worker/worker-configuration.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks, 'jsx-a11y': jsxA11y },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      // Autofocus is deliberate on brainstorm inputs (rapid capture).
      'jsx-a11y/no-autofocus': 'off',
    },
  },
  {
    files: ['worker/**/*.ts', 'apps/web/e2e/**/*.ts', '*.config.{js,ts}', 'apps/web/*.config.ts'],
    languageOptions: { globals: { ...globals.node, ...globals.serviceworker } },
  },
);
