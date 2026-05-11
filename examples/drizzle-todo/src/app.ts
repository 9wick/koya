import { onNode } from '@zeltjs/adapter-node';
import { createApp } from '@zeltjs/core';

import { controllers } from './controllers';

export const app = createApp({
  http: { controllers },
});

export default await onNode(app);
