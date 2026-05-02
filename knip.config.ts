import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  workspaces: {
    'packages/core': {
      // neverthrow は今後 Result wrapper に使う想定で keep。
      ignoreDependencies: ['neverthrow'],
    },
    'packages/adapter-node': {
      ignoreDependencies: ['@hono/node-server', '@koya/core'],
    },
  },
};

export default config;
