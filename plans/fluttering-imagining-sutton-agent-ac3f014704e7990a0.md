# Plan Review: Runtime Preset 抽象化と Env Module の DI 化

Reviewed plan file: `/workspaces/github.com/zeltjs/zelt/plans/fluttering-imagining-sutton.md`

## Summary

全体方針 (Runtime preset を一級概念にして process.env / cloudflare:workers env を adapter 層に閉じ込める) は健全で、既存の `findConfigToken` ベースの override 機構と整合する。一方で **(1) `Runtime` 型の expressivity が PR-2 を見据えると不足**、**(2) `EnvConfig.getRaw` を抽象メソッドとして default `return undefined` にする設計の意図が不明瞭**、**(3) `DefaultErrorHandler` を class 化する判断は CLAUDE.md の "class は DI container 用途に限る" 指針と摩擦がある**、**(4) test-runtime を core に置く方針は YAGNI / 適切なレイヤ違反**、の 4 点で再検討の余地がある。

## Strengths

- **SSoT の問題定義が明確**: `process.env` 直アクセス箇所 (3 箇所) と ESLint exception (2 箇所) を漏れなく洗い出している。
- **既存仕組みへの便乗**: `findConfigToken` (token.ts:1-12) と `static readonly Token = EnvConfig` の override パターンに乗る形になっており、新たな DI 機構を導入していない。Phase 1 の `EnvConfig` 抽象化は最小侵襲。
- **PR 分割が妥当**: PR-1 で core の抽象化と Node 実装、PR-2 で Workers 追加。Workers を後回しにすることで各 PR のレビュー負荷が下がる。
- **public API 不変の宣言**: `EnvService.getString/getInteger/getBoolean` のシグネチャ・挙動を維持する旨を明示しており、利用側コードへの影響範囲を限定。
- **ESLint exception 削減を verification に含めている**: 抽象化の効果を客観的に確認できる。

## Issues

### 1. Type System Utilization: `Runtime` 型が preset を表現するには弱い
**Severity**: High
**Location**: plan L39-44 (`packages/core/src/runtime/types.ts`)
**Problem**:
プラン上の `Runtime` 型は `{ readonly configs: readonly ConfigClass[] }` のみだが、L100-105 の `onNode` は `serve` も持つ object として定義されている。型と実体に乖離があり、`as const satisfies Runtime & { ... }` という曖昧な記述になっている。これは、

- `createHttpApp(runtime, options)` が必要とするのは `runtime.configs` のみ
- `serve` は Node 固有の entry helper で、Workers preset には存在しない (Workers は `export default app`)
- 将来 `createScheduler(runtime, options)` が来ると、Scheduler は `serve` ではなく `cron` 設定を runtime から拾う可能性がある

という三層が混ざっているため。`Runtime` を「DI 構成のみ」と「entry helper を含む preset」に分離すべき。

**Suggestion**:

```ts
// packages/core/src/runtime/types.ts
import type { ConfigClass } from '../config';

// core が要求する最小契約 (createHttpApp / createScheduler が依存する shape)
export type Runtime = {
  readonly configs: readonly ConfigClass[];
};
```

```ts
// packages/adapter-node/src/index.ts
// preset = Runtime + Node 固有 entry helper。Runtime contract と entry helper は分離。
import type { Runtime } from '@zeltjs/core';

export const onNode = {
  configs: [NodeEnvConfig],
  serve: (app: HttpApp, options?: ServeOptions) => serveApp(app, options),
} as const satisfies Runtime;
// ↑ `satisfies Runtime` は configs の存在のみ保証。serve は extra property として
// const 推論で型保持される。`Runtime & { ... }` は不要。
```

これで `createHttpApp(onNode, options)` は `Runtime` として受け取り、`onNode.serve(app)` はユーザコード側で preset の static field として直接呼ばれる。

**Example (Before/After)**:
```ts
// Before (plan L100-105)
export const onNode = {
  configs: [NodeEnvConfig],
  serve: (app, options) => serveImpl(app, options),
} as const satisfies Runtime & { ... };  // ← {...} が未定義

// After
export const onNode = {
  configs: [NodeEnvConfig],
  serve: (app: HttpApp, options?: ServeOptions) => serveApp(app, options),
} as const satisfies Runtime;
```

