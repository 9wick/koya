# koya Phase 1: Project Scaffolding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-05-02-koya-project-init-design.md` (read first)

**Goal:** koya モノレポの土台と初期 3 パッケージのスケルトンを構築し、`pnpm prepush` が通る状態にする。

**Architecture:** pnpm workspace + Nx の monorepo。`@koya/core` (HTTP/DI/lifecycle/validation/error) + `@koya/testing` (test utilities) + `@koya/adapter-node` (Node 用 listen) の 3 パッケージ。各パッケージは tsdown でビルドし、`@9wick/eslint-plugin-strict-type-rules/tsconfig/strictest.json` を直接 extends した tsconfig で型厳格を担保。

**Tech Stack:** TypeScript 6 / pnpm 10.33 / Nx 21.6 / Vitest 4.1 / Biome 2.4 / Oxlint 1.57 / ESLint 10 + typescript-eslint 8.57 / Hono (内部) / @needle-di/core / valibot / neverthrow

---

## File Structure

このプランで作成するファイルの全リスト：

**ルート設定:**
- `package.json` — モノレポ scripts と devDependencies の親
- `pnpm-workspace.yaml` — workspace glob
- `.npmrc` — pnpm 設定（save-exact=true で exact version 強制）
- `nx.json` — task graph と cache
- `tsconfig.json` — references のみ
- `biome.json` — formatter
- `oxlintrc.json` — 速度重視 lint
- `eslint.config.mjs` — typed linting + 型厳格
- `vitest.config.ts` — projects glob
- `knip.config.ts` — 未使用依存検出
- `.gitignore`
- `.githooks/pre-commit` — prepush-hash check
- `.githooks/prepare-commit-msg` — フッタ自動付与
- `.github/workflows/ci.yml` — GitHub Actions CI
- `LICENSE` — MIT
- `README.md` — プロジェクト概要

**packages/core/:**
- `package.json` — `@koya/core` (subpath exports)
- `tsconfig.json` — strictest.json extends
- `tsdown.config.ts` — 3 entries (index, workers, lambda)
- `vitest.config.ts` — 各 package で必須（projects が拾うため）
- `src/index.ts` — 公開エントリ（最小スタブ）
- `src/workers.ts` — Workers アダプタ（最小スタブ）
- `src/lambda.ts` — Lambda アダプタ（最小スタブ）
- `src/index.test.ts` — entry import によるロード検証

**packages/testing/:**
- `package.json` — `@koya/testing`
- `tsconfig.json`
- `tsdown.config.ts`
- `vitest.config.ts`
- `src/index.ts` — スタブ（`__version` を export してdogfood用）
- `src/index.test.ts`

**packages/adapter-node/:**
- `package.json` — `@koya/adapter-node`
- `tsconfig.json`
- `tsdown.config.ts`
- `vitest.config.ts`
- `src/index.ts` — スタブ
- `src/index.test.ts`

**プレースホルダ:**
- `docs/.gitkeep`
- `plans/.gitkeep`
- `examples/.gitkeep`

---

## 実装ノート（全タスク共通）

- **commit はユーザーから明示的に指示があるまで保留**（CLAUDE.md ルール）。各タスクの最後の commit ステップは「ユーザー指示があれば実行」と読み替えて良い。
- **すべての `pnpm add` は `.npmrc` の `save-exact=true` により自動で exact 化される**。万一 caret や tilde が紛れたら `package.json` を手動で編集して数字部分のみにする。
- **動作確認の `Expected:` は必ず確認する**。期待と異なる出力が出たら次のステップに進まず、原因を特定する。
- 作業ディレクトリは `/workspaces/github.com/9wick/koya`。

---

## Task 0: npm scope `@koya` の利用可否確認

**Files:** なし（情報収集のみ）

- [ ] **Step 0.1: `@koya/core` の npm 占有状況を確認**

Run: `pnpm view @koya/core 2>&1 | head -5`
Expected: 以下のいずれか
- `ERR_PNPM_NO_MATCHING_VERSION` または `404` 系エラー → scope `@koya` は利用可能、本プランの想定どおり進める
- パッケージ情報が表示される → scope が他者に占有されている。**プランの実行を中断**し、ユーザーに別 scope（例: `@9wick/koya-*`）を提案して spec/plan を改訂する

- [ ] **Step 0.2: `@koya/testing` / `@koya/adapter-node` も同様に確認**

Run: `pnpm view @koya/testing 2>&1 | head -5 && pnpm view @koya/adapter-node 2>&1 | head -5`
Expected: 両方ともエラー or 404。占有されていれば Step 0.1 と同様にプラン中断。

