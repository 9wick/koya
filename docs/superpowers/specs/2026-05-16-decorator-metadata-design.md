# @zelt/decorator-metadata 設計仕様

## 概要

TC39 decorators 環境で reflect-metadata の代替となる汎用パッケージ。デコレーター実行時に位置情報を保存し、ビルド時に TypeScript Compiler API (TypeChecker) で型情報を抽出する。

zelt 以外のプロジェクトでも使用可能な汎用パッケージとして設計。

## 背景

- TC39 decorators では `emitDecoratorMetadata` が使えない
- 型情報（戻り値、引数、プロパティ型）をランタイムで取得できない
- GraphQL, OpenAPI, hono-client など複数パッケージで型情報が必要

## パッケージ構成

```
packages/decorator-metadata/
├── src/
│   ├── index.ts              # ランタイム API
│   ├── inspect/
│   │   └── index.ts          # 型取得 API (TypeScript 依存)
│   ├── runtime/
│   │   ├── decorators.ts     # デコレーターファクトリー
│   │   ├── store.ts          # WeakMap ストア
│   │   └── position.ts       # 位置情報取得
│   └── analyzer/
│       ├── program-cache.ts  # Program キャッシュ
│       ├── type-extractor.ts # TypeChecker で型抽出
│       └── types.ts          # 出力型定義
├── package.json
└── tsconfig.json
```

### エントリポイント

```json
{
  "exports": {
    ".": "./dist/index.js",
    "./inspect": "./dist/inspect/index.js"
  }
}
```

- `@zelt/decorator-metadata` → ランタイム API（軽量、TypeScript 非依存）
- `@zelt/decorator-metadata/inspect` → 型取得 API（TypeScript 依存）

## ランタイム API

### デコレーターファクトリー

```typescript
export const createClassDecorator = <TProps extends object>(
  props?: TProps
) => ClassDecorator;

export const createMethodDecorator = <TProps extends object>(
  props?: TProps
) => MethodDecorator;

export const createPropertyDecorator = <TProps extends object>(
  props?: TProps
) => PropertyDecorator;
```

### 使用例

```typescript
// zelt/core でのラップ
import { createClassDecorator, createMethodDecorator } from '@zelt/decorator-metadata';

export const Controller = (basePath: string) =>
  createClassDecorator({ basePath });

export const Get = (path: string) =>
  createMethodDecorator({ method: 'GET', path });

export const Column = (opts?: { nullable?: boolean }) =>
  createPropertyDecorator({ ...opts });
```

### 内部動作

1. Error スタックから `sourceFile`, `line`, `column` を取得
2. WeakMap に `{ pos, props }` を保存

## Inspect API

### 型定義

```typescript
type Position = {
  sourceFile: string;
  line: number;
  column: number;
};

type TypeInfo =
  | { kind: 'primitive'; type: 'string' | 'number' | 'boolean' | 'null' | 'undefined' }
  | { kind: 'literal'; value: string | number | boolean }
  | { kind: 'named'; name: string; module: string; isExported: boolean }
  | { kind: 'array'; items: TypeInfo }
  | { kind: 'object'; properties: PropertyInfo[] }
  | { kind: 'union'; types: TypeInfo[] }
  | { kind: 'promise'; inner: TypeInfo }
  | { kind: 'unknown' }
  | { kind: 'ref'; name: string };  // 循環参照時

type MethodInfo<TProps = unknown> = {
  name: string;
  pos: Position;
  props: TProps;
  params: Array<{ name: string; type: TypeInfo }>;
  returnType: TypeInfo;
};

type PropertyInfo<TProps = unknown> = {
  name: string;
  pos: Position;
  props: TProps;
  type: TypeInfo;
  optional: boolean;
};

type ClassMetadata<
  TClassProps = unknown,
  TMethodProps = unknown,
  TPropertyProps = unknown
> = {
  name: string;
  pos: Position;
  props: TClassProps;
  methods: MethodInfo<TMethodProps>[];
  properties: PropertyInfo<TPropertyProps>[];
};
```

### API