---

### 2. API Design: `EnvConfig.getRaw` を default `return undefined` にする設計が不安全
**Severity**: High
**Location**: plan L52 (`packages/core/src/modules/env/env.config.ts`)
**Problem**:
現状の `EnvConfig` は `@Config` で `static readonly Token = EnvConfig`、つまり **抽象 base ではなく具象クラス** として直接 instantiate 可能。プランどおり `getRaw(key) { return undefined }` を default 実装にすると、

- `onNode` を渡し忘れた場合 (`createHttpApp(testRuntime, options)` で `testRuntime.configs = []`) → DI コンテナは `EnvConfig` 自身を解決し、すべての env が `undefined` で返る
- runtime エラーにならず、production で env が空 → サイレント障害

これは "**NEVER Suppress errors without handling**" (CLAUDE.md L24) に抵触。`EnvConfig` を core で直接使わせる前提なら getRaw の base 実装が `undefined` 固定なのは契約として弱い。

**Suggestion**:
**選択肢A (推奨)**: `EnvConfig` を「抽象基底契約」として明示する。
- base `EnvConfig` から具象実装 (`process.env` 等) を切り出し、core 内で base はインスタンス化されない不変条件を作る
- `getRaw` を **abstract** にして、subclass 必須にする (TS `abstract` キーワード)
- ただし `@Config` decorator は具象 class 前提の可能性があるので、抽象方針を取るなら `@Config` の対応も合わせて検討

```ts
// packages/core/src/modules/env/env.config.ts
@Config
export abstract class EnvConfig {
  static readonly Token = EnvConfig;
  abstract getRaw(key: string): string | undefined;
  get envFilePath(): string[] { return ['.env']; }
}
```

**選択肢B**: default 実装を残すが warning を出す。
- base `getRaw` で `console.warn('[zelt] EnvConfig not configured for this runtime; env values are unavailable')` を一度だけ出す
- ただし console.warn は副作用なのでやや筋が悪い

**選択肢C**: runtime の `configs` が空でも `EnvConfig` は **必ず** core 側で default として bind しておき、明示的に NodeEnvConfig が override する形にする (現行 `findConfigToken` 機構そのまま)。default getRaw は `undefined` 固定でよいが、テスト以外では runtime preset を必須とする旨を型で保証 (e.g. `createHttpApp` の signature で `runtime: Runtime` を非 optional にする → これは既に plan に含まれている)。

→ どちらにせよ「default `return undefined` のままで具象クラスとして public 露出」という現状維持は危険。**選択肢A の abstract 化**が、契約違反を compile-time に押し戻せるため最も望ましい。

---

### 3. API Design: `createHttpApp(runtime, options)` の破壊性に対する mitigation が無い
**Severity**: Medium
**Location**: plan L65, L177-178
**Problem**:
プランは「pre-1.0 OSS なので破壊的変更は許容」としているが、

- `examples/hello/src/app.ts:6` と `examples/drizzle-todo/src/app.ts:5` は **既に publish された API のテンプレート** として機能している
- `app.test.ts` の 12 箇所、`authorized.test.ts` の 5 箇所、`logger.integration.test.ts` の 2 箇所が一斉に書き換え対象
- npm publish 後は major bump が必要 (現在 0.1.1 → 0.2.0 でも semver pre-1.0 なら可だが、release notes だけでは利用者の build 失敗を防げない)

破壊性を許容するとしても、**signature を 1 段拡張する soft migration path** を挟むほうがリスクが低い。

**Suggestion**:
overload で旧 signature を deprecated として一時残す:

```ts
export function createHttpApp(options: CreateHttpAppOptions): HttpApp;  // deprecated
export function createHttpApp(runtime: Runtime, options: CreateHttpAppOptions): HttpApp;
export function createHttpApp(
  runtimeOrOptions: Runtime | CreateHttpAppOptions,
  maybeOptions?: CreateHttpAppOptions,
): HttpApp {
  const [runtime, options] = 'controllers' in runtimeOrOptions
    ? [{ configs: [] } as const, runtimeOrOptions]  // legacy path
    : [runtimeOrOptions, maybeOptions!];  // ← non-null assertion は eslint で禁止されているので別手段で
  // ...
}
```

