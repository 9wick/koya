import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@zeltjs/auth-jwt',
    include: ['src/**/*.test.ts'],
  },
});
