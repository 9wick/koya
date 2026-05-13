# auth-jwtからneverthrow廃止 + ESLint設定整理

## 背景

フレームワーク内部でのneverthrow使用を見直した結果:
- `packages/contract`: CLIツールとしてRailway-Oriented Programmingが適切 → neverthrow維持
- `packages/auth-jwt`: 単純なtry-catchで十分 → neverthrow廃止

現状のESLint設定は各パッケージ/ファイル単位で例外を追加しており、一貫性がない。

## 設計

### 1. ESLint設定の整理

**方針:** グローバルでthrow/try-catch許可、contractのみ禁止

**変更内容:**

1. グローバルルールを追加:
```javascript
{
  files: ['**/*.{ts,tsx}'],
  rules: {
    '@9wick/strict-type-rules/no-throw': 'off',
    '@9wick/strict-type-rules/no-try-catch': 'off',
  },
},
```

2. contractのみ禁止ルールを追加:
```javascript
{
  files: ['packages/contract/src/**/*.{ts,tsx}'],
  ignores: ['**/*.test.{ts,tsx}'],
  rules: {
    '@9wick/strict-type-rules/no-throw': 'error',
    '@9wick/strict-type-rules/no-try-catch': 'error',
  },
},
```

3. 以下の個別例外設定を削除:
   - core, validate-valibot のno-throw/no-try-catch off
   - contract analyzer/emit のno-throw/no-try-catch off
   - contract watch/cli のno-try-catch off
   - cli commands のno-throw/no-try-catch off
   - kv memory-kv.driver のno-throw off
   - kv-driver-redis のno-throw/no-try-catch off
   - rate-limit service のno-try-catch off
   - examples のno-throw off

### 2. auth-jwt/jwt.service.ts の変更

**Before:**
```typescript
import { fromThrowable } from 'neverthrow';

decode(token: string): JwtPayload | null {
  const safeDecode = fromThrowable(decodeJwt<JwtPayload>);
  return safeDecode(token).unwrapOr(null);
}
```

**After:**
```typescript
decode(token: string): JwtPayload | null {
  try {
    return decodeJwt<JwtPayload>(token);
  } catch {
    return null;
  }
}
```

### 3. 依存関係の整理

`packages/auth-jwt/package.json` から `neverthrow` 依存を削除。

## 影響範囲

- `eslint.config.mjs`: ルール整理
- `packages/auth-jwt/src/jwt.service.ts`: neverthrow廃止
- `packages/auth-jwt/package.json`: neverthrow依存削除

## テスト計画

1. `pnpm lint` が全パッケージで通ること
2. `packages/contract` でthrowを使うとlintエラーになること
3. `packages/auth-jwt` のテストが通ること
