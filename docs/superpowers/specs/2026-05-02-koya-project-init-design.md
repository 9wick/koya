# koya プロジェクト初期化 設計仕様

- **Date**: 2026-05-02
- **Status**: Approved (brainstorming 完了)
- **Scope**: モノレポの土台と初期 3 パッケージのスケルトン構築。フレームワーク本体の API 設計は本仕様の対象外（実装フェーズで都度詰める）

---

## 1. プロジェクト・コンセプト

> **Edge/serverless 時代のための、Laravel/FuelPHP 的な型安全 TypeScript アプリケーションフレームワーク。**
>
> A fast, type-safe application framework for TypeScript, bringing Laravel/FuelPHP-like productivity to edge and serverless runtimes.

### 中核価値
- **Fast**: Cloudflare Workers / serverless cold start で実用的な起動・実行速度
- **Type-safe**: schema → request → controller → response → DI → test double が同一の型契約でつながる。実行時 validation と TypeScript 型は同じソースから導かれる
- **Application-oriented**: HTTP toolkit ではなく、controller / service / repository / config / lifecycle / error handling / testing / CLI/worker を統合した「アプリケーションの骨格」を提供

### 立ち位置
NestJS の重さを排し、Hono の速度・Needle DI の小さな依存集約・Valibot のスキーマ駆動の型安全性を土台に、Laravel/FuelPHP 的な生産性を edge/serverless 実行モデルに合わせて再設計する。

---

## 2. 確定済みの判断サマリ

| 項目 | 決定 | 根拠 |
|---|---|---|
| プロジェクト名 / 配置 | `koya` / `/workspaces/github.com/9wick/koya` | ユーザー指示 |
| 公開方針 | OSS、`npm publish` 想定、MIT | ユーザー指示 |
| ビルダ | `tsdown` | ユーザー指示 |
| パッケージ分割 | `@koya/core` + `@koya/testing` + `@koya/adapter-node` の初期 3 個 | testing は本番バンドルから物理的に分離。adapter-node は `node:http` 系の重さを独立化 |
| アダプタ配置 | Hono 方式（adapter-node は独立、workers/lambda は core の subpath） | edge ユーザーへの bundle 純度確保 |
| HTTP 層 | Hono を core の **dependencies** に内包（利用者には完全に隠蔽） | Laravel が裏で Symfony コンポーネントを使うのと同じ。アプリケーションフレームワークたる証 |
| DI | `@needle-di/core` | jexer-reserve で実績、`eslint-strict-type-rules` の `nestjs-like-di-for-needle-di` ルールで強制済み |
| Validation | `valibot` | コンセプト明記、軽量 |
| Error | `neverthrow` | 既存全プロジェクト共通、ESLint の `no-throw` 系で強制 |
| 厳格 lint | `@9wick/eslint-plugin-strict-type-rules` を **必須依存** で導入（dynamic import ではなく直接 import） | semlint/novel-translate-browser と同じ方式 |
| prepush 機構 | `@9wick/eslint-plugin-strict-type-rules` の `bin/prepush-hash.mjs` を CLI として利用（`tools/prepush-hash.sh` は作らない） | semlint と同じ最新方式。CLI は `save`/`check`/`compute`/`verify-footer` を提供 |
| Node / pnpm | Node `>=22.x` / `pnpm@10.33.0` | chohyo 最新踏襲 |
| TypeScript | `6.0.2`（chohyo と同) | `@9wick/eslint-plugin-strict-type-rules/tsconfig/strictest.json` を直接 extends |
| Test | `vitest@4.1.2` + `@vitest/coverage-v8@4.1.2` | chohyo 踏襲 |
| Lint Stack | Biome + Oxlint + ESLint(typescript-eslint) | chohyo 踏襲 |
| CI | GitHub Actions | chohyo の `ci.yml` を踏襲 + publish dry-run 追加 |
| examples | 初期は空 (`.gitkeep`) | YAGNI、実装フェーズで追加 |
| AGENTS.md | 作らない（一旦） | YAGNI |

---

## 3. ディレクトリ構造