- [ ] **Step 0.3: scope owner 権限を将来確認することをメモ**

scope 自体が利用可能でも、初回 publish 時には `npm org create` または個人 scope `~9wick/...` への変更が必要になる場合がある。これは Phase 4（リリース）で確認する。

---

## Task 1: pnpm workspace 基盤

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `.npmrc`
- Create: `package.json` (ルート、最小)
- Create: `.gitignore`

- [ ] **Step 1.1: `.npmrc` を作成**

```
only-allow=pnpm
auto-install-peers=true
strict-peer-dependencies=false
minimum-release-age=0
save-exact=true
```

- [ ] **Step 1.2: `pnpm-workspace.yaml` を作成**

```yaml
packages:
  - 'packages/*'
  - 'examples/*'
```

- [ ] **Step 1.3: ルート `package.json` の最小版を作成**

```json
{
  "name": "koya",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@10.33.0",
  "engines": {
    "node": ">=22.x"
  },
  "scripts": {},
  "devDependencies": {}
}
```

- [ ] **Step 1.4: `.gitignore` を作成**

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

- [ ] **Step 1.5: `pnpm install` で動作確認**

Run: `pnpm install`
Expected: `Done` で終了し、`pnpm-lock.yaml` と `node_modules/` が作成される。エラーなし。

- [ ] **Step 1.6: Commit (ユーザー指示時のみ)**

```bash
git add .npmrc pnpm-workspace.yaml package.json .gitignore pnpm-lock.yaml
git commit -m "chore: bootstrap pnpm workspace"
```

---

## Task 2: TypeScript と必須開発依存の追加

**Files:**
- Modify: `package.json` (devDependencies 追加)
- Create: `tsconfig.json` (ルート)

- [ ] **Step 2.1: 最新の `@9wick/eslint-plugin-strict-type-rules` の commit hash を取得**

Run: `git ls-remote git@github.com:9wick/eslint-strict-type-rules.git HEAD`
Expected: SHA1 ハッシュが1行で出力される。例: `daa01c0058d24d6a750278c0cd3398122ef9da80	HEAD`

このハッシュを以降 `<ESLINT_PLUGIN_SHA>` と呼ぶ。

- [ ] **Step 2.2: TypeScript と tsdown を追加**

Run: `pnpm add -D -w typescript@6.0.2 tsdown@0.9.3`
Expected: `Done` で終了。`package.json` に2件追加され、バージョン部分に `^` や `~` が付かない（exact）。

- [ ] **Step 2.3: `@9wick/eslint-plugin-strict-type-rules` を追加**

Run: `pnpm add -D -w "git+ssh://git@github.com/9wick/eslint-strict-type-rules.git#<ESLINT_PLUGIN_SHA>"`
Expected: `Done`、`package.json` に `@9wick/eslint-plugin-strict-type-rules` が追加される。

- [ ] **Step 2.4: ルート `tsconfig.json` を作成**

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

- [ ] **Step 2.5: Commit (ユーザー指示時のみ)**

```bash
git add package.json pnpm-lock.yaml tsconfig.json
git commit -m "chore: add typescript, tsdown, strict-type-rules"
```

---

## Task 3: @koya/core スケルトン

**Files:**
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/tsdown.config.ts`
- Create: `packages/core/src/index.ts`
- Create: `packages/core/src/workers.ts`
- Create: `packages/core/src/lambda.ts`

- [ ] **Step 3.1: `packages/core/package.json` を作成**

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
  "scripts": {
    "build": "tsdown",
    "test": "vitest run",
    "typecheck": "tsc -b"
  },
  "dependencies": {}
}
```

- [ ] **Step 3.2: `packages/core/tsconfig.json` を作成**

```json
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

- [ ] **Step 3.3: `packages/core/tsdown.config.ts` を作成**

```ts
import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts', 'src/workers.ts', 'src/lambda.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
});
```

- [ ] **Step 3.4: `packages/core/src/index.ts` を作成（最小スタブ）**

```ts
export {};
```

- [ ] **Step 3.5: `packages/core/src/workers.ts` を作成（最小スタブ）**

```ts
export {};
```

- [ ] **Step 3.6: `packages/core/src/lambda.ts` を作成（最小スタブ）**

```ts
export {};
```

- [ ] **Step 3.7: Commit (ユーザー指示時のみ)**

```bash
git add packages/core
git commit -m "feat(core): add skeleton for @koya/core"
```

---

## Task 4: @koya/testing スケルトン

**Files:**
- Create: `packages/testing/package.json`
- Create: `packages/testing/tsconfig.json`
- Create: `packages/testing/tsdown.config.ts`
- Create: `packages/testing/src/index.ts`

- [ ] **Step 4.1: `packages/testing/package.json` を作成**

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
  "scripts": {
    "build": "tsdown",
    "test": "vitest run",
    "typecheck": "tsc -b"
  },
  "dependencies": {
    "@koya/core": "workspace:*"
  },
  "peerDependencies": {
    "vitest": ">=4 <5"
  }
}
```