ただし overload は `@typescript-eslint/no-non-null-assertion` (eslint.config.mjs:71) と相反する。**現実的な代替** として:

- 破壊的変更を認める方針なら、CHANGELOG.md と `migration-v0.2.md` ガイドを `verification` に追加
- 旧 signature は `createHttpAppLegacy` 等として 1 リリース残し、次の minor で削除

少なくとも **plan の `Verification` に「examples の README / docs の更新」を追加すべき**。現状 verification は test pass のみで、ドキュメント整合性が抜けている。

---

### 4. Function Design: `DefaultErrorHandler` を class にする方針は CLAUDE.md 指針と摩擦
**Severity**: Medium
**Location**: plan L72-77
**Problem**:
CLAUDE.md (L25-26):
> SOLID 原則を意識しつつ OOP は避ける。DI のために class を使うのは "container 用途に限る"

`DefaultErrorHandler` は **handle メソッド 1 つだけのオブジェクト** であり、状態を持たない。`@Injectable()` を付けて class 化する以外に、

- `EnvService` を引数に取る関数として `createDefaultErrorHandler(env: EnvService)` を返す
- needle-di の `provide` で factory として登録 ( `{ provide: DefaultErrorHandlerToken, useFactory: (env) => (err) => ... }` )

という選択肢がある。プランが class 化を選んだ理由 (例: 他の `ErrorHandlerInstance` (`onError(err, c)`) と shape が違う終端 fallback、resolver.get で取りたい) は妥当だが、**review-prompt 自身が指摘するように "config/decorator 文脈" には収まらない**。

`ErrorHandlerInstance` (middleware/types.ts:20-22) は既に既存ユーザ拡張点として class shape (`onError`) を受け入れているので、`DefaultErrorHandler` も class にすること自体は一貫性がある。一方で **「終端 fallback だけは関数」** という選択肢を捨てるべきではない。

**Suggestion**:
2 案併記:

**案A (plan 通り、class 化)**:
- 既存 `ErrorHandlerInstance` と shape が違う (`handle` vs `onError`) のは plan L140 で認識済み
- 一貫性 (DI で resolver.get できる) と test の容易さ (`resolveWith({ overrides: [{ provide: EnvService, useValue: mockEnv }] })`) で利点あり
- ただし class 1 個増やすコストと、この class が container 用途以外 (handle ロジックを持つ) の class になる懸念

**案B (関数 + factory 化、推奨)**:
```ts
// packages/core/src/http/error-handler.ts
import { injectable, inject } from '@needle-di/core';
import { EnvService } from '../modules/env';

// factory class only — メソッドは 1 つ、state なし、純粋に env を依存に持つ closure を返す
@injectable()
export class DefaultErrorHandlerFactory {
  constructor(private env = inject(EnvService)) {}

  create() {
    const isDev = this.env.getString('NODE_ENV', '') === 'development';
    return (err: Error): Response => {
      if (err instanceof HTTPException) return err.getResponse();
      const message = isDev && err instanceof Error ? err.message : 'internal server error';
      return Response.json({ code: 'INTERNAL_ERROR', message }, { status: 500 });
    };
  }
}
```

→ class は **DI 入口** に閉じ、終端 fallback は関数値として扱う。CLAUDE.md の指針と整合。

→ どちらを取るかは tradeoff だが、**plan には選択理由 (なぜ案A か) を明文化すべき**。現状プランは「class 化する」と断定しているのみで、関数 factory との比較が無い。

---

### 5. Module Design: test-runtime を core 内に置くのは scope 過大
**Severity**: Medium
**Location**: plan L122-123
**Problem**:
プラン:
> tests → core 内に **テスト専用の最小 Runtime** (`testRuntime: Runtime = { configs: [] }`) を `packages/core/src/test/test-runtime.ts` として置き、各テストから import して使う

これは:

