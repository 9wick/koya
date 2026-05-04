---
sidebar_position: 5
---

# Modules

:::info Coming Soon
Module system documentation is under development.
:::

Koya uses a lightweight module system for organizing your application. Unlike traditional frameworks, Koya favors explicit composition over implicit module discovery.

## Basic Concept

```typescript
import { createHttpApp } from '@koya/core';
import { UserController } from './user/user.controller';
import { PostController } from './post/post.controller';

export const app = createHttpApp({
  controllers: [UserController, PostController],
});
```

Stay tuned for more detailed documentation on module patterns and best practices.