- [ ] **Step 4.2: `packages/testing/tsconfig.json` を作成**

```json
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
  "include": ["src/**/*"],
  "references": [
    { "path": "../core" }
  ]
}
```

- [ ] **Step 4.3: `packages/testing/tsdown.config.ts` を作成**

```ts
import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
});
```

- [ ] **Step 4.4: `packages/testing/src/index.ts` を作成（最小スタブ）**

```ts
export {};
```

- [ ] **Step 4.5: Commit (ユーザー指示時のみ)**

```bash
git add packages/testing
git commit -m "feat(testing): add skeleton for @koya/testing"
```

---

## Task 5: @koya/adapter-node スケルトン

**Files:**
- Create: `packages/adapter-node/package.json`
- Create: `packages/adapter-node/tsconfig.json`
- Create: `packages/adapter-node/tsdown.config.ts`
- Create: `packages/adapter-node/src/index.ts`

- [ ] **Step 5.1: `packages/adapter-node/package.json` を作成（@hono/node-server 抜きで）**

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
  "scripts": {
    "build": "tsdown",
    "test": "vitest run",
    "typecheck": "tsc -b"
  },
  "dependencies": {
    "@koya/core": "workspace:*"
  }
}
```

- [ ] **Step 5.2: `packages/adapter-node/tsconfig.json` を作成**

```json
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
  "include": ["src/**/*"],
  "references": [
    { "path": "../core" }
  ]
}
```

- [ ] **Step 5.3: `packages/adapter-node/tsdown.config.ts` を作成**

```ts
import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
});
```

- [ ] **Step 5.4: `packages/adapter-node/src/index.ts` を作成（最小スタブ）**

```ts
export {};
```

- [ ] **Step 5.5: pnpm install で workspace ローカル参照を解決**

Run: `pnpm install`
Expected: 3 つの workspace package が認識され、`node_modules/@koya/{core,testing,adapter-node}` がシンボリックリンクで作成される。

- [ ] **Step 5.6: typecheck で全体動作確認**

Run: `pnpm exec tsc -b`
Expected: エラーなし。各パッケージで `dist/.tsbuildinfo` が作られる。

- [ ] **Step 5.7: Commit (ユーザー指示時のみ)**

```bash
git add packages/adapter-node pnpm-lock.yaml
git commit -m "feat(adapter-node): add skeleton for @koya/adapter-node"
```

---

## Task 6: Nx 設定 + ビルド動作確認

**Files:**
- Modify: `package.json` (scripts 追加, nx 依存追加)
- Create: `nx.json`

- [ ] **Step 6.1: nx を追加**

Run: `pnpm add -D -w nx@21.6.10`
Expected: `Done`、`package.json` に `nx@21.6.10` 追加。

- [ ] **Step 6.2: `nx.json` を作成**

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
    "build": {
      "cache": true,
      "dependsOn": ["^build"],
      "inputs": ["production", "^production"]
    },
    "test": {
      "cache": true,
      "inputs": ["default", "^production"]
    },
    "lint": {
      "cache": true,
      "inputs": ["default"]
    },
    "typecheck": {
      "cache": true,
      "dependsOn": ["^build"],
      "inputs": ["default", "^production"]
    }
  }
}
```

- [ ] **Step 6.3: ルート `package.json` の scripts に build / typecheck を追加**

`package.json` の `scripts` を以下に置き換え：

```json
"scripts": {
  "build": "nx run-many -t build",
  "typecheck": "tsc -b"
}
```

- [ ] **Step 6.4: 全パッケージの build を確認**

Run: `pnpm build`
Expected: 3 パッケージで tsdown が走り、各 `packages/*/dist/` に `.js` と `.d.ts` が生成される。エラーなし。

- [ ] **Step 6.5: dist 出力を確認**

Run: `ls packages/core/dist`
Expected: `index.js`, `index.d.ts`, `workers.js`, `workers.d.ts`, `lambda.js`, `lambda.d.ts` などが存在する。

- [ ] **Step 6.6: Commit (ユーザー指示時のみ)**

```bash
git add package.json pnpm-lock.yaml nx.json
git commit -m "chore: add nx and build scripts"
```

---

## Task 7: Hono と他のフレームワーク依存の追加（バージョン確定）

