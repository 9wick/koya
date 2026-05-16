import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@zeltjs/validator-valibot',
    include: ['src/**/*.test.ts'],
  },
});
