# Plan Review: zeltjs/benchmarks - TDD/Testing Strategy Analysis

## Summary

このプランはベンチマーク環境の構築を目的としており、プロダクションコードではなくツールコードです。TDDの観点から見ると、**テスト戦略が完全に欠落**しています。ベンチマークツール自体の品質保証をどのように行うかが明記されていません。

## TDD Compliance

- **TDD Cycle**: Missing - プランにはRed-Green-Refactorサイクルの言及なし
- **Test-First**: No - 実装タスクにテスト作成フェーズが存在しない

### 問題点

プランの「実装タスク」セクション（Phase 1-3）を見ると:

```
### Phase 1: 基盤構築
1. package.json 作成
2. tsconfig.json 作成
3. tools/types.ts - 型定義
4. tools/benchmark.ts - スループット計測
5. tools/startup.ts - 起動時間計測
6. tools/run.ts - CLIエントリポイント
```

テスト作成のステップが存在しない。ベンチマークツール自体のテストがないと、計測結果の信頼性が担保できない。

## Testing Trophy Analysis

| レイヤー | プランでの計画 | 推奨 |
|---------|--------------|------|
| Static | tsconfig.jsonあり | OK |
| Unit | なし | tools/内の純粋関数（結果パース、時間計算）に対してテスト必要 |
| Integration | なし | CLIツール全体の統合テスト必要 |
| E2E | 「検証方法」セクションで手動確認 | CIで自動化すべき |

- **Balance**: テストが完全に欠落しているため、Trophy評価不可

## Mock Assessment

プランにはテストがないためモック戦略も未定義。

**推奨モック対象**:
- `autocannon`の外部呼び出し（実際のベンチマーク実行は重いため）
- Worker Threadsの起動時間計測（非決定的な結果を避ける）

**モック不要**:
- 結果のパース処理
- README生成ロジック

## Existing Test Patterns

zeltjsリポジトリの既存テストパターン:

```typescript
// packages/core/src/http/app.test.ts - 統合テストスタイル
describe('createHttpApp() — fetch', () => {
  it('serves a constructor-injected GET endpoint with pathParam', async () => {
    const app = buildApp();
    const res = await app.fetch(new Request('https://example.com/hello/zelt'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ message: 'hello, zelt' });
  });
});
```

- **Test Framework**: vitest
- **Pattern**: `describe` + `it` スタイル
- **Assertion**: `expect().toBe()` / `expect().toEqual()`
- **File Location**: ソースファイルと同階層にcolocated (`*.test.ts`)

ベンチマークプロジェクトでも同様のパターンを採用すべき。

## Issues

### [Critical] テスト戦略の欠落

**Severity**: Critical
**Location**: 実装タスク全体
**Problem**: ベンチマークツールのテストが計画されていない。計測ツールの品質が保証されないと、ベンチマーク結果自体の信頼性が疑われる。

**Suggestion**: Phase 1にテスト作成タスクを追加

```
### Phase 1: 基盤構築
1. package.json 作成 (vitest追加)
2. tsconfig.json 作成
3. vitest.config.ts 作成
4. tools/types.ts - 型定義
5. tools/benchmark.ts + benchmark.test.ts
   - RED: autocannonの結果パース関数のテスト作成
   - GREEN: パース関数実装
   - RED: 2ラウンド実行ロジックのテスト
   - GREEN: 実装
6. tools/startup.ts + startup.test.ts
   - RED: hrtime結果の変換テスト
   - GREEN: 実装
7. tools/run.ts + run.test.ts
   - RED: CLI引数パースのテスト
   - GREEN: 実装
```

### [High] 検証方法が手動のみ

**Severity**: High
**Location**: 検証方法セクション
**Problem**: 

```bash
pnpm benchmark hono          # 単体テスト
pnpm benchmark               # 全フレームワーク
```

これは手動検証であり、自動テストではない。

**Suggestion**: 自動テストとスモークテストを追加

```typescript
// tools/benchmark.test.ts
import { describe, it, expect } from 'vitest';
import { parseAutocannonResult } from './benchmark';

describe('parseAutocannonResult', () => {
  it('extracts requests per second from autocannon output', () => {
    const output = `Running 40s test @ http://localhost:3000
    100 connections with 10 pipelining factor

    Stat    2.5%    50%     97.5%   99%     Avg     Stdev   Max
    Latency 0 ms    0 ms    1 ms    1 ms    0.15 ms 0.36 ms 20 ms

    Req/Sec 142080  145919  149503  150527  145789  2256    150655
    Bytes/Sec 24.3 MB 25 MB 25.6 MB 25.8 MB 25 MB 386 kB 25.8 MB`;

    const result = parseAutocannonResult(output);
    expect(result.requestsPerSecond.avg).toBe(145789);
    expect(result.latency.avg).toBe(0.15);
  });
});
```

### [Medium] framework.json検証の欠落