**Files:**
- Modify: `packages/core/package.json` (dependencies 追加)
- Modify: `packages/adapter-node/package.json` (dependencies 追加)

- [ ] **Step 7.1: hono の最新版を取得**

Run: `pnpm view hono version`
Expected: バージョン文字列1行（例: `4.6.14`）。これを `<HONO_VERSION>` と呼ぶ。

- [ ] **Step 7.2: @hono/node-server の最新版を取得**

Run: `pnpm view @hono/node-server version`
Expected: バージョン文字列1行（例: `1.13.7`）。これを `<HONO_NODE_VERSION>` と呼ぶ。

- [ ] **Step 7.3: @koya/core に hono / @needle-di/core / valibot / neverthrow を追加**

Run: `pnpm --filter @koya/core add hono@<HONO_VERSION> @needle-di/core@1.1.1 valibot@1.3.1 neverthrow@8.2.0`
Expected: `Done`、`packages/core/package.json` の `dependencies` に4件追加（exact version）。

- [ ] **Step 7.4: @koya/adapter-node に @hono/node-server を追加**

Run: `pnpm --filter @koya/adapter-node add @hono/node-server@<HONO_NODE_VERSION>`
Expected: `Done`、`packages/adapter-node/package.json` の `dependencies` に追加。

- [ ] **Step 7.5: ルート + 全 package の package.json で caret/tilde が無いか確認**

`peerDependencies` は range が許容される（例: `vitest: ">=4 <5"`）ので除外し、`dependencies` / `devDependencies` / `optionalDependencies` のみ検査する。

Run:
```bash
node -e '
const fs = require("node:fs");
const files = ["package.json", ...require("node:fs").readdirSync("packages").map(p => `packages/${p}/package.json`)];
let bad = [];
for (const f of files) {
  if (!fs.existsSync(f)) continue;
  const j = JSON.parse(fs.readFileSync(f, "utf-8"));
  for (const key of ["dependencies", "devDependencies", "optionalDependencies"]) {
    for (const [name, ver] of Object.entries(j[key] ?? {})) {
      if (typeof ver !== "string") continue;
      if (ver.startsWith("workspace:")) continue;
      if (ver.startsWith("git+")) continue;
      if (/^[\^~]/.test(ver) || /\sx\b/.test(ver) || /\.x/.test(ver)) {
        bad.push(`${f}: ${key}.${name} = ${ver}`);
      }
    }
  }
}
if (bad.length) { console.error(bad.join("\n")); process.exit(1); }
console.log("All exact versions ✓");
'
```
Expected: `All exact versions ✓` 表示、exit 0。

もし違反があれば該当行が表示される。`package.json` を直接編集して `^` / `~` / `x` を除き、再度 `pnpm install` で lockfile を更新する。

- [ ] **Step 7.6: pnpm install で lockfile 更新**

Run: `pnpm install`
Expected: `Done`、新しい依存が解決される。

- [ ] **Step 7.7: build で全体確認**

Run: `pnpm build`
Expected: エラーなし。

- [ ] **Step 7.8: Commit (ユーザー指示時のみ)**

```bash
git add packages/core/package.json packages/adapter-node/package.json pnpm-lock.yaml
git commit -m "feat: add framework dependencies (hono, needle-di, valibot, neverthrow)"
```

---

## Task 8: Vitest 基盤（実 import 検証 + testing dogfooding）

**Files:**
- Modify: `package.json` (devDependencies 追加, scripts 追加)
- Create: `vitest.config.ts` (ルート)
- Create: `packages/core/vitest.config.ts`
- Create: `packages/testing/vitest.config.ts`
- Create: `packages/adapter-node/vitest.config.ts`
- Modify: `packages/testing/src/index.ts` (`__version` を export)
- Modify: `packages/core/package.json` (devDependencies に `@koya/testing` 追加)
- Create: `packages/core/src/index.test.ts`
- Create: `packages/testing/src/index.test.ts`
- Create: `packages/adapter-node/src/index.test.ts`

- [ ] **Step 8.1: vitest と coverage を追加**

Run: `pnpm add -D -w vitest@4.1.2 @vitest/coverage-v8@4.1.2`
Expected: `Done`、2件追加。

- [ ] **Step 8.2: ルート `vitest.config.ts` を作成**

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

- [ ] **Step 8.3: ルート `package.json` の scripts に test を追加**

`scripts` セクションに以下を追加：

```json
"test": "vitest run"
```

- [ ] **Step 8.4: `packages/core/vitest.config.ts` を作成**

`projects` が各 glob 配下に config を要求するため必須（jexer-reserve も同様の構成）。

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@koya/core',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 8.5: `packages/testing/vitest.config.ts` を作成**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@koya/testing',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 8.6: `packages/adapter-node/vitest.config.ts` を作成**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@koya/adapter-node',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 8.7: `@koya/testing` の `src/index.ts` を dogfood 用に書き換える**

