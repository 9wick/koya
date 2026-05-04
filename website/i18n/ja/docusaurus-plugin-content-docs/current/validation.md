---
sidebar_position: 8
---

# バリデーション

Koyaはリクエストの検証に[Valibot](https://valibot.dev/)を使用し、型安全で軽量なバリデーションソリューションを提供します。

## 基本的な使い方

`validated()`とValibotスキーマを使用してリクエストボディを検証します：

```typescript
import { Controller, Post, validated, response } from '@koya/core';
import * as v from 'valibot';

const CreateUserSchema = v.object({
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(100)),
  email: v.pipe(v.string(), v.email()),
  age: v.optional(v.pipe(v.number(), v.minValue(0), v.maxValue(150))),
});

@Controller('/users')
export class UserController {
  @Post('/')
  create(body = validated(CreateUserSchema), res = response()) {
    // bodyは完全に型付け: { name: string; email: string; age?: number }
    return res.json({ id: '1', ...body }, 201);
  }
}
```

## バリデーションエラーレスポンス

バリデーションが失敗すると、Koyaは自動的に400レスポンスを返します：

```json
{
  "error": "validation_failed",
  "issues": [
    {
      "kind": "validation",
      "type": "email",
      "message": "Invalid email",
      "path": ["email"]
    }
  ]
}
```

## 一般的なバリデーション

### 文字列のバリデーション

```typescript
const schema = v.object({
  username: v.pipe(
    v.string(),
    v.minLength(3),
    v.maxLength(20),
    v.regex(/^[a-z0-9_]+$/i)
  ),
  email: v.pipe(v.string(), v.email()),
  url: v.pipe(v.string(), v.url()),
  uuid: v.pipe(v.string(), v.uuid()),
});
```

### 数値のバリデーション

```typescript
const schema = v.object({
  age: v.pipe(v.number(), v.minValue(0), v.maxValue(150)),
  price: v.pipe(v.number(), v.minValue(0)),
  quantity: v.pipe(v.number(), v.integer(), v.minValue(1)),
});
```

### 配列のバリデーション

```typescript
const schema = v.object({
  tags: v.pipe(
    v.array(v.string()),
    v.minLength(1),
    v.maxLength(10)
  ),
  scores: v.array(v.pipe(v.number(), v.minValue(0), v.maxValue(100))),
});
```

### オプショナルとNullable

```typescript
const schema = v.object({
  required: v.string(),
  optional: v.optional(v.string()),
  nullable: v.nullable(v.string()),
  optionalNullable: v.optional(v.nullable(v.string())),
  withDefault: v.optional(v.string(), 'default value'),
});
```

### ネストされたオブジェクト

```typescript
const AddressSchema = v.object({
  street: v.string(),
  city: v.string(),
  country: v.string(),
  zipCode: v.optional(v.string()),
});

const UserSchema = v.object({
  name: v.string(),
  address: AddressSchema,
  alternateAddresses: v.optional(v.array(AddressSchema)),
});
```

## 型推論

Valibotスキーマは自動的にTypeScriptの型推論を提供します：

```typescript
const UserSchema = v.object({
  name: v.string(),
  age: v.number(),
});

// スキーマから型を推論
type User = v.InferOutput<typeof UserSchema>;
// 等価: { name: string; age: number }
```

## なぜValibot？

- **型安全** — 自動型推論による完全なTypeScriptサポート
- **軽量** — ツリーシェイキング対応、使用するものだけを含む
- **高速** — 実行時パフォーマンスに最適化
- **構成可能** — シンプルなビルディングブロックから複雑なスキーマを構築
