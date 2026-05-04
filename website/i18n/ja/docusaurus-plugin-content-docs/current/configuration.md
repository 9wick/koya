---
sidebar_position: 9
---

# 設定

:::info 準備中
設定のドキュメントは作成中です。
:::

Koyaはアプリケーション設定を管理するための型安全な方法を提供します。

## 環境変数

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

## コントローラーでの使用

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

設定パターンとベストプラクティスの詳細なドキュメントをお待ちください。
