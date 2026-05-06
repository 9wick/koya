# Plan Review: Runtime Preset 抽象化と Env Module の DI 化

Reviewer: TDD / Testing Trophy 観点
Plan: `/workspaces/github.com/zeltjs/zelt/plans/fluttering-imagining-sutton.md`

## Summary

設計方針 (Runtime preset / EnvConfig.getRaw / DefaultErrorHandler の DI 化) は Testing Trophy の観点でも妥当な方向で、特に `error-handler.ts` を DI 化することで `typeof process` ガードと `process.env` 直アクセスが消え、テスト時の boundary が明確になる点は評価できる。一方で本 plan は **「19 + 14 + 5 + 2 = 40 件のテスト書き換えを伴うのに TDD の Red-Green-Refactor cycle が一切記述されていない」**「`DefaultErrorHandler` という新規ユニットの test plan が欠落している」「`env.service.test.ts` の書き換え方針が `vi.stubEnv` (実環境テスト = integration 寄り) から「mock または resolveWith overrides」(unit 寄り) への退化になっている」「`adapter-node` 側に移譲される dotenv ロード副作用の test 戦略が完全に未記述」など、Testing Trophy の比重を**現状より悪化させかねないリスク**が複数ある。

## TDD Compliance

- TDD Cycle: **Missing** — Phase 1〜5 すべてが「実装ファイルを修正」「テストを書き換え」の順で記述されており、Red-Green-Refactor の段階分割が無い。特に `DefaultErrorHandler` (Phase 2) は新規クラスにもかかわらず「先に failing test を書く」ステップが一切無い
- Test-First: **No** — Phase 4 の test 修正は「既存実装を変えた結果として行う追従修正」として記述されており、test を先に書く motion になっていない。EnvConfig.getRaw という新 API も「default 実装は `return undefined`」とだけあり、その契約をテストで定義する手順が無い

## Testing Trophy Analysis

現状 (plan 適用前) の比重:

- Integration: `app.test.ts` (12), `authorized.test.ts` (5), `logger.integration.test.ts` (2) = **19** ← 主力
- Unit: `env.service.test.ts` (14, ただし `vi.stubEnv` 経由で実 `process.env` を触っており semi-integration)、その他 decorator / primitives / internal の unit
- E2E: 無し (examples の手動起動確認のみ)

plan 適用後に予想される比重:

- Integration: 19 件は維持されるが、**全件で `testRuntime: Runtime = { configs: [] }` という空 runtime を使う**ことで、production と同じ `EnvConfig` プロトタイプチェーン (= `getRaw` が `undefined`) で走る。`NodeEnvConfig` 配下での実挙動を検証するテストはゼロになる
- Unit: `env.service.test.ts` 14 件が `vi.stubEnv` から **mock based unit test に退化** (後述、最大の懸念)
- 新規 unit: `DefaultErrorHandler` の test が plan 内に**未記述**
- adapter-node: dotenv ロードの integration test が**未記述**

→ 結果として **Trophy の頭が縮んで unit/mock 寄りに重心が移る**懸念がある。plan が明示しないと、実装者が一番手早い「mock を当てる」選択に流れる。

## Mock Assessment

- 外部境界 mock: `vi.stubEnv` (Node global) は OS/runtime 境界の stub なので Trophy 的に許容範囲
- 内部 module mock の懸念: plan L124「`EnvConfig` を直接 instantiate してモック、または `resolveWith` overrides で `EnvConfig` の `getRaw` を差し替える」は **internal module の mock = anti-pattern** に該当しうる
- 推奨: `EnvConfig` は abstract base 扱い。テストでは `class TestEnvConfig extends EnvConfig { override getRaw(key) { return this.map.get(key); } }` のような **real subclass = test fake** を渡す integration スタイルにすべき。これは既に `logger.integration.test.ts:39-45` で `CustomLoggerConfig extends LoggerConfig` という real subclass パターンが確立されており、conformance も取れる

## Existing Test Patterns

- 確立されたパターン (plan が踏襲すべきもの)
  - `logger.integration.test.ts:40-45` — `@Config class CustomLoggerConfig extends LoggerConfig { override get level() {...} }` を `configs: [CustomLoggerConfig]` 経由で注入する **real subclass pattern**
  - `app.test.ts:64-65` — `buildApp = () => createHttpApp({ controllers: [...] })` のテストヘルパ集約
  - `internal/container.ts:47-65` — `resolveWith({ overrides: [{ provide, useValue }] })` という DI override API は既に存在
