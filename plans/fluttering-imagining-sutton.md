# Runtime Preset 抽象化と Env Module の DI 化

## Context

### 現状の問題

1. **`process.env` 直アクセスが散在 (SSoT 違反)**
   - `packages/core/src/http/error-handler.ts:1-7` — `typeof process` ガード付きで NODE_ENV を読む
   - `packages/core/src/modules/env/env.service.ts:21,24,33` — `getString` / `getInteger` / `getBoolean` 全てで `process.env` 直アクセス
   - `eslint.config.mjs:149-152, 173-176` で 2 箇所の `no-process-access` exception

2. **runtime 抽象が無い**
   - core が Node 前提。Cloudflare Workers のような環境 (`process.env` 不在、`import { env } from 'cloudflare:workers'`) を考慮していない
   - HttpApp 以外の app 種別 (Scheduler 等) が将来増えた時、runtime ごとに `createNodeHttpApp` / `createWorkerHttpApp` / `createNodeScheduler` … と関数を増やすと組み合わせ爆発する

3. **error-handler の env 結合**
   - フレームワーク既定の終端 fallback `handleError` がモジュールレベルで `process.env` を触っているため、Workers 移植時に必ず障害になる

### 目指す姿

- **Runtime preset を一級値として導入**: `onNode` / `onCfWorker` の object で「DI 設定 + entry helper」をまとめる
- **`createHttpApp(runtime, options)`**: 第一引数で runtime を受ける。将来 `createScheduler(runtime, …)` 等が来ても同じ runtime preset を共有できる
- **`process.env` 直アクセスは adapter-node の 1 ファイル、`cloudflare:workers` env は adapter-workers の 1 ファイルにのみ存在**
- **`EnvService` の public API は不変**: 利用側コードに変更を強制しない
- **error-handler を DI 化**: `EnvService` 経由で env を読み、`process.env` 直依存を完全消滅、`typeof process` ガード不要に

## Scope (PR 分割)

- **PR-1 (本 plan)**: core の Runtime 抽象 + EnvConfig.getRaw + EnvService 改修 + adapter-node に NodeEnvConfig/onNode + DefaultErrorHandler DI 化 + 全呼び出し箇所更新 + test 追加・書き換え
- **PR-2 (別 plan)**: `packages/adapter-workers` 新設 + `WorkersEnvConfig` + `onCfWorker` preset

## Implementation Plan (PR-1)

### Phase 1 — core: Runtime 抽象 + EnvConfig.getRaw 抽象化

#### 1.1 `Runtime` 型導入

責務は **DI 用の最小契約のみ** (`configs`)。adapter 固有の helper (例: `serve`) は extension として上から重ねる。

**新規作成**
- `packages/core/src/runtime/types.ts`
  ```ts
  import type { ConfigClass } from '../config';
  export type Runtime = {
    readonly configs: readonly ConfigClass[];
  };
  ```
- `packages/core/src/runtime/index.ts` — `export type { Runtime }`

**修正**
- `packages/core/src/index.ts` — `Runtime` 型を export

#### 1.2 `EnvConfig` 改修 — `getRaw` を fail-fast default で導入

`@Config` decorator は `injectable()` を呼ぶため **abstract class 不可** (verified at `packages/core/src/config/decorator.ts`)。代替として default 実装を **明示的 throw** にして silent failure を防ぐ。

```ts
// packages/core/src/modules/env/env.config.ts
@Config
export class EnvConfig {
  static readonly Token = EnvConfig;

  get envFilePath(): string[] { return ['.env']; }

  // Runtime preset (onNode / onCfWorker) を渡し忘れた場合に、fail-fast で気づける。
  // silent undefined にすると production NODE_ENV 判定が誤動作する。
  getRaw(_key: string): string | undefined {
    throw new Error(
      'EnvConfig.getRaw must be overridden by a runtime preset. ' +
      'Pass onNode (from @zeltjs/adapter-node) or onCfWorker (from @zeltjs/adapter-workers) ' +
      'as the first argument to createHttpApp().',
    );
  }
}
```

