import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@koya/adapter-node',
    include: ['src/**/*.test.ts'],
  },
});