```
koya/
├── examples/                        # フレームワーク利用例（private、publish しない）
│   └── .gitkeep
├── packages/
│   ├── core/                        # @koya/core
│   │   ├── src/
│   │   │   ├── index.ts             # 公開エントリ
│   │   │   ├── workers.ts           # subpath: @koya/core/workers
│   │   │   └── lambda.ts            # subpath: @koya/core/lambda
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── tsdown.config.ts
│   │   └── vitest.config.ts
│   ├── testing/                     # @koya/testing
│   │   ├── src/index.ts
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── tsdown.config.ts
│   │   └── vitest.config.ts
│   └── adapter-node/                # @koya/adapter-node
│       ├── src/index.ts
│       ├── package.json
│       ├── tsconfig.json
│       ├── tsdown.config.ts
│       └── vitest.config.ts
├── docs/
│   ├── .gitkeep
│   └── superpowers/specs/2026-05-02-koya-project-init-design.md  # 本仕様
├── plans/
│   └── .gitkeep
├── .github/workflows/ci.yml
├── .githooks/
│   ├── pre-commit
│   └── prepare-commit-msg
├── .npmrc
├── .gitignore
├── package.json                     # ルート
├── pnpm-workspace.yaml
├── nx.json
├── tsconfig.json                    # ルート（references のみ）
├── biome.json
├── oxlintrc.json
├── eslint.config.mjs
├── vitest.config.ts
├── knip.config.ts
├── README.md
└── LICENSE                          # MIT
```

`apps/` と `tools/` は **作らない**（YAGNI）。

`pnpm-workspace.yaml`:
```yaml
packages:
  - 'packages/*'
  - 'examples/*'
```

---

## 4. 採用ツール・バージョン（exact version）

CLAUDE.md ルール「`module@5.5.1` の exact version、caret 禁止」に準拠。

### Runtime / PM
| | 値 |
|---|---|
| Node engines | `>=22.x` |
| packageManager | `pnpm@10.33.0` |

### ルート `devDependencies` (Phase 1 確定値)
| パッケージ | バージョン | 用途 |
|---|---|---|
| `@biomejs/biome` | `2.4.14` | format / 一部 lint |
| `@eslint-community/eslint-plugin-eslint-comments` | `4.7.1` | eslint-disable 濫用禁止 |
| `@9wick/eslint-plugin-strict-type-rules` | `github:9wick/eslint-strict-type-rules#081ca1c7c414375e4efd906a1b3a84dd65e74e4f` | 型厳格 + neverthrow + bin: prepush-hash |
| `eslint` | `10.3.0` | 本体（peer は `^9.0.0` だが chohyo 採用済み） |
| `eslint-plugin-import-x` | `4.16.2` | import 整序、循環検出 |
| `eslint-plugin-oxlint` | `1.62.0` | oxlint と ESLint の重複ルール off |
| `eslint-plugin-sonarjs` | `4.0.3` | 認知的複雑度 |
| `oxlint` | `1.62.0` | 高速 lint（ESLint と二段） |
| `typescript-eslint` | `8.59.1` | typed linting |
| `typescript` | `6.0.2` | tsc / project references |
| `vitest` | `4.1.5` | test runner |
| `@vitest/coverage-v8` | `4.1.5` | coverage |
| `tsdown` | `0.9.3` | 各 package のビルド |
| `nx` | `21.6.10` | task graph / cache |
| `knip` | `6.10.0` | 未使用依存検出 |
| `@koya/testing` | `workspace:*` | (Phase 1 限定) `@koya/core` の dogfood test 用、Phase 2 で削除予定 |

### `@koya/core` の `dependencies` (Phase 1 確定値)
| パッケージ | バージョン | 用途 |
|---|---|---|
| `hono` | `4.12.16` | HTTP コア（**内部実装、利用者には隠蔽**） |
| `@needle-di/core` | `1.1.2` | DI コンテナ |
| `valibot` | `1.3.1` | schema-driven validation |
| `neverthrow` | `8.2.0` | Result/ResultAsync |

### `@koya/adapter-node` の `dependencies` (Phase 1 確定値)
| パッケージ | バージョン | 用途 |
|---|---|---|
| `@koya/core` | `workspace:*` | core 参照 |
| `@hono/node-server` | `2.0.1` | Node 用 listen（**内部実装**） |

### `@koya/testing` の `peerDependencies`
| パッケージ | バージョン | 備考 |
|---|---|---|
| `@koya/core` | `workspace:*` | core 参照 |
| `vitest` | `>=4 <5`（メジャー固定の range は peerDependencies の慣例として許容） | テストフレームワーク本体は利用者と版を揃える必要があるため peer |

### バージョン未確定で実装フェーズに持ち越す項目
- `hono` の正確な最新版
- `@hono/node-server` の正確な最新版
- `@9wick/eslint-plugin-strict-type-rules` の commit hash（git+ssh URL の `#<sha>` 部分）

