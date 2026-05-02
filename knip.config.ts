import type { KnipConfig } from 'knip';

// Runtime deps will be consumed in later phases; keep ignored until imports land.
const config: KnipConfig = {
  workspaces: {
    'packages/core': {
      ignoreDependencies: ['@needle-di/core', 'hono', 'neverthrow', 'valibot'],
    },
    'packages/adapter-node': {
      ignoreDependencies: ['@hono/node-server', '@koya/core'],
    },
  },
};

export default config;
