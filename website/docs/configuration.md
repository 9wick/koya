---
sidebar_position: 9
---

# Configuration

:::info Coming Soon
Configuration documentation is under development.
:::

Koya provides a type-safe way to manage application configuration.

## Environment Variables

```typescript
import { Injectable } from '@koya/core';

@Injectable()
export class ConfigService {
  readonly port = Number(process.env.PORT ?? 3000);
  readonly databaseUrl = process.env.DATABASE_URL ?? '';
  readonly apiKey = process.env.API_KEY ?? '';
  
  get isDevelopment() {
    return process.env.NODE_ENV === 'development';
  }
  
  get isProduction() {
    return process.env.NODE_ENV === 'production';
  }
}
```

## Usage in Controllers

```typescript
import { Controller, Get, inject } from '@koya/core';
import { ConfigService } from './config.service';

@Controller('/health')
export class HealthController {
  constructor(private config = inject(ConfigService)) {}

  @Get('/')
  check() {
    return {
      status: 'ok',
      environment: this.config.isDevelopment ? 'development' : 'production',
    };
  }
}
```

Stay tuned for more detailed configuration patterns and best practices.