---

## 5. 各設定ファイルの方針

### `tsconfig.json`（ルート）
```json
{
  "compilerOptions": {},
  "references": [
    { "path": "packages/core" },
    { "path": "packages/testing" },
    { "path": "packages/adapter-node" }
  ],
  "files": []
}
```

### 各 package の `tsconfig.json`
**`@9wick/eslint-plugin-strict-type-rules/tsconfig/strictest.json` を直接 extends**（chohyo の独自 base.json は **作らない** — SSoT 違反を避けるため）。

```jsonc
// packages/core/tsconfig.json
{
  "extends": "@9wick/eslint-plugin-strict-type-rules/tsconfig/strictest.json",
  "compilerOptions": {
    "composite": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "tsBuildInfoFile": "./dist/.tsbuildinfo"
  },
  "include": ["src/**/*"]
}
```

### `eslint.config.mjs`
- `@9wick/eslint-plugin-strict-type-rules` を **直接 import**（dynamic import 不要）
- 採用 config: `recommended` + `test` + `barrel`
- `react` config は skip（フロントエンドフレームワークではない）
- `barrel` config は `**/index.ts` に限定適用 → 公開 API の純度を保つ
- chohyo 由来の追加ルール:
  - `complexity: 7`
  - `sonarjs/cognitive-complexity: error`
  - `no-console: error`
  - `max-lines: ['warn', { max: 500, skipBlankLines: true, skipComments: true }]`
  - `import-x/no-cycle: error`
  - `import-x/order` (groups + newlines-between)
  - typed linting: `@typescript-eslint/no-unsafe-*`, `no-floating-promises`, `no-misused-promises`
- 例外:
  - test ファイル (`**/*.test.{ts,tsx}`): `no-console: off`, `max-lines: 1000`
  - examples (`examples/**/*.{ts,tsx}`): `no-console: off`

### `biome.json`
chohyo 踏襲。
```json
{
  "vcs": { "enabled": true, "clientKind": "git", "useIgnoreFile": true },
  "formatter": { "indentStyle": "space", "indentWidth": 2, "lineWidth": 100 },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "trailingCommas": "all",
      "semicolons": "always",
      "arrowParentheses": "always"
    }
  },
  "json": { "formatter": { "trailingCommas": "none" } },
  "linter": { "enabled": true },
  "css": { "linter": { "enabled": false }, "formatter": { "enabled": false } },
  "files": {
    "includes": ["**", "!node_modules", "!dist", "!.nx", "!pnpm-lock.yaml"]
  }
}
```

### `oxlintrc.json`
chohyo のシンプル版（typescript-eslint で厚く守るので oxlint は速度重視ルールに絞る）。
```json
{
  "rules": {
    "no-unused-vars": "warn",
    "no-console": "warn",
    "eqeqeq": "error",
    "no-var": "error",
    "prefer-const": "error"
  },
  "ignorePatterns": ["node_modules", "dist", ".nx"]
}
```

### `vitest.config.ts`
- **ルート**: jexer-reserve 方式で glob による projects 設定 + coverage
- **各 package**: 最小の `vitest.config.ts` を必ず置く（vitest 4.x の `projects` は各 glob 配下に config が無いと正しく動かないため）

ルート:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['packages/*', 'examples/*'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});
```

各 package（例: `packages/core/vitest.config.ts`）:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@koya/core',
    include: ['src/**/*.test.ts'],
  },
});
```

### `nx.json`
chohyo 21.6.10 ベース。`pnpm-sync:sync-deps` 連動は採用しない（YAGNI）。
```json
{
  "namedInputs": {
    "default": ["{projectRoot}/**/*", "sharedGlobals"],
    "production": [
      "default",
      "!{projectRoot}/**/*.test.ts",
      "!{projectRoot}/vitest.config.ts"
    ],
    "sharedGlobals": [
      "{workspaceRoot}/package.json",
      "{workspaceRoot}/pnpm-lock.yaml",
      "{workspaceRoot}/tsconfig.json"
    ]
  },
  "targetDefaults": {
    "build": { "cache": true, "dependsOn": ["^build"], "inputs": ["production", "^production"] },
    "test":  { "cache": true, "inputs": ["default", "^production"] },
    "lint":  { "cache": true, "inputs": ["default"] },
    "typecheck": { "cache": true, "dependsOn": ["^build"], "inputs": ["default", "^production"] }
  }
}
```

