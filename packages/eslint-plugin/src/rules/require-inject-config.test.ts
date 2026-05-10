import { RuleTester } from 'eslint';
import tsParser from '@typescript-eslint/parser';

import rule from './require-inject-config';

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: 'module',
  },
});

ruleTester.run('require-inject-config', rule, {
  valid: [
    {
      code: `
        import { inject } from '@zeltjs/core';
        import { MyService } from './my.service';
        class Test {
          constructor(private service = inject(MyService)) {}
        }
      `,
    },
    {
      code: `
        import { injectConfig } from '@zeltjs/core';
        import { AppConfig } from './app.config';
        class Test {
          constructor(private config = injectConfig(AppConfig)) {}
        }
      `,
    },
    {
      code: `
        import { inject } from '@zeltjs/core';
        import { Logger } from './logger';
        class Test {
          constructor(private logger = inject(Logger)) {}
        }
      `,
    },
  ],
  invalid: [
    {
      code: `
        import { inject } from '@zeltjs/core';
        import { AppConfig } from './app.config';
        class Test {
          constructor(private config = inject(AppConfig)) {}
        }
      `,
      errors: [
        {
          messageId: 'useInjectConfig',
          data: { configName: 'AppConfig' },
        },
      ],
      output: `
        import { inject, injectConfig } from '@zeltjs/core';
        import { AppConfig } from './app.config';
        class Test {
          constructor(private config = injectConfig(AppConfig)) {}
        }
      `,
    },
    {
      code: `
        import { inject } from '@zeltjs/core';
        import { EnvConfig } from '../modules/env/env.config';
        class Test {
          constructor(private config = inject(EnvConfig)) {}
        }
      `,
      errors: [
        {
          messageId: 'useInjectConfig',
          data: { configName: 'EnvConfig' },
        },
      ],
      output: `
        import { inject, injectConfig } from '@zeltjs/core';
        import { EnvConfig } from '../modules/env/env.config';
        class Test {
          constructor(private config = injectConfig(EnvConfig)) {}
        }
      `,
    },
  ],
});
