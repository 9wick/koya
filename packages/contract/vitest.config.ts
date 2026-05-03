import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@koya/contract',
    include: ['src/**/*.test.ts'],
    passWithNoTests: true,
  },
});
