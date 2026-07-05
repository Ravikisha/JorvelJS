import jorvel from '@jorvel/eslint-config';

export default [
  ...jorvel,
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**'],
  },
];