`packages/testing/src/index.ts`:
```ts
export const __version = '0.0.0';
```

これは Phase 1 で `@koya/core` 側のテストから `@koya/testing` を import できることを確認するためのスタブ export。Phase 2 で実際の test utility に置き換える。

- [ ] **Step 8.8: `@koya/core` に `@koya/testing` を devDependency として追加**

Run: `pnpm --filter @koya/core add -D @koya/testing@workspace:*`
Expected: `Done`、`packages/core/package.json` の `devDependencies` に `"@koya/testing": "workspace:*"` が追加される。

- [ ] **Step 8.9: `packages/core/src/index.test.ts` を作成（実 import + testing dogfood）**

`expect(true).toBe(true)` のような無価値テストは書かない。entry の整合性 + workspace linking を実検証する：

```ts
import { describe, expect, it } from 'vitest';

import * as core from './index';
import * as workers from './workers';
import * as lambda from './lambda';
import { __version } from '@koya/testing';

describe('@koya/core entries', () => {
  it('index module loads', () => {
    expect(core).toBeDefined();
  });

  it('workers subpath module loads', () => {
    expect(workers).toBeDefined();
  });

  it('lambda subpath module loads', () => {
    expect(lambda).toBeDefined();
  });

  it('reaches @koya/testing via workspace linking (dogfood)', () => {
    expect(__version).toBe('0.0.0');
  });
});
```

これにより以下が同時に検証される：
- core の 3 つの entry (`index`, `workers`, `lambda`) が ESM として load 可能
- `exports` map と src ファイル構造の整合性
- `@koya/core` → `@koya/testing` の workspace ローカル参照が機能している
- `peerDependencies.vitest` の構造で testing を test 環境から触れる

- [ ] **Step 8.10: `packages/testing/src/index.test.ts` を作成（実 import）**

```ts
import { describe, expect, it } from 'vitest';

import { __version } from './index';

describe('@koya/testing', () => {
  it('module loads and exports __version', () => {
    expect(__version).toBe('0.0.0');
  });
});
```

- [ ] **Step 8.11: `packages/adapter-node/src/index.test.ts` を作成（実 import）**

```ts
import { describe, expect, it } from 'vitest';

import * as adapter from './index';

describe('@koya/adapter-node', () => {
  it('module loads', () => {
    expect(adapter).toBeDefined();
  });
});
```

- [ ] **Step 8.12: テスト実行**

Run: `pnpm test`
Expected: 3 packages のテストがすべて pass。`@koya/core` で 4 tests、`@koya/testing` で 1 test、`@koya/adapter-node` で 1 test。合計 `6 passed`。

各 vitest project が name で区別されて出力される（例: `RUN  v4.1.2 [@koya/core]`、`RUN  v4.1.2 [@koya/testing]` 等）。

- [ ] **Step 8.13: Commit (ユーザー指示時のみ)**

```bash
git add package.json pnpm-lock.yaml vitest.config.ts packages/*/vitest.config.ts packages/*/src
git commit -m "test: add vitest setup with workspace dogfooding"
```

---

## Task 9: Biome 設定

**Files:**
- Modify: `package.json` (devDependencies, scripts)
- Create: `biome.json`

- [ ] **Step 9.1: Biome を追加**

Run: `pnpm add -D -w @biomejs/biome@2.4.9`
Expected: `Done`。

- [ ] **Step 9.2: `biome.json` を作成**

```json
{
  "vcs": {
    "enabled": true,
    "clientKind": "git",
    "useIgnoreFile": true
  },
  "formatter": {
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "trailingCommas": "all",
      "semicolons": "always",
      "arrowParentheses": "always"
    }
  },
  "json": {
    "formatter": {
      "trailingCommas": "none"
    }
  },
  "linter": {
    "enabled": true
  },
  "css": {
    "linter": { "enabled": false },
    "formatter": { "enabled": false }
  },
  "files": {
    "includes": ["**", "!node_modules", "!dist", "!.nx", "!pnpm-lock.yaml"]
  }
}
```

- [ ] **Step 9.3: ルート scripts に format / format:check を追加**

```json
"format": "biome format --write .",
"format:check": "biome check ."
```

- [ ] **Step 9.4: format を全ファイルに適用**

Run: `pnpm format`
Expected: いくつかのファイルが reformat される（特に JSON のインデント等）。エラーなし。

- [ ] **Step 9.5: format:check で動作確認**

Run: `pnpm format:check`
Expected: `Checked X file(s)` と表示されエラーなし。

