import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@koya/core',
    include: ['src/**/*.test.ts'],
  },
});