### `knip.config.ts`
```ts
import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  workspaces: {
    'packages/core':         { entry: ['src/index.ts', 'src/workers.ts', 'src/lambda.ts'] },
    'packages/testing':      { entry: ['src/index.ts'] },
    'packages/adapter-node': { entry: ['src/index.ts'] },
  },
  ignoreDependencies: ['nx', 'typescript'],
};

export default config;
```

---

## 6. `package.json` 雛形

### ルート
```json
{
  "name": "koya",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@10.33.0",
  "engines": { "node": ">=22.x" },
  "scripts": {
    "build": "nx run-many -t build",
    "test": "vitest run",
    "typecheck": "tsc -b",
    "lint": "eslint . && oxlint .",
    "lint:fix": "eslint . --fix && oxlint . --fix",
    "format": "biome format --write .",
    "format:check": "biome check .",
    "knip": "knip",
    "prepush": "pnpm format:check && pnpm typecheck && pnpm lint && pnpm build && pnpm test && npx prepush-hash save",
    "prepare": "git config core.hooksPath .githooks"
  },
  "devDependencies": { /* セクション 4 のとおり */ }
}
```

### `@koya/core`
```json
{
  "name": "@koya/core",
  "version": "0.0.0",
  "type": "module",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/9wick/koya.git",
    "directory": "packages/core"
  },
  "publishConfig": { "access": "public" },
  "exports": {
    ".":         { "types": "./dist/index.d.ts",   "import": "./dist/index.js" },
    "./workers": { "types": "./dist/workers.d.ts", "import": "./dist/workers.js" },
    "./lambda":  { "types": "./dist/lambda.d.ts",  "import": "./dist/lambda.js" }
  },
  "files": ["dist"],
  "scripts": { "build": "tsdown", "test": "vitest run", "typecheck": "tsc -b" },
  "dependencies": {
    "hono": "<実装フェーズ固定>",
    "@needle-di/core": "1.1.1",
    "valibot": "1.3.1",
    "neverthrow": "8.2.0"
  }
}
```

### `@koya/adapter-node`
```json
{
  "name": "@koya/adapter-node",
  "version": "0.0.0",
  "type": "module",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/9wick/koya.git",
    "directory": "packages/adapter-node"
  },
  "publishConfig": { "access": "public" },
  "exports": { ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" } },
  "files": ["dist"],
  "scripts": { "build": "tsdown", "test": "vitest run", "typecheck": "tsc -b" },
  "dependencies": {
    "@koya/core": "workspace:*",
    "@hono/node-server": "<実装フェーズ固定>"
  }
}
```

### `@koya/testing`
```json
{
  "name": "@koya/testing",
  "version": "0.0.0",
  "type": "module",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/9wick/koya.git",
    "directory": "packages/testing"
  },
  "publishConfig": { "access": "public" },
  "exports": { ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" } },
  "files": ["dist"],
  "scripts": { "build": "tsdown", "test": "vitest run", "typecheck": "tsc -b" },
  "dependencies": {
    "@koya/core": "workspace:*"
  },
  "peerDependencies": {
    "vitest": ">=4 <5"
  }
}
```

---

## 7. CI / Git Hooks / その他

### `.npmrc`
```
only-allow=pnpm
auto-install-peers=true
strict-peer-dependencies=false
minimum-release-age=0
save-exact=true
```

`save-exact=true` は CLAUDE.md ルール「Specify exact versions: `module@5.5.1` (NOT `^5.0.0`)」を `pnpm add` レベルで強制するため。

### `.githooks/pre-commit`
```bash
#!/usr/bin/env bash
set -euo pipefail
npx prepush-hash check
```

### `.githooks/prepare-commit-msg`
```bash
#!/usr/bin/env bash
set -euo pipefail
npx prepush-hash verify-footer "$1" "${2:-}"
```

### `.github/workflows/ci.yml`
chohyo 踏襲 + publish dry-run。
- triggers: `push: branches: [main]`、`pull_request: branches: [main]`
- jobs:
  1. `ci`: `pnpm install --frozen-lockfile` → `format:check` → `typecheck` → `lint` → `build` → `test` → uncommitted changes チェック
  2. `publish-dry-run` (main push のみ): `pnpm -r publish --dry-run --no-git-checks`

### `.gitignore`
```
node_modules/
dist/
.nx/
coverage/
*.tsbuildinfo
.env
.env.*
!.env.example
.DS_Store
*.log
```

### `README.md`（最低限）
- コンセプト 3 行サマリ + Fast/Type-safe/Application-oriented
- Status: pre-alpha / 0.x の間は minor で破壊的変更を許す旨を明記
- インストール / Quick start は実装フェーズで追記

