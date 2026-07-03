import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import globals from 'globals';

const sharedLangOpts = {
  parserOptions: {
    ecmaVersion: 2023,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  globals: { ...globals.browser, ...globals.node },
};

const sharedRules = {
  'no-console': ['warn', { allow: ['warn', 'error'] }],
  'no-debugger': 'error',
  'prefer-const': 'error',
  eqeqeq: ['error', 'always'],
};

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', '**/*.d.ts'],
  },
  // Plain JS — no TypeScript parser, no @typescript-eslint rules.
  {
    files: ['**/*.{js,jsx,mjs,cjs}'],
    languageOptions: sharedLangOpts,
    rules: sharedRules,
  },
  // TypeScript — full @typescript-eslint pass.
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { ...sharedLangOpts, parser: tsParser },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...sharedRules,
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports', disallowTypeAnnotations: true },
      ],
      '@typescript-eslint/no-import-type-side-effects': 'error',
    },
  },
];
