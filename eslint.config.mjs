import strictTypes from '@9wick/eslint-plugin-strict-type-rules';
import eslintComments from '@eslint-community/eslint-plugin-eslint-comments/configs';
import importX from 'eslint-plugin-import-x';
import oxlint from 'eslint-plugin-oxlint';
import sonarjs from 'eslint-plugin-sonarjs';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules',
      '**/dist',
      '**/.nx',
      '**/*.d.ts',
      '**/*.config.{ts,mjs,js}',
      'eslint.config.mjs',
    ],
  },
  tseslint.configs.recommended,
  ...oxlint.configs['flat/all'],
  eslintComments.recommended,
  {
    plugins: { 'import-x': importX, sonarjs },
  },
  ...strictTypes.configs.recommended,
  ...strictTypes.configs.test,
  ...strictTypes.configs.barrel,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    ignores: ['**/*.test.{ts,tsx}', 'examples/**/*.{ts,tsx}'],
    rules: {
      complexity: ['error', { max: 7 }],
      'sonarjs/cognitive-complexity': 'error',
      'no-console': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      'max-lines': ['warn', { max: 500, skipBlankLines: true, skipComments: true }],
      'import-x/no-cycle': 'error',
      'import-x/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          'newlines-between': 'always',
        },
      ],
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unnecessary-condition': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
    },
  },
  {
    files: ['**/*.test.{ts,tsx}'],
    rules: {
      'no-console': 'off',
      'max-lines': ['warn', { max: 1000, skipBlankLines: true, skipComments: true }],
      'import-x/no-namespace': 'off',
    },
  },
  {
    files: ['examples/**/*.{ts,tsx}'],
    rules: {
      'no-console': 'off',
      'import-x/no-namespace': 'off',
    },
  },
);
