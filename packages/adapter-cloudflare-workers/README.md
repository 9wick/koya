# @zeltjs/adapter-cloudflare-workers

Cloudflare Workers adapter for Zelt.

## Installation

```bash
pnpm add @zeltjs/adapter-cloudflare-workers
```

## Usage

```typescript
import { createHttpApp, Controller, Get } from '@zeltjs/core';
import { onCloudflareWorkers } from '@zeltjs/adapter-cloudflare-workers';

@Controller('/hello')
class HelloController {
  @Get('/')
  greet() {
    return { message: 'Hello from Workers!' };
  }
}

const app = createHttpApp({ controllers: [HelloController] });

export default onCloudflareWorkers(app);
```

## Options

```typescript
onCloudflareWorkers(app, {
  warmup: false, // default: false (lazy mode for cold start optimization)
});
```

- `warmup: false` (default) - Controllers are resolved on first request (optimized for serverless)
- `warmup: true` - All controllers are resolved during initialization
