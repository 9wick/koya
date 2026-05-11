import type { ESLint } from 'eslint';

import configDiScope from './rules/config-di-scope';
import decoratorFileNaming from './rules/decorator-file-naming';
import requireInjectConfig from './rules/require-inject-config';

const plugin: ESLint.Plugin = {
  rules: {
    'config-di-scope': configDiScope,
    'decorator-file-naming': decoratorFileNaming,
    'require-inject-config': requireInjectConfig,
  },
};

export default plugin;