- [ ] **Step 9.6: Commit (ユーザー指示時のみ)**

```bash
git add package.json pnpm-lock.yaml biome.json
git add -u  # reformat されたファイル
git commit -m "chore: add biome formatter"
```

---

## Task 10: ESLint + Oxlint 設定

**Files:**
- Modify: `package.json` (devDependencies, scripts)
- Create: `oxlintrc.json`
- Create: `eslint.config.mjs`

- [ ] **Step 10.1: oxlint を追加**

Run: `pnpm add -D -w oxlint@1.57.0`
Expected: `Done`。

- [ ] **Step 10.2: ESLint と plugin 群を追加**

Run: `pnpm add -D -w eslint@10.1.0 typescript-eslint@8.57.2 eslint-plugin-import-x@4.16.2 eslint-plugin-sonarjs@4.0.2 eslint-plugin-oxlint@1.57.0 @eslint-community/eslint-plugin-eslint-comments@4.7.1`
Expected: `Done`、6件追加。

- [ ] **Step 10.3: `oxlintrc.json` を作成**

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

- [ ] **Step 10.4: `eslint.config.mjs` を作成**

```js
import eslintComments from '@eslint-community/eslint-plugin-eslint-comments/configs';
import importX from 'eslint-plugin-import-x';
import oxlint from 'eslint-plugin-oxlint';
import sonarjs from 'eslint-plugin-sonarjs';
import tseslint from 'typescript-eslint';
import strictTypes from '@9wick/eslint-plugin-strict-type-rules';

export default tseslint.config(
  {
    ignores: ['**/node_modules', '**/dist', '**/.nx', '**/*.d.ts'],
  },
  tseslint.configs.recommended,
  ...oxlint.configs['flat/all'],
  eslintComments.recommended,
  {
    plugins: { 'import-x': importX, sonarjs },
  },
  ...strictTypes.configs.recommended,
  ...strictTypes.configs.test,
  ...strictTypes.configs.barrel,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    ignores: ['**/*.test.{ts,tsx}', 'examples/**/*.{ts,tsx}'],
    rules: {
      complexity: ['error', { max: 7 }],
      'sonarjs/cognitive-complexity': 'error',
      'no-console': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      'max-lines': ['warn', { max: 500, skipBlankLines: true, skipComments: true }],
      'import-x/no-cycle': 'error',
      'import-x/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          'newlines-between': 'always',
        },
      ],
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unnecessary-condition': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
    },
  },
  {
    files: ['**/*.test.{ts,tsx}'],
    rules: {
      'no-console': 'off',
      'max-lines': ['warn', { max: 1000, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    files: ['examples/**/*.{ts,tsx}'],
    rules: {
      'no-console': 'off',
    },
  },
);
```

- [ ] **Step 10.5: ルート scripts に lint / lint:fix を追加**

```json
"lint": "eslint . && oxlint .",
"lint:fix": "eslint . --fix && oxlint . --fix"
```

- [ ] **Step 10.6: lint 動作確認**

Run: `pnpm lint`
Expected: エラーなし、warning 数件以下。

もし `import-x/order` でエラーが出たら：Run `pnpm lint:fix` で自動修正。

- [ ] **Step 10.7: Commit (ユーザー指示時のみ)**

```bash
git add package.json pnpm-lock.yaml oxlintrc.json eslint.config.mjs
git commit -m "chore: add eslint and oxlint configs"
```

---

## Task 11: Knip 設定

**Files:**
- Modify: `package.json` (devDependencies, scripts)
- Create: `knip.config.ts`

- [ ] **Step 11.1: knip を追加**

Run: `pnpm add -D -w knip@6.1.0`
Expected: `Done`。

- [ ] **Step 11.2: `knip.config.ts` を作成**

```ts
import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  workspaces: {
    'packages/core': {
      entry: ['src/index.ts', 'src/workers.ts', 'src/lambda.ts'],
    },
    'packages/testing': {
      entry: ['src/index.ts'],
    },
    'packages/adapter-node': {
      entry: ['src/index.ts'],
    },
  },
  ignoreDependencies: ['nx', 'typescript'],
};

export default config;
```

- [ ] **Step 11.3: ルート scripts に knip を追加**

```json
"knip": "knip"
```

- [ ] **Step 11.4: knip 実行で動作確認**

Run: `pnpm knip`
Expected: 未使用依存・未使用ファイル の検出ゼロ。`No issues found.` 相当の出力。

もし未使用が報告されたら、それが正当な指摘か確認し、`knip.config.ts` の `ignoreDependencies` に追加するか、不要な依存を削除する。