### `LICENSE`
MIT 標準テキスト。Copyright (c) 2026 9wick / Kohei Kido。

---

## 8. 公開 API の設計ルール（実装フェーズで遵守すべき制約）

これは **本仕様の最も重要な決定** で、実装フェーズで動かしてはならない契約：

1. **`@koya/core` の公開 API では `hono.Context` / `hono.Hono` 型を露出させない**
   - 利用者が `import type { Context } from 'hono'` を書く必要が生じたら設計失敗
   - koya 独自の `Context`/`App` 等で wrap する
2. **Hono のミドルウェアエコシステムを直接使わせない**
   - 必要になったら `@koya/hono-bridge` のようなオプトイン bridge package を別途出す（YAGNI、初期化対象外）
3. **`@needle-di/core` の `Container` も型として露出させない**
   - DI 操作は koya 独自の API（例: `app.bind()`, `app.use()`）で覆う
4. **`valibot` の型は schema 入力箇所では露出を許す**（schema-driven の利用方法上、これは完全な隠蔽は非現実的）
5. **`neverthrow` の `Result` / `ResultAsync` 型は **露出する**（エラー設計の中核なので隠蔽しない）

これらに違反する PR は実装フェーズでブロック。

---

## 9. semver / リリース方針

- **0.x の間は minor で破壊的変更を許す**（README に明記）
- 1.0.0 以降は厳密な semver
- 初期リリースは 3 パッケージ同期で `0.1.0`
- changelog ツール（changesets 等）は **未導入**（最初は手動。リリース回数が増えた段階で再検討）

---

## 10. 段階的ロールアウト

| Phase | 内容 |
|---|---|
| Phase 0 (本仕様) | 設計合意 |
| Phase 1 (writing-plans → 実装) | 本仕様のスケルトン構築。3 パッケージはそれぞれ最小スタブ（`export {}` レベル）で OK。CI / hooks / lint / build が通る状態 |
| Phase 2 | `@koya/core` の API 設計（DI / lifecycle / context / error / validation の contract）→ 別 spec |
| Phase 3 | adapter-workers / adapter-lambda 実装、最初の `examples/hello` |
| Phase 4 | 0.1.0 同期リリース |

本仕様は Phase 1 の終了条件を定義する。

---

## 11. 未決事項 / 実装フェーズで確認する項目

| 項目 | 内容 |
|---|---|
| npm scope `@koya` の空き | `pnpm view @koya/core` で確認。占有済みなら別 scope に変更し、本仕様を更新 |
| `hono` 正確版 | `pnpm view hono version` |
| `@hono/node-server` 正確版 | `pnpm view @hono/node-server version` |
| `@9wick/eslint-plugin-strict-type-rules` の固定 commit hash | 実装フェーズで最新 main の SHA を取得して固定 |

---

## 12. 本仕様で決めない事項（実装フェーズに委ねる）

- フレームワーク本体の API 設計（DI binding 構文、ルーティング DSL、middleware モデル、error handler 形状、context shape など）
- リクエストコンテキスト伝搬（AsyncLocalStorage 利用の有無）→ Hono の責務に委譲
- worker / cron / CLI ランナーの設計
- ドキュメントサイト（必要になったら別 spec）

---

## 13. Phase 1 実装結果と plan/spec からの逸脱（2026-05-02 完了時点）

`pnpm prepush` 全 6 段階通過、`prepush-hash: 543baa18a670bd82` 状態でコミット。

### 13.1 構造的逸脱