- Plan で参照されていない既存資産
  - `resolveWith` は plan L124 で「あるいは」と並列に挙げられているが、これは既に `container.test.ts` 等で使われている。test runtime を新設する前にまず `resolveWith` で済むか検討すべき
  - `logger.integration.test.ts` の subclass pattern は env でも全く同じ形で使えるのに、plan は触れていない

## Issues

### Issue 1: TDD Cycle が plan に存在しない (Phase 2 の DefaultErrorHandler が特に深刻)

**Severity**: High
**Location**: Phase 2 (plan L68-84)
**Problem**: `DefaultErrorHandler` は plan で「新規 `@Injectable()` クラス」として導入されるが、test を先に書くステップが無い。現状 `error-handler.ts` には test ファイルが**存在しない** (`error-handler.test.ts` は `decorators/error-handler.test.ts` であり middleware decorator の test、別物)。つまり「mod レベル fallback の dev/prod 分岐」は現状ロジックとしてはあるがテストされておらず、本 plan で DI 化した後もテストされない設計になっている。
**Suggestion**:
1. `packages/core/src/http/error-handler.test.ts` を新規作成し、`DefaultErrorHandler` の振る舞いを記述
2. Red: 「`NODE_ENV=development` のとき `err.message` がレスポンスに入る」「production のとき `internal server error` 固定」「`HTTPException` はそのまま `getResponse()` を返す」の 3 ケースを `EnvService` の real fake (override) 経由で先に書く
3. Green: `DefaultErrorHandler` を最小実装
4. Refactor: `app.ts` 側の `createErrorHandler` closure と統合

**Example (Before/After)**:
```ts
// 推奨: real subclass pattern (logger.integration.test.ts に倣う)
@Config
class FakeEnvConfig extends EnvConfig {
  override getRaw(key: string): string | undefined {
    return key === 'NODE_ENV' ? 'development' : undefined;
  }
}

it('includes err.message in response when NODE_ENV=development', async () => {
  const { target } = resolveWith(DefaultErrorHandler, {
    overrides: [], // FakeEnvConfig は @Config + extends で auto-bind
  });
  const res = target.handle(new Error('boom'));
  expect(await res.json()).toMatchObject({ message: 'boom' });
});
```

### Issue 2: env.service.test.ts の書き換え方針が unit 退化リスク

**Severity**: High
**Location**: Phase 4 (plan L124)
**Problem**: 現状の `env.service.test.ts` は `vi.stubEnv('TEST_KEY', 'test_value')` で **実 `process.env` を経由** しており、現実の Node 挙動に対する integration test として機能している (L9-17)。plan L124 の「`EnvConfig` を直接 instantiate してモック」「`resolveWith` overrides で `EnvConfig` の `getRaw` を差し替え」はいずれも **EnvService の collaborator (= EnvConfig) を mock する unit test 化** であり、Testing Trophy 的には退化方向。
**Suggestion**:
1. `vi.stubEnv` を捨てる必要は本来無い。`process.env` 直アクセスが `EnvService` から消えても、`NodeEnvConfig.getRaw` 経由で `process.env` を読むので、`vi.stubEnv` は依然 effective
2. ただし `EnvService` の test を core パッケージに残すなら `NodeEnvConfig` に依存できない (循環)。よってここでは **core 内に最小の test fake を置く** のが適切:
   ```ts
   // packages/core/src/modules/env/env.config.test-fake.ts (test only)
   import { Config } from '../../config';
   import { EnvConfig } from './env.config';

   @Config
   export class MapEnvConfig extends EnvConfig {
     constructor(private map: Record<string, string | undefined> = {}) { super(); }
     override getRaw(key: string): string | undefined { return this.map[key]; }
   }
   ```
3. これは「mock」ではなく **real implementation as test double** なので Trophy 的に integration 寄りを維持できる
4. 14 ケースを書き換える際、parameterized test (`it.each`) で重複削減も同時に検討 (現状 `getString` 4 + `getInteger` 4 + `getBoolean` 5 はかなり機械的に重複している)

**Example**:
```ts
// Before (plan の含意)
const service = new EnvService({ getRaw: vi.fn().mockReturnValue('test_value') } as any);

// After (real fake)
const { target } = resolveWith(EnvService, {
  overrides: [{ provide: EnvConfig, useValue: new MapEnvConfig({ TEST_KEY: 'test_value' }) }],
});
expect(target.getString('TEST_KEY', 'default')).toBe('test_value');
```

### Issue 3: testRuntime の妥当性 — 真の Node 挙動が検証されなくなる

