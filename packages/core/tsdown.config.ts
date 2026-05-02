import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts', 'src/workers.ts', 'src/lambda.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  fixedExtension: false,
});