1. **YAGNI 違反**: `{ configs: [] }` は 1 行のリテラル。共通化する価値が低い
2. **scope 違反**: `packages/testing` パッケージが既に存在する (`packages/testing/src/test-container.ts`)。テスト helper は `packages/testing` に置くのが適切なレイヤ
3. **publishing 上の懸念**: `packages/core/src/test/` を tsdown が dist に含めると、利用者の bundle に test 用 export が漏れる

**Suggestion**:

**案A**: 各テストファイル先頭にローカル定数として定義 (推奨、YAGNI)
```ts
// app.test.ts 先頭
const testRuntime = { configs: [] } as const;
```
12 箇所 × 1 行コピペ。重複は 12 行のみで、抽象化のコストより低い。

**案B**: `packages/testing` に追加
```ts
// packages/testing/src/test-runtime.ts
import type { Runtime } from '@zeltjs/core';
export const testRuntime = { configs: [] } as const satisfies Runtime;
```
ただし core の test が testing に依存することになり、**circular workspace dep のリスク** (`@zeltjs/core` ← `@zeltjs/testing` ← `@zeltjs/core`)。`packages/testing/package.json` を見て依存方向を確認する必要あり。devDependencies なら循環は許容されるが build order が崩れる可能性。

**案C** (もし共通化するなら): `packages/core/src/runtime/test-runtime.ts` ではなく、`packages/core/src/__test__/runtime.ts` 等の **明確に test スコープと分かる場所** に置き、`tsdown.config.ts` の `entry` から除外。

→ 推奨は **案A**。1 行 const をファイル冒頭に置くだけで、抽象化レイヤが無くなる。

---

### 6. Module Design: 循環依存リスク (core ↔ adapter-node) の検証が不足
**Severity**: Low
**Location**: plan 全般 (Phase 1-3)
**Problem**:
プランは:
- core から `Runtime` 型を export
- adapter-node が core の `Runtime`, `EnvConfig`, `HttpApp` を import
- adapter-node が `NodeEnvConfig` (extends EnvConfig) を export

依存方向は **adapter-node → core** の単方向で、循環は無いはず。ただし:

- `dotenv` 依存を core から adapter-node に移管 (plan L108-109) する際、core 内に `dotenv` 残存参照が無いか **要確認**
- `env.lib.ts` 削除に伴い、`packages/core/src/modules/env/index.ts` の re-export と他ファイルの import を全て洗うべき
- core の `tsdown.config.ts` の entry に `env.lib` が含まれていないか確認
- `eslint.config.mjs:73` の `import-x/no-cycle: error` が pass することを verification に明記

**Suggestion**:
Verification に以下を追加:
```bash
# 循環依存と未使用 import の検出
pnpm -r lint -- --rule 'import-x/no-cycle:error'
# dotenv 依存が core から完全に消えていることの確認
grep -rn "from 'dotenv'" packages/core/src/ && echo "ERROR: dotenv still referenced in core" || echo "OK"
grep -rn "dotenv" packages/core/package.json && echo "ERROR: dotenv still in core deps" || echo "OK"
```

また `packages/core/src/modules/env/index.ts` (現状 2 行) で `env.lib` の re-export は **無い** ので plan L62 の "もし露出していれば" は不要 (確認済み)。Plan を簡潔化できる。

---

### 7. Error Design: `getInteger` の parse 失敗時に default を返す挙動が SSoT 化で危険になる
**Severity**: Low
**Location**: 既存 `env.service.ts:25-29` (改修対象)
**Problem**:
現状の `getInteger` は parse 失敗時に default を返す (silent fallback)。これは "**NEVER Suppress errors without handling**" にすでに抵触気味。本 plan の改修では挙動不変としているが、**改修ついでに修正する選択肢**もある:

- `Result<number, ParseError>` を返す (neverthrow)
- もしくは parse 失敗時に throw

ただし「public API 不変」という plan の方針と矛盾するため、本 plan の scope 外として **別 issue 化** が妥当。

**Suggestion**:
plan の `Rollout Notes` に以下を追記:
> `EnvService.getInteger` の parse 失敗時 silent fallback 挙動は本 PR では維持するが、別途 issue 化して将来的に Result 型 / throw への移行を検討する。