**Severity**: Medium
**Location**: Phase 4 (plan L123)
**Problem**: `testRuntime: Runtime = { configs: [] }` は pragmatic だが、**「production では `onNode` が必ず使われる」という前提を test では一切踏まないことになる**。`createHttpApp` の routing/DI/error-handling の振る舞いは Runtime に依存しないので 19 件中ほとんどはこれで構わないが、以下のケースは漏れる:
- `DefaultErrorHandler` の `NODE_ENV` 分岐 (production 環境で発火する fallback)
- `NodeEnvConfig` が configs に積まれた状態で controller が `EnvService` を使う典型 flow
**Suggestion**:
1. `testRuntime` は `app.test.ts` / `authorized.test.ts` のような **runtime 非依存テスト** で使う
2. 一方、`error-handler.test.ts` (新規) と `env.service.test.ts` は **`MapEnvConfig` を configs に明示的に渡す integration** として書く
3. `adapter-node/src/index.test.ts` には **`onNode` preset 経由で `createHttpApp` を組み立てて 1 リクエスト通す smoke test** を 1 ケース追加 (現状は `serve` 単体しかテストされていない)

```ts
// adapter-node/src/index.test.ts に追加すべき smoke test
it('onNode preset wires NodeEnvConfig into EnvService', async () => {
  process.env.SMOKE_KEY = 'smoke';
  @Controller('/env')
  class C {
    constructor(private env = inject(EnvService)) {}
    @Get('/') get() { return { v: this.env.getString('SMOKE_KEY', 'fallback') }; }
  }
  const app = createHttpApp(onNode, { controllers: [C] });
  const res = await app.request('/env/');
  expect(await res.json()).toEqual({ v: 'smoke' });
});
```

### Issue 4: dotenv ロード副作用の test 戦略が未記述

**Severity**: Medium
**Location**: Phase 3 (plan L90-95)
**Problem**: `NodeEnvConfig.getRaw` が初回呼び出し時に `config({ path, override: true })` を lazy 実行するロジックは副作用 + 状態 (loaded flag) を伴う。現状 `env.lib.ts` には test が無く、本 plan でも test 追加が記述されていない。だが副作用 + module-level state は最も bug が出やすい箇所:
- `.env` が無いときに silent fail するか
- 複数パスのうち最初だけ loaded フラグが立つ orderring bug
- test 並列実行時の global state 汚染
**Suggestion**:
1. `packages/adapter-node/src/env/node-env.config.test.ts` を Phase 3 と同 PR で新規作成
2. tmpdir に `.env` を書いて real dotenv で読み、`getRaw` が値を返すこと、第二パスが override すること、loaded flag が二重ロードを防ぐことを assert する **filesystem integration test**
3. これは acceptable mock の boundary (filesystem) を超えない real integration なので Trophy 的に主力レイヤ

```ts
// 推奨パターン
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

it('loads .env on first getRaw call', () => {
  const dir = mkdtempSync(join(tmpdir(), 'zelt-env-'));
  writeFileSync(join(dir, '.env'), 'FOO=bar\n');
  const config = new NodeEnvConfig([join(dir, '.env')]);
  expect(config.getRaw('FOO')).toBe('bar');
});
```

### Issue 5: テスト重複の機会損失 — env.service.test.ts の 14 ケース

**Severity**: Low
**Location**: `env.service.test.ts` 全体
**Problem**: 現状 `getString` 4 / `getInteger` 4 / `getBoolean` 5 ケースは「env exists / not exists / null default / undefined default / parse error」の組み合わせを各メソッドで個別に書いており、書き換えのタイミングで `it.each` 化すると重複削減できる。
**Suggestion**: plan に「14 → 6 程度に集約 (parameterized)」を追記。書き換え工数ではなく、保守工数の削減として正当化できる
```ts
it.each([
  ['getString', 'TEST', 'value', 'default', 'value'],
  ['getString', 'NOPE', undefined, 'default', 'default'],
  ['getInteger', 'PORT', '3000', 8080, 3000],
  ['getInteger', 'BAD', 'abc', 8080, 8080],
  ...
])('%s(%s) returns %s', (method, key, raw, def, expected) => { ... });
```

### Issue 6: createHttpApp signature 変更で 19 箇所書き換えるが、API ergonomics の test は無い

