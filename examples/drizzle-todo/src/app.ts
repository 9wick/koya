import { createApp } from '@zeltjs/core';
import { onNode } from '@zeltjs/adapter-node';

import { controllers } from './controllers';

export const app = createApp({
  http: { controllers },
});

export default await onNode(app);