| # | 内容 | 理由 | Phase 2 での扱い |
|---|---|---|---|
| 1 | `packages/testing/tsconfig.json` の `references` から `../core` を **削除** | `@koya/core` が dogfood test で `@koya/testing` を import するため、双方向 references で循環 | Phase 2 で testing が core 型を使い始めたら逆方向に置き換える（core の references から testing 削除、testing に core 復活） |
| 2 | `packages/testing/package.json` の `dependencies` から `@koya/core: workspace:*` を **削除** | Nx build 順序の循環依存解消。Phase 1 では testing は core を実装上使わない | 同上 |
| 3 | `packages/core/tsconfig.json` の `references` に `../testing` を追加、`packages/core/package.json` の `devDependencies` に `@koya/testing: workspace:*` を追加 | dogfood test 実現 | Phase 2 で逆転 |
| 4 | `packages/testing/src/` 構造変更: `version.ts` を新設し `__version` を export、`index.ts` は `export { __version } from './version';` の barrel に | strictest barrel rule (`index.ts は re-export のみ`) 遵守 | Phase 2 でも維持 |
| 5 | `biome.json` に `"assist": { "actions": { "source": { "organizeImports": "off" } } }` を追加 | Biome の organizeImports と ESLint の `import-x/order` が衝突 | 維持。import 順序は ESLint を SSoT とする |
| 6 | `eslint.config.mjs` の `ignores` に `**/*.config.{ts,mjs,js}` と `eslint.config.mjs` を追加 | typed linting の `projectService` が config ファイルを認識できないため parsing error 多発 | 維持 |
| 7 | `eslint.config.mjs` の test override に `'import-x/no-namespace': 'off'` を追加、examples override にも同設定 | dogfood test の `import * as core from './index'` を許可するため | 維持（example でも namespace import は実用的） |
| 8 | `vitest.config.ts` の `projects` を `['packages/*']` のみに変更（spec 当初は `['packages/*', 'examples/*']`） | YAGNI。examples で test を書く時に `examples/*` を復活 | 維持 |
| 9 | `examples/hello/` を Phase 1 で1個作成（`tsconfig.json` + `package.json` + `src/main.ts`） | `examples/.gitkeep` 単独より dogfood として有用 | Phase 2 で API が出始めたら main.ts を更新 |

### 13.2 バージョン更新（spec 当初値 → Phase 1 採用値）

CLAUDE.md「latest best practices」に従い実装フェーズで `pnpm view <pkg> version` で確認した最新値を採用：

| パッケージ | spec 当初 | Phase 1 確定 |
|---|---|---|
| `@biomejs/biome` | 2.4.9 | 2.4.14 |
| `eslint` | 10.1.0 | 10.3.0 |
| `oxlint` | 1.57.0 | 1.62.0 |
| `eslint-plugin-oxlint` | 1.57.0 | 1.62.0 |
| `eslint-plugin-sonarjs` | 4.0.2 | 4.0.3 |
| `typescript-eslint` | 8.57.2 | 8.59.1 |
| `vitest` | 4.1.2 | 4.1.5 |
| `@vitest/coverage-v8` | 4.1.2 | 4.1.5 |
| `knip` | 6.1.0 | 6.10.0 |
| `@needle-di/core` | 1.1.1 | 1.1.2 |
| `hono` | (未定) | 4.12.16 |
| `@hono/node-server` | (未定) | 2.0.1 |

### 13.3 既知の許容事項

- `tsdown@0.9.3 → rolldown-plugin-dts@0.8.6` が `typescript@^5.0.0` を peer 要求するが、`typescript@6.0.2` で動作実証済み（chohyo と同様）。`.npmrc` の `strict-peer-dependencies=false` で許容
- `@9wick/eslint-plugin-strict-type-rules` の peer は `eslint@^9.0.0` だが `eslint@10.3.0` で動作実証済み（chohyo と同様）
- `tseslint.config()` 呼び出しが TypeScript 6 で deprecated 警告を出すが、chohyo / semlint / nx-pnpm-workspace-base 等の既存プロジェクトで現役パターンなので許容。typescript-eslint の新 API に移行するのは別タスク

### 13.4 Phase 1 で確定した npm scope

`pnpm view @koya/core` / `@koya/testing` / `@koya/adapter-node` 全て 404 = scope 名は npm 上で利用可能。ただし scope `@koya` の組織登録は Phase 4（リリース）時に `npm org create koya` で実施するか個人 scope への変更を判断。

### 13.5 Phase 2 への申し送り

1. **API 設計の brainstorming は別 spec として書き出す**（本 spec は Phase 1 完了で凍結）。
2. **class 使用ルールの明文化**: 「class は `@injectable()` を持つ DI 登録単位（Repository, UseCase 等）のみ。ドメインモデル/値オブジェクト/pure logic は関数 + readonly type」。`eslint-plugin-strict-type-rules` の `nestjs-like-di-for-needle-di` ルールが enforcer。
3. **公開 API ルール（spec section 8）の検査自動化**: `grep "from 'hono'" packages/*/dist/*.d.ts` が空であることを CI に追加。
4. **逸脱 #1〜#3 の逆転**: Phase 2 で testing が core API を使い始めるタイミングで、tsconfig references / package.json dependencies / devDependencies を逆方向に再構成。dogfood test は別の検証方法（例: pnpm-link 状態の確認）に置き換える。