**Severity**: Low
**Location**: Phase 1 (plan L65), Phase 4
**Problem**: `createHttpApp(runtime, options)` は破壊的変更 (plan L177 で認識済) だが、「**`runtime` を渡し忘れたら型エラーになる**」「**`runtime.configs` と `options.configs` が両方ある時の merge 順序**」といった contract を保証する test が無い。後者 (plan L66 の `[...runtime.configs, ...(options.configs ?? [])]`) は subtle: もし両方に `EnvConfig` 系がある場合、後勝ちで上書きできる仕様か、前勝ちか
**Suggestion**: `app.test.ts` に
```ts
it('options.configs override runtime.configs for same Token', async () => { ... });
```
を 1 ケース追加。これは将来 `onNode` + ユーザカスタム `MyEnvConfig` という典型 use case を保証する

## Recommendations (優先順)

1. **[High] Phase 2 を TDD 化**: `error-handler.test.ts` を新規作成して dev/prod/HTTPException の 3 ケースを Red → Green の順で。これがあれば手動 verification (plan L171-173) も自動化できる
2. **[High] env.service.test.ts の書き換え方針を `MapEnvConfig` (real fake) に**: 「mock または resolveWith」を「`MapEnvConfig extends EnvConfig` を `configs:` 経由で注入」に変更。`logger.integration.test.ts` の subclass pattern と整合
3. **[Medium] Phase 3 で `node-env.config.test.ts` 追加**: dotenv 副作用 + loaded flag の filesystem integration test。adapter-node 移管時の regression を防ぐ
4. **[Medium] adapter-node に `onNode` preset の smoke test 1 ケース追加**: 「preset 経由で `EnvService` が `process.env` を読める」end-to-end (整合性確認)
5. **[Low] testRuntime の使用範囲を plan 内で明示**: 「runtime 非依存テスト用。env / error-handler 系では使わない」と明記。実装者が思考停止で全箇所に当てるのを防ぐ
6. **[Low] env.service.test.ts を parameterized 化**: 14 → 6 程度に集約。書き換えのタイミングで一度に
7. **[Low] configs merge 順序の test を 1 ケース追加**: `app.test.ts` に runtime.configs vs options.configs の override 仕様を固定化

## TDD-Style に書き直した Phase 2 の例 (参考)

```
### Phase 2 — core: DefaultErrorHandler の DI 化 (TDD)

2.1 [Red] packages/core/src/http/error-handler.test.ts を新規作成
    - Test 1: HTTPException 透過
    - Test 2: NODE_ENV=development で err.message 露出
    - Test 3: NODE_ENV 未設定で 'internal server error' 固定
    - 各 test は EnvConfig の real subclass (MapEnvConfig) を configs: で注入
    - 3 ケースとも fail (DefaultErrorHandler 未実装) を確認

2.2 [Green] DefaultErrorHandler を packages/core/src/http/error-handler.ts に追加
    - @Injectable, constructor(private env = inject(EnvService))
    - handle(err: Error): Response
    - 既存 handleError 関数は当面 export 維持 (Phase 2.4 で削除)
    - 3 ケース pass を確認

2.3 [Refactor] app.ts の createErrorHandler に DefaultErrorHandler を統合
    - import を差し替え、resolver.get(DefaultErrorHandler) で fallback 取得
    - app.test.ts 既存 12 ケースが green のままであることを確認

2.4 [Cleanup] 既存 handleError 関数 export を削除、index.ts の export を整理
```

これにより「test がまず壊れる → 実装で直す → refactor で形を整える」という cycle が plan 上で可読になる。

## Files Referenced

- `/workspaces/github.com/zeltjs/zelt/plans/fluttering-imagining-sutton.md` (target)
- `/workspaces/github.com/zeltjs/zelt/packages/core/src/modules/env/env.service.ts`
- `/workspaces/github.com/zeltjs/zelt/packages/core/src/modules/env/env.service.test.ts`
- `/workspaces/github.com/zeltjs/zelt/packages/core/src/modules/env/env.config.ts`
- `/workspaces/github.com/zeltjs/zelt/packages/core/src/modules/env/env.lib.ts`
- `/workspaces/github.com/zeltjs/zelt/packages/core/src/http/error-handler.ts` (test 不在)
- `/workspaces/github.com/zeltjs/zelt/packages/core/src/http/app.ts`
- `/workspaces/github.com/zeltjs/zelt/packages/core/src/http/app.test.ts`
- `/workspaces/github.com/zeltjs/zelt/packages/core/src/internal/container.ts` (`resolveWith` 既存資産)
- `/workspaces/github.com/zeltjs/zelt/packages/core/src/modules/logger/logger.integration.test.ts` (real subclass pattern の手本)
- `/workspaces/github.com/zeltjs/zelt/packages/adapter-node/src/index.test.ts`
- `/workspaces/github.com/zeltjs/zelt/packages/core/src/decorators/authorized.test.ts`