- [ ] **Step 11.5: Commit (ユーザー指示時のみ)**

```bash
git add package.json pnpm-lock.yaml knip.config.ts
git commit -m "chore: add knip"
```

---

## Task 12: Git Hooks (prepush-hash)

**Files:**
- Create: `.githooks/pre-commit`
- Create: `.githooks/prepare-commit-msg`
- Modify: `package.json` (scripts.prepush, scripts.prepare)

- [ ] **Step 12.1: `.githooks` ディレクトリを作成し `pre-commit` を作成**

Run: `mkdir -p .githooks`

`.githooks/pre-commit`:
```bash
#!/usr/bin/env bash
set -euo pipefail
npx prepush-hash check
```

- [ ] **Step 12.2: `.githooks/prepare-commit-msg` を作成**

`.githooks/prepare-commit-msg`:
```bash
#!/usr/bin/env bash
set -euo pipefail
npx prepush-hash verify-footer "$1" "${2:-}"
```

- [ ] **Step 12.3: hooks に実行権限を付与**

Run: `chmod +x .githooks/pre-commit .githooks/prepare-commit-msg`
Expected: エラーなし。

- [ ] **Step 12.4: ルート scripts に prepush と prepare を追加**

```json
"prepush": "pnpm format:check && pnpm typecheck && pnpm lint && pnpm build && pnpm test && npx prepush-hash save",
"prepare": "git config core.hooksPath .githooks"
```

- [ ] **Step 12.5: prepare を発火させて hooks を有効化**

Run: `pnpm prepare`
Expected: エラーなし。`git config core.hooksPath` で `.githooks` が設定される。

確認: `git config core.hooksPath`
Expected: `.githooks`

- [ ] **Step 12.6: prepush 全体実行**

Run: `pnpm prepush`
Expected: format:check → typecheck → lint → build → test → prepush-hash save がすべて通る。最後に `prepush-hash: saved <hash>` のような出力。

- [ ] **Step 12.7: prepush-hash check 単体確認**

Run: `npx prepush-hash check`
Expected: `prepush-hash: verified ✓ (<hash>)`

- [ ] **Step 12.8: Commit (ユーザー指示時のみ)**

```bash
git add package.json pnpm-lock.yaml .githooks
git commit -m "chore: add git hooks for prepush-hash"
```

---

## Task 13: GitHub Actions CI

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 13.1: `.github/workflows` ディレクトリを作成**

Run: `mkdir -p .github/workflows`

- [ ] **Step 13.2: `ci.yml` を作成**

`@9wick/eslint-plugin-strict-type-rules` を `git+ssh` で参照しているため、CI には deploy key 経由の SSH agent setup が必要。これは semlint の CI で実証済みのパターン (`webfactory/ssh-agent@v0.9.0` + secret)。

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup SSH for private dependencies
        uses: webfactory/ssh-agent@v0.9.0
        with:
          ssh-private-key: ${{ secrets.DEPLOY_PRIVATE_KEY_FOR_9WICK_ESLINT_RULES }}

      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Format check
        run: pnpm format:check

      - name: Typecheck
        run: pnpm typecheck

      - name: Lint
        run: pnpm lint

      - name: Build
        run: pnpm build

      - name: Test
        run: pnpm test

      - name: Knip
        run: pnpm knip

      - name: Check for uncommitted changes
        run: |
          if [ -n "$(git status --porcelain)" ]; then
            echo "Uncommitted changes detected:"
            git status
            git diff
            exit 1
          fi
```

**注意**: GitHub repository に secret `DEPLOY_PRIVATE_KEY_FOR_9WICK_ESLINT_RULES` を登録する必要がある。`9wick/eslint-strict-type-rules` repository に deploy key を登録し、その private key を本 repository の Actions secret として設定する手順は実装フェーズで実施。詳細は semlint の `.github/workflows/ci.yml` 参照。

- [ ] **Step 13.3: ローカルで yaml syntax 確認**

Run: `node -e "import('js-yaml').then(y => y.default.load(require('fs').readFileSync('.github/workflows/ci.yml','utf-8')))"` (js-yaml が無ければ次の代替で確認)

代替: 構文の見た目で確認（インデント、コロン、quote）。CI が実際走るのは push 後。

- [ ] **Step 13.4: Commit (ユーザー指示時のみ)**

```bash
git add .github
git commit -m "ci: add github actions workflow"
```

---

## Task 14: ドキュメント・LICENSE・プレースホルダ・最終確認

**Files:**
- Create: `LICENSE`
- Create: `README.md`
- Create: `docs/.gitkeep`
- Create: `plans/.gitkeep`
- Create: `examples/.gitkeep`

- [ ] **Step 14.1: `LICENSE` を作成（MIT）**

```
MIT License

