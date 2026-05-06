# @zeltjs/cli パッケージ設計

## Context

zeltフレームワークにNestJSのような統合CLIを追加する。現在`@zeltjs/openapi`に`zelt-openapi`コマンドがあるが、ビルド・開発サーバー・コード生成を含む統合CLIが必要。

## 決定事項

- **パッケージ名**: `@zeltjs/cli`
- **コマンド名**: `zelt` (bin: "zelt")
- **優先順位**: build/dev を先に実装、openapi統合は後
- **defineConfig統一**: `@zeltjs/cli`が所有、`@zeltjs/openapi`はre-export

## 技術選定

- **CLIフレームワーク**: citty 0.1.6 (unjs製、ネストサブコマンド対応)
- **設定ローダー**: c12 (unjs製、.ts/.js/.mjs対応)
- **ビルダー**: tsdown (esbuild)
- **開発サーバー**: chokidar + child_process (プロセス再起動方式)
  - サーバーサイドHMRは状態管理が複雑で現実的でない
- **設定**: zelt.config.ts を拡張

## コマンド構造

```
zelt
├── build              # tsdownでトランスパイル+バンドル
├── dev                # 開発サーバー (プロセス再起動)
├── generate <type>    # コード生成 (後で実装)
│   ├── controller
│   ├── service
│   ├── middleware
│   └── module
└── openapi            # 既存機能を統合 (後で実装)
    ├── build
    └── watch
```

## パッケージ構造 (Phase 1-2のみ)

```
packages/cli/
├── package.json
├── tsdown.config.ts
├── vitest.config.ts
└── src/
    ├── cli.ts                   # エントリーポイント (runMain直接実行)
    ├── commands/
    │   ├── index.ts             # mainCommand
    │   ├── build.ts
    │   ├── build.test.ts
    │   ├── dev.ts
    │   └── dev.test.ts
    ├── config/
    │   ├── index.ts             # defineConfig, loadConfig (c12使用)
    │   ├── index.test.ts
    │   └── schema.ts            # ZeltConfig型 (valibot)
    ├── builders/
    │   └── tsdown.ts
    └── dev-server/
        ├── index.ts
        └── watcher.ts
```

※ generate/, openapi/ はPhase 3-4で追加

## 設定ファイル拡張 (zelt.config.ts)

```typescript
import { defineConfig } from '@zeltjs/cli';

export default defineConfig({
  // OpenAPI設定 (名前空間化、後方互換のためトップレベルも読み込む)
  openapi: {
    controllers: ['./src/**/*.controller.ts'],
    outDir: './generated',
    tsconfig: './tsconfig.json',
  },

  // ビルド設定
  build: {
    entry: './src/main.ts',
    outDir: './dist',
    platform: 'node',    // 'node' | 'browser' | 'neutral'
    format: 'esm',       // 'esm' | 'cjs'
    external: true,      // node_modulesを外部依存として扱う
  },

  // 開発サーバー
  dev: {
    entry: './src/entry/node.ts',
    port: 3000,
    watch: ['./src/**/*.ts'],
    ignore: ['**/*.test.ts', '**/dist/**', '**/generated/**'],
    debounceMs: 300,
  },
});
```

## defineConfig統一方針

1. `@zeltjs/cli`がZeltConfig型とdefineConfigを所有
2. `@zeltjs/openapi`は`@zeltjs/cli`からre-export
3. 後方互換: トップレベルの`controllers`, `dist`, `tsconfig`も読み込む

## 既存zelt-openapiとの統合

1. `zelt openapi build/watch` は内部で `@zeltjs/openapi` の関数を呼び出す
2. 移行期間中は `zelt-openapi` コマンドも動作継続 (deprecated warning)
3. 最終的に `@zeltjs/openapi` からCLI部分を削除

## 実装フェーズ

### Phase 1: 基盤 + build (今回)
- [ ] パッケージ作成 (`packages/cli`)
  - package.json, tsdown.config.ts, vitest.config.ts
  - workspace/nx統合
- [ ] 設定システム (TDD)
  - テスト: c12でzelt.config.ts読み込み
  - 実装: defineConfig, loadConfig, ZeltConfig型
- [ ] citty導入、メインコマンド構造
  - テスト: `zelt --help`でコマンド一覧表示
  - 実装: cli.ts, commands/index.ts
- [ ] `zelt build` (TDD)
  - テスト: examples/helloでビルド成功、dist/出力確認
  - 実装: tsdownラッパー

### Phase 2: dev (今回)
- [ ] `zelt dev` (TDD)
  - テスト: サーバー起動、ファイル変更で再起動
  - 実装: chokidar + child_process
  - 仕様: debounce 300ms、SIGTERM→SIGKILL(3s)、ignore pattern

### Phase 3: openapi統合 (後で)
- [ ] `zelt openapi build/watch` 統合
- [ ] `@zeltjs/openapi`のdefineConfigをre-exportに変更

### Phase 4: コード生成 (後で)
- [ ] `zelt generate controller`
- [ ] `zelt generate service`
- [ ] `zelt generate middleware`
- [ ] `zelt generate module`

## 重要ファイル

- `packages/contract/src/cli.ts` - 既存CLI、移行元
- `packages/contract/src/load-config.ts` - 設定読み込み (参考)
- `packages/contract/src/generate-client.ts` - OpenAPI生成コア
- `packages/adapter-node/src/index.ts` - serve関数 (devサーバー参考)
- `examples/hello/zelt.config.ts` - 設定例
- `examples/hello/src/entry/node.ts` - Node.jsエントリーポイント例

## 検証方法

```bash
# Phase 1: build
pnpm build
cd examples/hello
npx zelt build
ls -la dist/  # 出力確認

# Phase 2: dev
npx zelt dev  # サーバー起動
# 別ターミナルでファイル変更 → 再起動確認

# 自動テスト
pnpm test --filter @zeltjs/cli
```

## エラーハンドリング

| エラーケース | 対応 |
|-------------|------|
| 設定ファイル不在 | 明確なエラー + exit 1 |
| 設定ファイル構文エラー | パース位置を含むメッセージ |
| ビルド失敗 | tsdownエラーをそのまま出力 |
| devサーバークラッシュ | スタック表示後、ファイル変更待機継続 |
| ポート占有 | 明確なエラー + 代替ポート提案 |