```typescript
type InspectOptions = {
  tsconfig?: string;  // デフォルト: './tsconfig.json'
  expandStrategy?: 'exported-only' | 'all-named' | 'always';  // デフォルト: 'exported-only'
};

export const getTypeMetadata = <T extends object>(
  cls: new (...args: any[]) => T,
  options?: InspectOptions
): Result<ClassMetadata, InspectError>;
```

### expandStrategy

| 値 | 動作 |
|----|------|
| `exported-only` | export された名前付き型は $ref、他は展開 |
| `all-named` | 全ての名前付き型は $ref |
| `always` | 全て展開 |

## Program キャッシュ

tsconfig パスをキーにキャッシュし、複数クラスの処理を効率化。

```typescript
const programCache = new Map<string, {
  program: ts.Program;
  checker: ts.TypeChecker;
}>();

export const getOrCreateProgram = (tsconfig: string): {
  program: ts.Program;
  checker: ts.TypeChecker;
};

export const clearProgramCache = (tsconfig?: string): void;
```

## TypeScript バージョン解決

ユーザーの TypeScript バージョンに応じて動的に切り替え。

| ユーザー TS | 使用される TS | 理由 |
|-------------|---------------|------|
| 5.x | ユーザーの 5.x | Compiler API 動作 |
| 6.x | ユーザーの 6.x | Compiler API 動作 |
| 7.x | バンドル 6.x | Compiler API 未提供 (Corsa API 待ち) |

```typescript
const resolveTypeScript = async (): Promise<typeof import('typescript')> => {
  const userTs = await import('typescript');
  const major = parseInt(userTs.version.split('.')[0], 10);
  
  if (major >= 7) {
    return await import('@zelt/decorator-metadata/bundled-ts');
  }
  
  return userTs;
};
```

### 依存関係

```json
{
  "peerDependencies": {
    "typescript": ">=5.0.0"
  },
  "optionalDependencies": {
    "typescript-6": "npm:typescript@~6.0.0"
  }
}
```

## エラーハンドリング

```typescript
type InspectError =
  | { code: 'NO_METADATA'; message: string }
  | { code: 'SOURCE_NOT_FOUND'; message: string }
  | { code: 'POSITION_INVALID'; message: string }
  | { code: 'TSCONFIG_ERROR'; message: string };
```

### エッジケース

| ケース | 対応 |
|--------|------|
| デコレーターなしクラス | `NO_METADATA` エラー |
| 位置情報取得失敗 | `SOURCE_NOT_FOUND` エラー |
| Promise<T> の戻り値 | unwrap して inner type を返す |
| 循環参照型 | depth 制限 + `{ kind: 'ref', name }` で打ち切り |
| ジェネリクス `T` | 具体型が不明なら `{ kind: 'unknown' }` |

## zelt/core との統合

### デコレーター移行

```typescript
// packages/core/src/http/decorators/controller.ts
import { createClassDecorator, createMethodDecorator } from '@zelt/decorator-metadata';

export const Controller = (basePath: string) =>
  createClassDecorator({ basePath });

export const Get = (path: string) =>
  createMethodDecorator({ method: 'GET', path });
```

### openapi パッケージ移行

```typescript
// packages/openapi
import { getTypeMetadata } from '@zelt/decorator-metadata/inspect';

export const generateOpenApi = (controllers: ControllerClass[], opts) => {
  const schemas = {};
  const paths = {};

  for (const cls of controllers) {
    const meta = getTypeMetadata(cls, { tsconfig: opts.tsconfig });
    if (meta.isErr()) continue;

    const { props, methods } = meta.value;
    // → OpenAPI スキーマ生成
  }

  return { openapi: '3.1.0', paths, components: { schemas } };
};
```

## 移行ステップ

1. `@zelt/decorator-metadata` パッケージ作成
2. `@zelt/core` のデコレーターを移行
3. `@zelt/openapi` を新 API に移行
4. `@zelt/hono-client`, `@zelt/graphql` も同様に移行

## 制約

- Class のみ対応（TC39 decorator の制限）
- standalone function, parameter decorator は非対応