---

### 8. Verification: 手動確認項目が CI で fail を検出できない
**Severity**: Low
**Location**: plan L168-174 (Examples 起動確認、error-handler の dev/prod 分岐確認)
**Problem**:
```
- examples/hello — pnpm build && node dist/entry/node.js で起動し curl localhost:3000/...
- NODE_ENV=development で起動 → 例外時のレスポンスに err.message が含まれる
- NODE_ENV=production (or 未設定) → internal server error 固定メッセージ
```
これらは手動確認のみで CI 化されておらず、リグレッション時に気づけない。

**Suggestion**:
- error-handler の dev/prod 分岐は **ユニットテスト化** すべき (`error-handler.test.ts`)
  - `resolveWith(DefaultErrorHandler, { overrides: [{ provide: EnvService, useValue: mockEnv('development') }] })` で容易に検証可能
- examples 起動確認は scope 外でよいが、最低限 `examples/hello` の build success を CI で担保する設定があるか確認

---

## Recommendations (優先度順)

1. **(High)** `EnvConfig.getRaw` を `abstract` にし、具象 NodeEnvConfig 実装を必須にする。default `undefined` のサイレント障害リスクを排除。
2. **(High)** `Runtime` 型を「core が要求する最小契約 (`{ configs }`)」に純化し、`onNode` の `serve` は preset 固有の extra property として `as const satisfies Runtime` で扱う。`Runtime & { ... }` を消す。
3. **(Medium)** `DefaultErrorHandler` を class にする選択について plan に **判断理由** を明記。FP 寄り原則との整合を取るなら `DefaultErrorHandlerFactory.create(): (err) => Response` の関数 factory 案を検討。
4. **(Medium)** `testRuntime` を core 内に独立ファイルで置くのをやめ、各 test ファイル先頭の `const testRuntime = { configs: [] } as const` で済ます (YAGNI)。
5. **(Medium)** `createHttpApp` 破壊的変更の rollout に `migration guide` ドキュメント更新を verification に追加。
6. **(Low)** Verification に循環依存と dotenv 残存参照の自動検出コマンドを追加。
7. **(Low)** error-handler の dev/prod 分岐を unit test 化 (`error-handler.test.ts` を新設)。
8. **(Low)** `getInteger` silent fallback の長期対応を Rollout Notes に追記 (別 issue 化)。

## 個別質問への回答

### Q1: Runtime preset 設計 (`Runtime` 型 + `onNode` / `onCfWorker` object)
**評価**: 方向性は◎。ただし `Runtime` 型と preset object の責務が混ざっている (Issue #1)。`Runtime` は core 契約、preset は adapter で extra property を持つ const object に分離すべき。

### Q2: `EnvConfig` の `getRaw` を抽象メソッドにする設計の妥当性 (default が `return undefined` で adapter が override)
**評価**: △。`return undefined` だと runtime preset 渡し忘れがサイレント障害になる (Issue #2)。`abstract` 化が望ましい。

### Q3: `createHttpApp(runtime, options)` の signature 変更による破壊性と回避策の有無
**評価**: △。破壊的変更を許容するなら overload か `createHttpAppLegacy` 残しを検討。最低限 docs / migration guide を verification に含めるべき (Issue #3)。

### Q4: `DefaultErrorHandler` クラスの DI 化
**評価**: △。CLAUDE.md の "class は DI container 用途に限る" 指針と摩擦あり。class にする判断理由 (resolver.get で取りたい等) を plan に明記し、関数 factory 案との比較を残すこと (Issue #4)。

### Q5: ESM import 整合性、循環依存リスク (core ↔ adapter-node 間)
**評価**: ○。依存方向は adapter-node → core で循環なし。ただし `env.lib` 削除と `dotenv` 移管に伴う残存参照の自動検出を verification に追加すべき (Issue #6)。

### Q6: テスト書き換え方針 (`testRuntime: Runtime = { configs: [] }` を core 内に置く)
**評価**: △。YAGNI 違反 + scope 過大 (Issue #5)。各テストファイル冒頭にローカル定数で十分。
