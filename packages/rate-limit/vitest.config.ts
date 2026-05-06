import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@zeltjs/rate-limit',
    include: ['src/**/*.test.ts'],
  },
});