Copyright (c) 2026 9wick / Kohei Kido

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 14.2: `README.md` を作成**

```markdown
# koya

> Edge/serverless 時代のための、Laravel/FuelPHP 的な型安全 TypeScript アプリケーションフレームワーク。
>
> A fast, type-safe application framework for TypeScript, bringing Laravel/FuelPHP-like productivity to edge and serverless runtimes.

## Core values

- **Fast** — Cloudflare Workers / serverless cold start で実用的な起動・実行速度
- **Type-safe** — schema → request → controller → response → DI → test double が同一の型契約でつながる
- **Application-oriented** — controller / service / repository / config / lifecycle / error handling / testing / CLI/worker を統合した「アプリケーションの骨格」を提供

## Status

**pre-alpha**. 0.x の間は minor で破壊的変更を許容します。

## Packages

- `@koya/core` — DI / lifecycle / validation / error / HTTP の中核
- `@koya/adapter-node` — Node.js 用 listen
- `@koya/testing` — テストユーティリティ

Workers / Lambda 用アダプタは `@koya/core` の subpath (`@koya/core/workers`, `@koya/core/lambda`) として提供予定です。

## License

MIT
```

- [ ] **Step 14.3: プレースホルダの `.gitkeep` を作成**

Run: `mkdir -p docs plans examples && touch docs/.gitkeep plans/.gitkeep examples/.gitkeep`

- [ ] **Step 14.4: 最終的な prepush 全体確認**

Run: `pnpm prepush`
Expected: format:check → typecheck → lint → build → test → prepush-hash save がすべて通る。

- [ ] **Step 14.5: 全体の git status を確認**

Run: `git status`
Expected: untracked / modified の一覧が表示され、不要なファイル（`dist/`, `node_modules/`, `.nx/`, `*.tsbuildinfo`, `.git/prepush-hash`）が含まれていないこと（`.gitignore` で除外済み）。

- [ ] **Step 14.6: コミットメッセージのフッタが付くか確認**

`git commit -m "test: prepush hook check"` を試みる前に、まず `prepare-commit-msg` hook が動くか確認するために、ステージングして commit を試みる準備：

Run: `git add . && git status`
Expected: 大量のファイルが staged として表示される。

実際の commit はユーザー指示まで保留。ただし、もしユーザーがここで commit を許可した場合、`Verified: prepush ✓ (<hash>)` フッタが自動的に付くこと、`pre-commit` hook で `prepush-hash check` が通ること、を確認する。

- [ ] **Step 14.7: 最終 Commit (ユーザー指示時のみ)**

```bash
git add LICENSE README.md docs plans examples
git commit -m "docs: add LICENSE, README, and placeholder dirs"
```

すべてのコミットを統合して push する場合は、ユーザーに確認してから：

```bash
git push -u origin main
```

---

## 完了条件

すべてのタスクが完了し、以下が成立すること：

- [ ] `pnpm install` がエラーなしで完了する
- [ ] `pnpm typecheck` がエラーなしで完了する（3 パッケージで composite ビルド）
- [ ] `pnpm build` がエラーなしで完了し、各 `packages/*/dist/` に成果物がある
- [ ] `pnpm test` で 6 tests (`@koya/core` で 4、`@koya/testing` で 1、`@koya/adapter-node` で 1) すべて pass し、`@koya/core` のテストが `@koya/testing` の `__version` を import できている (workspace dogfood 確認)
- [ ] `pnpm format:check` がエラーなしで完了する
- [ ] `pnpm lint` がエラーなしで完了する
- [ ] `pnpm knip` で issue ゼロ
- [ ] `pnpm prepush` がエラーなしで完了し、`.git/prepush-hash` が更新される
- [ ] `npx prepush-hash check` が verified ✓ を返す
- [ ] `git config core.hooksPath` が `.githooks` を返す
- [ ] `package.json` 群（root + packages 全て）の `dependencies` / `devDependencies` / `optionalDependencies` に caret/tilde/x 付きのバージョンが無い（Step 7.5 の検査スクリプトで `All exact versions ✓` を返す）

---

## 実装フェーズで spec を更新する可能性のある項目

- npm scope `@koya` が占有されていた場合 → spec の package 名を変更し、本プランも追従
- `hono` または `@hono/node-server` の最新版が大きく変わっていた場合 → spec の表記を最新化
- ESLint v10 と `@9wick/eslint-plugin-strict-type-rules` の peer 不整合で実害が出た場合 → spec の ESLint バージョン方針を変更

これらに該当する場合は、対応を spec/plan 双方に反映してから実装を進める。