**根拠**: CLAUDE.md "NEVER Suppress errors without handling" / レビュー指摘 (ts-reviewer #2, codex Medium)。

#### 1.3 `EnvService` 改修 — `process.env` 直アクセス廃止

```ts
// packages/core/src/modules/env/env.service.ts
@Injectable()
export class EnvService {
  constructor(private config = injectConfig(EnvConfig)) {}

  getString<D extends string | null | undefined>(key: string, def: D): string | D {
    return this.config.getRaw(key) ?? def;
  }

  getInteger<D extends number | null | undefined>(key: string, def: D): number | D {
    const val = this.config.getRaw(key);
    if (val === undefined) return def;
    const parsed = parseInt(val, 10);
    if (Number.isNaN(parsed)) return def;
    return parsed;
  }

  getBoolean<D extends boolean | null | undefined>(key: string, def: D): boolean | D {
    const val = this.config.getRaw(key);
    if (val === undefined) return def;
    return val === 'true' || val === '1';
  }
}
```

- public API (`getString` / `getInteger` / `getBoolean`) は引数・戻り値・挙動すべて不変
- `ensureLoaded` ロジックは削除 (dotenv ロード責務は adapter-node に移譲)

#### 1.4 `env.lib.ts` を core から削除し adapter-node に移管

- `packages/core/src/modules/env/env.lib.ts` — **削除**
- `packages/core/src/modules/env/index.ts` から `env.lib` の re-export を撤去 (もし露出していれば)
- 移管先: `packages/adapter-node/src/env/dotenv-loader.ts` (新規)

#### 1.5 `createHttpApp` signature 変更

```ts
// packages/core/src/http/app.ts
export const createHttpApp = (
  runtime: Runtime,
  options: CreateHttpAppOptions,
): HttpApp => {
  const resolver = createContainer({
    configs: [...runtime.configs, ...(options.configs ?? [])],
  });
  // ... 既存ロジック (Phase 2 で更に DefaultErrorHandler 統合)
};
```

`CreateHttpAppOptions` から `runtime` 関連は分離。`configs` merge は **runtime 先 → user options 後**（後勝ち）で固定する。これにより利用者が `EnvConfig` を上書きしたい場合に override 可能。

### Phase 2 — core: DefaultErrorHandler の DI 化 + 単体テスト追加

#### 2.1 `DefaultErrorHandler` クラス導入

**根拠 (class 採用)**: CLAUDE.md は "DI allows the use of classes, but it should be limited to their use as containers only" と明記。本クラスは `EnvService` を constructor inject する DI bean として class 形態を採る。FP 化 (factory function) と比較して、`@Injectable()` decorator + needle-di token resolution に乗れる利点が上回る。

```ts
// packages/core/src/http/error-handler.ts
import { inject } from '@needle-di/core';
import { HTTPException } from 'hono/http-exception';

import { Injectable } from '../decorators/injectable';
import { EnvService } from '../modules/env/env.service';

@Injectable()
export class DefaultErrorHandler {
  constructor(private env = inject(EnvService)) {}

  handle(err: Error): Response {
    if (err instanceof HTTPException) return err.getResponse();
    const isDev = this.env.getString('NODE_ENV', '') === 'development';
    const message = isDev ? err.message : 'internal server error';
    return Response.json({ code: 'INTERNAL_ERROR', message }, { status: 500 });
  }
}
```

旧 `handleError` 関数は削除。`typeof process` ガードも削除 (環境分岐は adapter で解決済)。

#### 2.2 `app.ts` 統合

```ts
// packages/core/src/http/app.ts
import { DefaultErrorHandler } from './error-handler';

const createErrorHandler =
  (errorHandlers: readonly ErrorHandlerInstance[], fallback: DefaultErrorHandler) =>
  async (err: Error, c: RequestContext): Promise<Response> => {
    for (const handler of errorHandlers) {
      const result = await handler.onError(err, c);
      if (result) return result;
    }
    return fallback.handle(err);
  };

// createHttpApp 内
const fallbackHandler = resolver.get(DefaultErrorHandler);
hono.onError(createErrorHandler(errorHandlers, fallbackHandler));
```

#### 2.3 単体テスト新規作成 (TDD: Red → Green の順)

**新規ファイル**: `packages/core/src/http/error-handler.test.ts`

3 ケース:
1. **`development` 時に `err.message` を返す**: `MapEnvConfig` (Phase 4 で導入する test fake) で `NODE_ENV=development` → response body の `message` が err.message
2. **`production` (or 未設定) 時に `internal server error` 固定メッセージを返す**: 同上で `NODE_ENV` 未設定 → `internal server error`
3. **`HTTPException` は `getResponse()` を透過する**: hono の HTTPException を渡し、その `getResponse()` 結果がそのまま返る

`MapEnvConfig` は `Phase 4` の手段に詳述。real subclass + container override で integration テストする (mock / spy は使わない)。

#### 2.4 export 追加

`packages/core/src/index.ts` に `DefaultErrorHandler` を export。

### Phase 3 — adapter-node: NodeEnvConfig + onNode preset + dotenv 移管

#### 3.1 `NodeEnvConfig` 実装

```ts
// packages/adapter-node/src/env/node-env.config.ts
import { config as loadDotenv } from 'dotenv';
import { Config, EnvConfig } from '@zeltjs/core';

@Config
export class NodeEnvConfig extends EnvConfig {
  static readonly Token = EnvConfig;
  private loaded = false;

  override getRaw(key: string): string | undefined {
    this.ensureLoaded();
    return process.env[key];
  }

  private ensureLoaded(): void {
    if (this.loaded) return;
    for (const p of this.envFilePath) {
      loadDotenv({ path: p, override: true });
    }
    this.loaded = true;
  }
}
```

- dotenv load の cache scope は **NodeEnvConfig instance 単位** (instance field `loaded`)
- 同一 process で複数 container を作る場合 (テスト等) に独立した state を保つ
- `override: true` は既存挙動 (`env.lib.ts:13`) を維持

#### 3.2 `onNode` preset export

```ts
// packages/adapter-node/src/index.ts
import type { HttpApp, Runtime } from '@zeltjs/core';
import type { ServerType } from '@hono/node-server';

import { NodeEnvConfig } from './env/node-env.config';
import { serveApp, type ServeOptions } from './serve';

export const onNode: Runtime & {
  serve: (app: HttpApp, options?: ServeOptions) => ServerType;
} = {
  configs: [NodeEnvConfig],
  serve: serveApp,
};

export { NodeEnvConfig };

/**
 * @deprecated Use `onNode.serve(app, options)` instead. This standalone export
 * will be removed in the next major release.
 */
export { serveApp as serve } from './serve';
```

`Runtime & { serve: ... }` は intersection で型表現 (レビュー指摘反映 — `Runtime` の core 側責務は `configs` のみに純化)。

#### 3.3 `package.json` 移動

- `packages/adapter-node/package.json` — `dotenv` を exact version で追加 (現在 core が依存している version を確認して移管)
- `packages/core/package.json` — `dotenv` 依存を削除

#### 3.4 統合テスト追加

**新規ファイル**: `packages/adapter-node/src/env/node-env.config.test.ts`

3 ケース (tmpdir + real dotenv の filesystem integration):
1. **初回 `getRaw` で `.env` がロードされる**: tmpdir に `.env` を書き、`NodeEnvConfig` の `getRaw('FOO')` が値を返す
2. **二重ロード防止**: 同じ instance で 2 回 `getRaw` を呼んでも `dotenv.config` は 1 回だけ呼ばれる (`vi.spyOn` で確認 — モック化ではなく call 回数だけ assert)
3. **複数 .env path の override 順序**: `envFilePath: ['.env', '.env.local']` で `.env.local` の値が `.env` を上書きする

**既存ファイル更新**: `packages/adapter-node/src/index.test.ts`
- 5 ケースは不変
- 1 ケース追加: **`onNode` preset 経由で `EnvService` が動く smoke test** — `createHttpApp(onNode, { controllers: [TestCtrl] })` で `EnvService.getString('NODE_ENV', 'production')` が actual `process.env.NODE_ENV` を返すことを assert (preset 配線の end-to-end 検証)

### Phase 4 — 呼び出し箇所の更新 + 既存テスト書き換え

#### 4.1 `MapEnvConfig` test ヘルパ導入

`logger.integration.test.ts:38-50` の `CustomLoggerConfig extends LoggerConfig` パターンを踏襲。**core に共通化はしない**(YAGNI / scope 最小化)。各テストファイル内で local 宣言。

```ts
// 例: env.service.test.ts 内
@Config
class MapEnvConfig extends EnvConfig {
  static readonly Token = EnvConfig;
  constructor(private map: Record<string, string | undefined> = {}) { super(); }
  override getRaw(key: string): string | undefined {
    return this.map[key];
  }
}
```

ただし `injectConfig` は `Token` 経由で解決するため、コンストラクタ引数を持つ class は `useValue` で bind する必要がある。`createHttpApp` の `configs` 配列は class 受け取りなので、テストでは `resolveWith` (`packages/core/src/internal/container.ts:37-65`) の `overrides: [{ provide: EnvConfig, useValue: new MapEnvConfig({...}) }]` を使う、または引数なし subclass を使い分ける。

具体的書き換え方針:
- **`env.service.test.ts`**: `EnvService` を `resolveWith(EnvService, { overrides: [{ provide: EnvConfig, useValue: new MapEnvConfig({FOO: 'bar'}) }] })` で取り出して `getString` 等を assert。14 ケース全て此の形に
- **`error-handler.test.ts` (新規)**: 同様に `resolveWith(DefaultErrorHandler, { overrides: [{ provide: EnvConfig, useValue: new MapEnvConfig({NODE_ENV: 'development'}) }] })`
- **`app.test.ts` / `authorized.test.ts` / `logger.integration.test.ts`**: env を必要としないため、各ファイル冒頭に local `const testRuntime: Runtime = { configs: [] }` を宣言し `createHttpApp(testRuntime, { ... })` に書き換え
  - `error-handler.ts` の fallback path を踏むテスト (例: `app.test.ts` の error 系ケース) があれば、`testRuntime` に local `MapEnvConfig` を含める

#### 4.2 修正対象ファイル一覧 (createHttpApp 引数追加)

| ファイル | 箇所数 | 戦略 |
|---|---|---|
| `examples/hello/src/app.ts:5` | 1 | `import { onNode } from '@zeltjs/adapter-node'` 追加、`createHttpApp(onNode, ...)` |
| `examples/drizzle-todo/src/app.ts:5` | 1 | 同上 |
| `packages/core/src/decorators/authorized.test.ts` | 5 (L32, 55, 77, 102, 124) | local `testRuntime` |
| `packages/core/src/http/app.test.ts` | 12 (L65, 124, 196, 218, 253, 285, 327, 348, 371, 396, 436, 462, 498, 534) | local `testRuntime` (一部 error 系で `MapEnvConfig` 含む) |
| `packages/core/src/modules/logger/logger.integration.test.ts` | 2 (L30, 59) | local `testRuntime` |

合計 21 修正点 (調査時 19 件 + 新規 examples 1 + 既存 examples).

### Phase 5 — ESLint exception クリーンアップ + verification

#### 5.1 `eslint.config.mjs` 更新

- L149-152 の `error-handler.ts` 用 `no-process-access: off` block → **削除**
- L173-176 の `env.service.ts` 用 `no-process-access: off` block → **削除**
- 新規 1 block 追加: `packages/adapter-node/src/env/node-env.config.ts` 用

#### 5.2 dotenv 残存参照の自動検知

最後に以下を実行し、core パッケージから `dotenv` / `process.env` 残留参照がないことを確認:

```bash
ast-grep --pattern 'process.env' packages/core/src
ast-grep --pattern 'from "dotenv"' packages/core/src
ast-grep --pattern 'from "dotenv"' packages/core
```

(ast-grep skill 使用)

## Critical Files

- `packages/core/src/internal/container.ts:21-25` — `findConfigToken` ベースの override 機構 (この既存仕組みに乗る)
- `packages/core/src/internal/container.ts:37-65` — `resolveWith` (テストで `EnvConfig` を `useValue` 上書きするのに使う)
- `packages/core/src/config/token.ts` — `findConfigToken` (Token プロトタイプチェーン探索)
- `packages/core/src/config/decorator.ts` — `@Config` decorator (subclass で同 Token を持てる)
- `packages/core/src/config/types.ts` — `ConfigClass` 型定義
- `packages/core/src/modules/logger/logger.integration.test.ts:38-50` — subclass 経由 config override の動作実証パターン (env でも踏襲)
- `packages/core/src/middleware/types.ts:18-22` — `ErrorHandlerInstance` (DefaultErrorHandler は別 shape: `handle(err) => Response`)
- `packages/core/src/http/app.ts:29-36` — 既存 `createErrorHandler` closure (Phase 2 で改修)
- `packages/adapter-node/src/serve.ts` — `serveApp` (preset の serve から呼ぶ)

## Verification

### 型チェック
```bash
pnpm -r typecheck
```

### Lint (ESLint exception 削減を確認)
```bash
pnpm -r lint
```
- `eslint.config.mjs` から 2 ブロック消えていること、新規 1 ブロック追加されていること

### 残留参照の自動検知 (Phase 5.2 参照)
```bash
ast-grep --pattern 'process.env' packages/core/src   # → 0 件
```

### ユニットテスト
```bash
pnpm -r test
```

期待:
- `packages/core/src/modules/env/env.service.test.ts` — `MapEnvConfig` 経由に書き換わり、全 14 ケース pass
- `packages/core/src/http/error-handler.test.ts` (**新規**) — 3 ケース pass (development / production / HTTPException 透過)
- `packages/core/src/http/app.test.ts` — `createHttpApp(testRuntime, options)` で全 12 ケース pass
- `packages/core/src/decorators/authorized.test.ts` — 5 ケース pass
- `packages/core/src/modules/logger/logger.integration.test.ts` — 2 ケース pass
- `packages/adapter-node/src/index.test.ts` — 既存 5 ケース + 新規 1 ケース (onNode smoke) pass
- `packages/adapter-node/src/env/node-env.config.test.ts` (**新規**) — 3 ケース pass (tmpdir + real dotenv)

### Examples 起動確認 (手動)
- `examples/hello` — `pnpm build && node dist/entry/node.js` で起動し `curl localhost:3000/...` で正常応答
- `examples/drizzle-todo` — 同様

### error-handler の dev/prod 分岐確認 (手動)
- `NODE_ENV=development` で起動 → 例外時のレスポンスに `err.message` が含まれる
- `NODE_ENV=production` (or 未設定) → `internal server error` 固定メッセージ

## Rollout Notes

### 破壊的変更
- `createHttpApp(options)` → `createHttpApp(runtime, options)` のため利用側は必ず修正必要
- 本リポジトリは pre-1.0 OSS のため、overload で legacy signature を残す方針は採らない (sweep + migration guide で対応)

### Migration ガイド (PR-1 PR description に記載)

```diff
+ import { onNode } from '@zeltjs/adapter-node';

- const app = createHttpApp({ controllers: [...] });
+ const app = createHttpApp(onNode, { controllers: [...] });
```

```diff
- import { serve } from '@zeltjs/adapter-node';
- serve(app, { port: 3000 });

+ import { onNode } from '@zeltjs/adapter-node';
+ onNode.serve(app, { port: 3000 });
```

`serve` 単体 export は `@deprecated` JSDoc 付きで当面残す。次 major リリースで削除予定 (CHANGELOG / PR description に明記)。

### `EnvConfig.getRaw` の fail-fast 挙動
- runtime preset を渡し忘れた `createHttpApp(undefined as any, ...)` 等の誤用時、初回 `EnvService.getString` 等の呼び出しで明示的 `Error` を投げる
- silent undefined 化しない (production NODE_ENV 判定の sub-bug を防ぐ)

### dotenv 挙動の継承
- `override: true` で `.env` が既存 `process.env` を上書きする挙動は変更しない (`env.lib.ts:13` の旧挙動を `NodeEnvConfig.ensureLoaded` でそのまま維持)
- 複数 path 指定時は配列順で順次ロード (後 path が先 path を override)
