import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts', 'src/openapi/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
});