**Severity**: Medium
**Location**: framework.jsonスキーマ
**Problem**: framework.jsonの形式検証が計画されていない。不正な設定ファイルでベンチマークが失敗する可能性。

**Suggestion**: バリデーション関数とテストを追加

```typescript
// tools/framework-schema.ts
import * as v from 'valibot';

export const FrameworkSchema = v.object({
  name: v.string(),
  description: v.string(),
  website: v.pipe(v.string(), v.url()),
  runtime: v.picklist(['node', 'bun']),
  setup: v.optional(v.array(v.string())),
  start: v.string(),
  startupFile: v.optional(v.string()),
});

// tools/framework-schema.test.ts
describe('FrameworkSchema', () => {
  it('validates correct framework.json', () => {
    const valid = {
      name: 'Hono',
      description: 'Web framework',
      website: 'https://hono.dev',
      runtime: 'node',
      start: 'node hello.ts'
    };
    expect(() => v.parse(FrameworkSchema, valid)).not.toThrow();
  });

  it('rejects invalid runtime value', () => {
    const invalid = { ...valid, runtime: 'deno' };
    expect(() => v.parse(FrameworkSchema, invalid)).toThrow();
  });
});
```

### [Medium] CI/CDでのテスト実行の欠落

**Severity**: Medium
**Location**: Phase 3 - .github/workflows/benchmark.yml
**Problem**: CI workflowの計画はあるが、ユニット/統合テストの実行が含まれていない。

**Suggestion**: ベンチマーク実行前にテストを必須化

```yaml
# .github/workflows/benchmark.yml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install
      - run: pnpm test  # ツールのユニットテスト

  benchmark:
    needs: test  # テスト成功が前提
    runs-on: ubuntu-latest
    steps:
      - run: pnpm benchmark
```

### [Low] ディレクトリ構成にテストファイルがない

**Severity**: Low
**Location**: ディレクトリ構成
**Problem**: 

```
├── tools/
│   ├── types.ts
│   ├── benchmark.ts
│   ├── startup.ts
│   ├── run.ts
│   └── readme.ts
```

テストファイルが含まれていない。

**Suggestion**: colocatedテストファイルを追加

```
├── tools/
│   ├── types.ts
│   ├── benchmark.ts
│   ├── benchmark.test.ts
│   ├── startup.ts
│   ├── startup.test.ts
│   ├── run.ts
│   ├── run.test.ts
│   ├── readme.ts
│   └── readme.test.ts
```

## Recommendations

1. **[Critical] Phase 1にテスト戦略を追加**
   - 各ツールファイル作成時にTDD方式で実装
   - vitest設定をpackage.jsonに追加
   - 純粋関数（結果パース、時間計算、README生成）は必ずユニットテスト

2. **[High] 統合テストを追加**
   - `tools/run.ts` CLI全体の統合テスト
   - モックサーバーを使った軽量なスモークテスト

3. **[Medium] スキーマ検証の実装**
   - framework.jsonのvalibotスキーマ定義
   - バリデーションエラー時のわかりやすいエラーメッセージ

4. **[Medium] CI workflowにテスト追加**
   - ベンチマーク実行前にユニットテストを必須化
   - テスト失敗時はベンチマークをスキップ

5. **[Low] テスト用のフィクスチャ準備**
   - autocannonの出力サンプル
   - 起動時間計測の期待値
   - framework.jsonの有効/無効パターン

## Recommended Plan Structure (TDD Version)

```
### Phase 1: 基盤構築（TDD）

1. プロジェクト初期化
   - package.json (vitest, valibotを含む)
   - tsconfig.json
   - vitest.config.ts

2. tools/types.ts
   - 型定義のみ（テスト不要）

3. tools/framework-schema.ts（TDD）
   - RED: 有効なframework.jsonのバリデーションテスト
   - GREEN: valibotスキーマ実装
   - RED: 無効な値の拒否テスト
   - GREEN: バリデーション強化

4. tools/benchmark.ts（TDD）
   - RED: autocannon結果パーステスト
   - GREEN: パース関数実装
   - RED: warmup/計測の2ラウンド実行テスト
   - GREEN: 実行ロジック実装
   - REFACTOR: エラーハンドリング追加

5. tools/startup.ts（TDD）
   - RED: hrtime変換テスト
   - GREEN: 変換関数実装
   - RED: サンプリング平均計算テスト
   - GREEN: 計算ロジック実装

6. tools/run.ts（TDD）
   - RED: CLI引数パーステスト
   - GREEN: 引数パース実装
   - RED: フレームワーク検出テスト
   - GREEN: 検出ロジック実装

7. tools/readme.ts（TDD）
   - RED: Markdownテーブル生成テスト
   - GREEN: 生成関数実装
```

---

**Review Conclusion**: このプランは機能要件は明確だが、テスト戦略が完全に欠落している。ベンチマークツールの信頼性を担保するために、TDD方式での実装とテストカバレッジの追加が必須。
