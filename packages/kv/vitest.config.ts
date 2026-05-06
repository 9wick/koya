import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@zeltjs/kv',
    include: ['src/**/*.test.ts'],
    exclude: ['src/compliance.test.ts'],
  },
});
