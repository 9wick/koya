import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@koya/testing',
    include: ['src/**/*.test.ts'],
  },
});
