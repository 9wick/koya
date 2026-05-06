# @zeltjs/auth-jwt Design Spec

## Overview

JWT Bearer認証パッケージ。`@zeltjs/core` の認証プリミティブ（`setUser`, `@Authorized`）と統合し、JWTベースの認証フローを提供する。

## Goals

- JWT署名・検証・デコード機能の提供
- `@zeltjs/core` のミドルウェアパターンに準拠した認証ミドルウェア
- Configクラスパターンによる設定のカスタマイズ
- Edge/Workers対応（`jose` ライブラリ使用）

## Non-Goals

- Session認証（`@zeltjs/auth-session` で別途提供）
- OAuth認証（`@zeltjs/auth-oauth` で別途提供）
- トークン無効化/ブラックリスト管理
- リフレッシュトークンのローテーション

## Package Structure

```
packages/auth-jwt/
├── src/
│   ├── index.ts
│   ├── jwt.config.ts
│   ├── jwt.service.ts
│   ├── jwt.middleware.ts
│   └── jwt.types.ts
├── package.json
└── tsconfig.json
```

## Dependencies

- `jose@6.0.11` — JWT操作（ESM native、Web Crypto API対応）
- `@zeltjs/core` — peerDependency（`setUser`, `@Authorized`, DI）

## API Design

### JwtPayload Type

```typescript
interface JwtPayload {
  sub?: string;
  iat?: number;
  exp?: number;
  [key: string]: unknown;
}
```

### JwtConfig

ユーザーが継承してカスタマイズするConfigクラス。

```typescript
@Config
export class JwtConfig {
  static readonly Token = JwtConfig;

  get secret(): string {
    return process.env.JWT_SECRET!;
  }

  get expiresIn(): string {
    return '1h';
  }

  get resolveUser(): (payload: JwtPayload) => Promise<{
    user: RequestContextSchema['user'];
    roles: RequestContextSchema['authRoles'];
  }> {
    return async (payload) => ({ user: payload.sub, roles: [] });
  }
}
```

### JwtService

JWT操作を行うサービス。

```typescript
@Injectable()
export class JwtService {
  constructor(private config = injectConfig(JwtConfig)) {}

  async sign(payload: Record<string, unknown>): Promise<string>
  async verify(token: string): Promise<JwtPayload>
  decode(token: string): JwtPayload | null
}
```

| Method | Description |
|--------|-------------|
| `sign(payload)` | ペイロードに署名してJWTトークンを生成 |
| `verify(token)` | トークンを検証してペイロードを返却。無効な場合は例外 |
| `decode(token)` | 検証なしでペイロードをデコード。無効な場合はnull |

### JwtMiddleware

Authorizationヘッダーからトークンを抽出し、検証後に `setUser` を呼び出す。

```typescript
@Middleware()
export class JwtMiddleware {
  constructor(
    private jwtService = inject(JwtService),
    private config = injectConfig(JwtConfig),
  ) {}

  async handle(c: Context, next: Next): Promise<void> {
    const token = extractBearerToken(c);
    if (!token) throw new HTTPException(401, { message: 'Missing token' });
    
    const payload = await this.jwtService.verify(token);
    const { user, roles } = await this.config.resolveUser(payload);
    setUser(user, roles);
    
    await next();
  }
}
```

## Exports

```typescript
export { JwtConfig } from './jwt.config';
export { JwtService } from './jwt.service';
export { JwtMiddleware } from './jwt.middleware';
export type { JwtPayload } from './jwt.types';
```

## package.json

```json
{
  "name": "@zeltjs/auth-jwt",
  "version": "0.1.0",
  "type": "module",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/zeltjs/zelt.git",
    "directory": "packages/auth-jwt"
  },
  "publishConfig": {
    "access": "public"
  },
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsdown",
    "test": "vitest run",
    "typecheck": "tsc -b"
  },
  "peerDependencies": {
    "@zeltjs/core": "workspace:*"
  },
  "dependencies": {
    "jose": "6.0.11"
  },
  "devDependencies": {
    "@zeltjs/core": "workspace:*",
    "@types/node": "22.19.17"
  }
}
```

## Usage Example

### Basic Setup

```typescript
// jwt.config.ts
import { JwtConfig } from '@zeltjs/auth-jwt';
import { Config } from '@zeltjs/core';

@Config
export class MyJwtConfig extends JwtConfig {
  get secret() {
    return process.env.JWT_SECRET!;
  }

  get expiresIn() {
    return '24h';
  }

  get resolveUser() {
    return async (payload: JwtPayload) => {
      const user = await userRepository.findById(payload.sub);
      if (!user) throw new HTTPException(401);
      return { user, roles: user.roles };
    };
  }
}
```

### Controller with Authentication

```typescript
import { Controller, Get, UseMiddleware } from '@zeltjs/core';
import { JwtMiddleware } from '@zeltjs/auth-jwt';
import { currentUser } from '@zeltjs/core';

@Controller('/users')
@UseMiddleware(JwtMiddleware)
export class UserController {
  @Get('/me')
  getMe() {
    return currentUser();
  }
}
```

### Token Generation (Login)

```typescript
import { Controller, Post, validated } from '@zeltjs/core';
import { JwtService } from '@zeltjs/auth-jwt';
import { inject } from '@zeltjs/core';

@Controller('/auth')
export class AuthController {
  constructor(private jwtService = inject(JwtService)) {}

  @Post('/login')
  async login(body = validated(loginSchema)) {
    const user = await authenticate(body.email, body.password);
    if (!user) throw new HTTPException(401);
    
    const token = await this.jwtService.sign({ sub: user.id });
    return { token };
  }
}
```

## Error Handling

| Scenario | Response |
|----------|----------|
| Missing Authorization header | 401 Unauthorized |
| Invalid token format | 401 Unauthorized |
| Expired token | 401 Unauthorized |
| Invalid signature | 401 Unauthorized |
| `resolveUser` throws | Exception propagates |

## Testing Strategy

- `JwtService.sign` / `verify` / `decode` のユニットテスト
- `JwtMiddleware` の統合テスト（モックContext使用）
- 有効期限切れトークンのテスト
- 不正なトークンのテスト

## Future Considerations

- 非対称鍵（RS256/ES256）対応 — `privateKey`/`publicKey` 設定追加
- オプショナル認証ミドルウェア（トークンがあれば検証、なくてもOK）
- `@zeltjs/auth-session`, `@zeltjs/auth-oauth` との命名・構造の一貫性
