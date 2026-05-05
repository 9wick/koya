# koya Phase 2 (2): API Contract (AppType + OpenAPI)

> Phase 2 (1) で確立した `createHttpApp({ controllers })` と並列に、**`generateClient({ controllers, dist })`** を build step として導入する。同じ controllers list を runtime (`createHttpApp`) と build step (`generateClient`) の両方に渡すことで、API contract (AppType + OpenAPI) を type-safe に確立する。
>
> 本 spec は `@koya/contract` package（`generateClient` programmatic API + CLI + 型関数）と `@koya/core` の `response()` primitive 追加を対象とし、(3) Error handling / (4) Testing utility / (5) Lifecycle hook は別 phase で扱う。

## 1. ゴール

handler のコードから build 時に 2 つの output を生成し、API contract を type-safe に確立する。

| output | 用途 |
|---|---|
| **AppType** (TypeScript 型 file) | hono の `hc<AppType>()` で client が型推論する。server / client 間で API 契約を TS 型として共有 |
| **OpenAPI document** (JSON) | 言語横断の API spec、SDK 生成、Swagger UI 等に投入 |

両 output は **同じ AST 解析機構**から派生する。利用者は handler を書くだけで、build step が自動的に両 output を生成する。

### 中核原則

- **controller class を直接指定**: build step は controllers list を programmatic API / config から **直接受け取る**。entry file 検索などの暗黙的な仕掛けを持たない
- **Scramble 流静的解析**: handler のソースコードから AST + TS Compiler API で抽出。利用者は OpenAPI 用注釈を書かない（zero-annotation）
- **hono client 互換**: 独自 RPC client を作らず、hono の `hc<AppType>` をそのまま借りる
- **責務分離 primitive**: request 系 (`validated`, `pathParam`) と response 系 (`response()`) を引数 default で型レベル分離
- **hono Context 隠蔽維持**: 利用者は `c` に直接触れない。response 制御は `ResponseBuilder` 経由
- **最小限 codegen + 型参照**: 生成 file は path/method/controller 参照のみ、handler signature 変更は型推論で自動追従

---

## 2. 概念モデル

### 2.1 API Contract

handler の入出力 schema 集合体。input は **`generateClient({ controllers, dist })` に直接渡された controllers list**。各 controller class について以下 3 つの source から導出する：

| source | 抽出方法 |
|---|---|
| path / method | `@Get('/users/:id')` 等 decorator 引数を AST から抽出 |
| request schema | `validated(SchemaIdent)` の Ident を AST で resolve、valibot schema 値を取り出す |
| response 型 | handler 戻り値型を `ts-morph` (TS Compiler API) で解決、TS named type / anonymous / `TypedResponse<T, S>` を識別 |

これを集約した中間表現 (Internal Representation) を 2 系統に出力：

- **`<dist>/app.gen.ts`** (TypeScript 型 file) — hono `hc` 互換の `AppType` 構造を export
- **`<dist>/openapi.json`** — OpenAPI 3.x document

`generateClient` は 1 回の呼び出しで 1 set の output を作る。複数の app contract を持ちたい場合は `generateClient` を複数回呼ぶ（別々の controllers / dist 指定）。

### 2.2 ResponseBuilder

`response()` primitive が返す koya 独自 type。実体は AsyncLocalStorage 経由で hono Context の response method (`c.json` / `c.redirect` / `c.text` / `c.body` / `c.header`) を bypass で呼ぶ。戻り値型は hono の `TypedResponse<T, S, F>` で、AppType / OpenAPI 解析対象。

利用者は `c` 全体に触れない。`c.req.valid` / `c.req.param` 等の **request 系 method には型レベルで到達できない**。これにより責務分離が型レベルで強制される。

---

## 3. 技術スタック

| レイヤ | 採用 | バージョン |
|---|---|---|
| TS 型解決 | `ts-morph` | latest stable |
| valibot → JSON Schema | `@valibot/to-json-schema` | latest stable |
| TS 型 → JSON Schema | `ts-json-schema-generator` | latest stable |
| watch mode | `chokidar` | latest stable |
| CLI parser | `cac` | latest stable |
| RPC client | hono の `hono/client` (`hc<AppType>`) | 既存依存 (4.12.16) |

実装開始時に exact version を確定（CLAUDE.md ルール: `module@x.y.z`）。

### 採用しないもの

- **独自 RPC client** — hono の `hc` を借りる。利用者は `import { hc } from 'hono/client'`
- **TypeScript transformer (typia / nestia 流)** — koya の oxc/tsdown チェーンに組み込みづらい、valibot と世界観が競合
- **tsoa** — controller 規約が衝突、内部 type resolver が独立 export されていない
- **TSDoc / JSDoc override** (`@returns {Type}` / `@status 201`) — Scramble の zero-annotation 思想を維持。型で表現できないケースは型を直す or escape hatch (`Response` 直接) を使う

---

## 4. 設計上の重要な判断

### 4.1 hono client (`hc<AppType>`) を直接利用

koya は **独自 RPC client を実装しない**。利用者は hono の `hc` を直接 import する：

```ts
import { hc } from 'hono/client'
import type { AppType } from 'server/dist/app.gen'

const client = hc<AppType>('https://api.example.com')
const user = await client.users[':id'].$get({ param: { id: '1' } })
```

理由：
- hono の `hc` は成熟しており、再発明する利益がない
- AppType 構造を hono 互換にすれば、koya は contract 生成だけ担当すれば良い
- ecosystem 利益 (hono client を使う既存ノウハウが流用できる)

spec §4.1 (Phase 2 (1)) の「hono 隠蔽」は **server 側のみ** 維持。client 側で hono を露出することは許容（§8 で更新）。

### 4.2 build step は「最小限 codegen + 型参照」hybrid

生成 file の中身は **handler のロジックを転記しない**。path / method / controller 参照のみ書き、handler signature は `typeof Controller.prototype.method` で型参照する：

```ts
// app.gen.ts (build step が出力)
import type { Route, BuildAppType } from '@koya/contract'
import type { UserController } from '../src/user.controller'
import type { PostController } from '../src/post.controller'

export type AppType = BuildAppType<[
  Route<'GET',    '/users',          typeof UserController.prototype.list>,
  Route<'GET',    '/users/:id',      typeof UserController.prototype.show>,
  Route<'POST',   '/users',          typeof UserController.prototype.create>,
  Route<'PUT',    '/users/:id',      typeof UserController.prototype.update>,
  Route<'DELETE', '/users/:id',      typeof UserController.prototype.destroy>,
  Route<'GET',    '/posts',          typeof PostController.prototype.list>,
]>
```

| 変更内容 | 再生成必要？ |
|---|---|
| handler 内部実装変更 (ロジックだけ) | **不要** |
| handler 戻り値型変更 (schema 構造変更) | **不要** — `ReturnType<typeof ...>` で自動追従 |
| handler 引数 default 変更 (schema 差し替え) | **不要** — `Parameters<typeof ...>` で自動追従 |
| handler 追加 / 削除 | **必要** — Route<...> 行の増減 |
| path 文字列変更 | **必要** — literal を書き換え |
| method 変更 (GET → POST) | **必要** — literal を書き換え |
| Controller 追加 / 削除 | **必要** — import 行と Route 行の増減 |

「再生成必要」のケースは **watch mode** で吸収。

`Route<M, P, H>` / `BuildAppType<...>` は `@koya/contract` が export する型関数。handler signature `H` から path params / request body / response 型を抽出し、hono `hc` 互換の構造に畳み込む。

### 4.3 handler 戻り値は hono 互換すべて許容、contract に乗るのは return のみ

koya の handler 戻り値は **hono が受け付ける形をすべて許容**。「hono が NG なら koya も NG」「hono が OK なら koya も OK」。**contract (AppType / OpenAPI) に乗るのは `return` した response のみ**。throw された error は **runtime error handling** の領域で、contract には乗らない（hono RPC の流儀そのまま）。

| 戻り値 / 例外 | hono 受付 | koya 受付 | AppType / OpenAPI |
|---|---|---|---|
| 素データ `T` (`return user`) | ❌ (hono 標準は明示 `c.json` 等が必要) | ✅ **koya 独自拡張** — internal route-builder が `c.json(T, 200)` で wrap | ✅ 200 + body: T |
| `TypedResponse<T, S, F>` (`return res.json(data, S)` / `return res.redirect(url, S)` 等) | ✅ | ✅ | ✅ status / body 抽出して登録 |
| `TypedResponse<E, 4xx>` (`return res.json(errorBody, 400)` の **明示 error return**) | ✅ | ✅ | ✅ 4xx + body: E、client は `if (res.status === 200) {...} else {...}` で **type narrowing 可能** |
| `Response` (Web standard) | ✅ | ✅ | ❌ **omit + warning** (型情報なし) |
| `Promise<...>` | ✅ | ✅ | await して上記いずれか |
| `throw new HTTPException(status, ...)` | ✅ | ✅ | ❌ **乗らない** — runtime の global error handler が `KoyaErrorSchema` 形式で response 化（Phase 2 (3) で確定）。AST での throw 検出は再帰追跡が必要で現実的でないため採らない |
| `throw new Error(...)` (予期せぬ) | ✅ | ✅ | ❌ **乗らない** — global handler が 500 + `KoyaErrorSchema` 形式で response 化 |
| **`validated(SchemaIdent)` の validation 失敗 (内部で throw される `ValiError`)** | ✅ | ✅ | ✅ **`Route<M, P, H>` 型関数が handler 引数 default の `validated()` 存在を検出して 400 + `ValidationErrorBody` を response union に自動追加**。AST 追跡ではなく型計算で完結（特殊扱い） |

**素データ return** だけが koya 独自の挙動。それ以外は hono のまま。**`validated()` の validation error だけは throw 経由でも contract に乗る** — handler signature から型計算で静的に検出可能なため。一般の throw（HTTPException 等）は AST 追跡不可で contract には乗らない。

#### error response の利用者ガイダンス

| 意図 | 書き方 |
|---|---|
| **client で error を type-safe に分岐したい**（status / body 型を hc で narrow） | `return res.json({ error: 'not_found', message: '...' }, 404)` のように **明示 return** |
| **エラー処理を中央集権化したい / 楽したい** | `throw new HTTPException(404, { message: '...' })`、global handler が共通 `KoyaErrorSchema` 形式で response 化 |

両者は共存可能。同じ handler 内で `throw` と `return res.json(errorBody, status)` を混在させても良い（return が contract に乗り、throw は runtime のみ）。

### 4.4 response 制御は `response()` primitive 経由

利用者が hono の `c` 全体に触れる設計は採らない。代わりに `response()` primitive が返す `ResponseBuilder` 経由で response 制御 method のみ提供：

```ts
type ResponseBuilder = {
  json<T, S extends number = 200>(
    data: T, status?: S, headers?: Record<string, string>
  ): TypedResponse<T, S, 'json'>
  
  redirect<S extends 301 | 302 | 303 | 307 | 308 = 302>(
    url: string, status?: S
  ): TypedResponse<undefined, S, 'redirect'>
  
  text<T extends string, S extends number = 200>(
    data: T, status?: S
  ): TypedResponse<T, S, 'text'>
  
  body<T extends BodyInit, S extends number = 200>(
    data: T, status?: S
  ): TypedResponse<T, S, 'body'>
  
  header(name: string, value: string): ResponseBuilder  // chainable
}
```

実装は AsyncLocalStorage で hono Context を取り、各 method を bypass：

```ts
export function response(): ResponseBuilder {
  const ctx = entryStorage.getStore()
  if (!ctx) throw new Error('response() called outside entry execution')
  const c = ctx.honoContext
  const builder: ResponseBuilder = {
    json: (data, status, headers) => c.json(data, status, headers),
    redirect: (url, status) => c.redirect(url, status),
    text: (data, status) => c.text(data, status),
    body: (data, status) => c.body(data, status),
    header: (name, value) => { c.header(name, value); return builder },
  }
  return builder
}
```

**型は koya 独自、実装は hono bypass** のパターン。利用者から見える API surface は `ResponseBuilder` の 5 つの method のみ。`c.req.*` / `c.env` / `c.var` / `c.set` 等の request / context-dependent method は **型レベルで到達不可**。

### 4.5 named type → ref / anonymous → inline

JSON Schema 化のルール（input / output 共通）：

| 入力 | 出力 |
|---|---|
| TS named type alias (`type User = ...`) | `components/schemas/User` + `$ref` |
| TS anonymous type (`{ id: string; name: string }`) | inline schema |
| valibot named identifier (`validated(CreateUserBody)`) | `components/schemas/CreateUserBody` + `$ref` |
| valibot inline (`validated(v.object({...}))`) | inline schema |
| 解決不能 (`unknown` / `any` / dynamic schema) | **build error** |

named 型が他の named 型を参照する場合は **再帰的に追跡** して components に積む。

### 4.6 同名ペアは best practice 推奨（強制ではない）

valibot schema (value) と TS type alias を **同名ペア** で書くと、`components/schemas/<Name>` に collapse できる：

```ts
// 推奨パターン
export const User = v.object({
  id: v.string(),
  name: v.string(),
})
export type User = v.InferOutput<typeof User>
```

これは valibot / zod 一般の best practice（Zod の `z.infer<typeof X>` と同じ作法）。koya では：
- 同名ペアの場合 → `components/schemas/User` に単一登録、request / response 両方から `$ref`
- 別名の場合 → 別 entry として登録（意図的に別形なら正しい挙動）

**強制ではない**。違っても build は通る。

### 4.7 推論不可は build error（厳格）

response 型の解決が以下の場合は build error：

- 戻り値型が `unknown` / `any`
- TS Compiler API で型解決失敗（generic overload 不確定 等）
- valibot schema が runtime で動的構築されている（`v.object({}).extend(...)` を変数経由 等で AST から追えない）
- `validated(SchemaIdent)` の `SchemaIdent` が module top-level export を辿れない（handler-local 定義 等）

build error message には **直し方の hint** を含める：「型注釈を足す」「schema を export する」「inline で書き直す」「`response()` の `res.body(...)` で escape」のいずれか。

### 4.8 TSDoc / JSDoc override は採らない（negative spec）

`@returns {Type}` / `@response 201 SomeType` のような JSDoc tag による override は **採用しない**。理由：
- 型と注釈の二重ソース化を避ける（class-validator + reflect-metadata の二重定義問題と同じ）
- 推論不可ケースは型を直して解決する（spec §4.7）
- Scramble の zero-annotation 思想を維持

将来も追加しない方針として spec §10 に negative decision として記録する。

### 4.9 input は controllers list を直接受け取る

build step (`generateClient`) は controllers list を **直接 programmatic API で受け取る**。entry file の AST 解析 / `createHttpApp` 呼び出し検索などの暗黙的な仕掛けは持たない：

```ts
// programmatic API
import { generateClient } from '@koya/contract'
import { UserController } from './src/user.controller'
import { PostController } from './src/post.controller'

await generateClient({
  controllers: [UserController, PostController],
  dist: './generated',
})
```

CLI 経由で呼び出す場合は config file (`koya.config.ts` 等) を介して同じ呼び出しを行う（§6.1）。

制約：
- `controllers` の値は **identifier reference の array literal**（programmatic API の TypeScript 型として `readonly Class[]`）。`spread` / `条件分岐` で動的構築するパターンは AST 解析対象外なので使えない（lint で warning、または build error）
- 各 identifier は import 経由で TypeScript 上 class として解決可能であること

`createHttpApp({ controllers })` (runtime) と `generateClient({ controllers, dist })` (build step) は **同じ controllers list を渡す** ことで API contract を確立する。利用者は controllers を別 file (`controllers.ts`) にまとめて両方から import すれば DRY を保てる：

```ts
// src/controllers.ts
export const controllers = [UserController, PostController]

// entries/http.ts (runtime)
import { createHttpApp } from '@koya/core'
import { controllers } from '../controllers'
export default createHttpApp({ controllers }).toWorker()

// koya.config.ts (build step)
import { defineConfig } from '@koya/contract'
import { controllers } from './src/controllers'
export default defineConfig({ controllers, dist: './generated' })
```

将来 (`§9.3`) glob パターン（`controllers: ['./src/controllers/**/*.ts']`）対応を `createHttpApp` / `generateClient` 両方に追加可能だが、MVP では具体 identifier list のみ。

### 4.10 出力 file は commit する

build step が生成する `app.gen.ts` は **gitignore せず commit する**。理由：

- 生成 file が type の source である（client 側 import 対象）
- PR review で contract の変化を検知できる（diff レビュー）
- CI 上で「`build` 後に `app.gen.ts` が変化しないこと」を check する gate を後付けできる
- gitignore して dev だけで生成すると、CI / 別環境での型ミスが見えなくなる

`openapi.json` も同様に commit。

---

## 5. ユーザー向け API

### 5.1 既存 primitive (Phase 2 (1) から継承)

| primitive | 用途 | 引数 default 位置 | 戻り値型 |
|---|---|---|---|
| `inject(Class)` | DI コンテナから取得 | constructor | `Class` のインスタンス型 |
| `validated(schema)` | request body を validate | method | `InferOutput<typeof schema>` |
| `pathParam(name)` | URL path parameter | method | `string` |

### 5.2 新規 primitive

| primitive | 用途 | 引数 default 位置 | 戻り値型 |
|---|---|---|---|
| **`response()`** | response builder 取得 | method | `ResponseBuilder` |

### 5.3 handler 戻り値パターン

```ts
import { Controller, Post, Get, validated, pathParam, response } from '@koya/core'
import { HTTPException } from '@koya/core'  // hono の re-export
import * as v from 'valibot'

export const CreateUserBody = v.object({
  name: v.string(),
  email: v.string(),
})
export type CreateUserBody = v.InferOutput<typeof CreateUserBody>

export const User = v.object({
  id: v.string(),
  name: v.string(),
  email: v.string(),
})
export type User = v.InferOutput<typeof User>

@Controller('/users')
export class UserController {
  constructor(private users = inject(Users)) {}

  // 素データ return → 200 OK 固定
  @Get('/:id')
  async show(id = pathParam('id')): Promise<User> {
    const user = await this.users.find(id)
    if (!user) throw new HTTPException(404, { message: 'not found' })
    return user
  }

  // res.json で 201 Created
  @Post('/')
  async create(body = validated(CreateUserBody), res = response()) {
    const user = await this.users.create(body)
    return res.json(user, 201)  // TypedResponse<User, 201, 'json'>
  }

  // res.redirect で 3xx
  @Get('/old')
  async oldRoute(res = response()) {
    return res.redirect('/new', 301)
  }

  // res.body で raw response
  @Get('/file')
  async download(res = response()) {
    const blob = await this.files.fetch()
    return res.header('Content-Type', 'application/pdf').body(blob)
  }
}
```

### 5.4 client 利用（hono `hc`）

```ts
import { hc } from 'hono/client'
import type { AppType } from 'server/dist/app.gen'  // build step が生成

const client = hc<AppType>('https://api.example.com')

// 型推論される
const res = await client.users[':id'].$get({ param: { id: '1' } })
const user = await res.json()  // User 型

const created = await client.users.$post({ json: { name: 'foo', email: 'foo@example.com' } })
//   ↑ request body は CreateUserBody 型でチェック
const newUser = await created.json()  // status 201 で User 型
```

---

## 6. build step

### 6.1 起動形式

利用者は 2 通りの呼び出し方を選べる：

#### (a) Programmatic API

```ts
import { generateClient } from '@koya/contract'

await generateClient({
  controllers: [UserController, PostController],
  dist: './generated',
})
```

option:

| field | 必須 | default | 用途 |
|---|---|---|---|
| `controllers` | ✅ | — | controller class array |
| `dist` | ✅ | — | 出力先 directory（`<dist>/app.gen.ts` / `<dist>/openapi.json`） |
| `watch` | — | `false` | watch mode 有効化 |

#### (b) CLI + config file

```bash
npx koya-contract build           # ./koya.config.ts を auto-detect
npx koya-contract build -c <path> # 任意の config を指定
npx koya-contract watch           # watch mode
npx koya-contract --help
```

config file (`koya.config.ts`):

```ts
import { defineConfig } from '@koya/contract'
import { UserController } from './src/user.controller'
import { PostController } from './src/post.controller'

export default defineConfig({
  controllers: [UserController, PostController],
  dist: './generated',
})
```

CLI parser は `cac` を使用。`defineConfig` は型支援用の identity 関数（`<T extends GenerateClientOptions>(c: T) => T`）。

複数の app contract を定義したい場合：
- programmatic: `generateClient` を複数回呼ぶ
- CLI: config file の default export を **配列にする** ことで複数 contract を一度に build（将来）。MVP では 1 config = 1 contract のみ

### 6.2 処理パイプライン

```
[GenerateClientOptions: { controllers, dist }]
  ↓ (load each controller's source file with ts-morph)
[controller class source files]
  ↓ (extract decorators + method signatures)
[Internal Representation: { method, path, params, requestSchema, responseType }[]]
  ↓
  ├→ [emit <dist>/app.gen.ts]   (Route<...> + BuildAppType<...>)
  └→ [emit <dist>/openapi.json]
       ↓ (per route)
       ├→ resolve request body schema (valibot → @valibot/to-json-schema)
       ├→ resolve response type (TS → ts-json-schema-generator)
       ├→ register named types into components/schemas
       └→ assemble paths / operations / components
```

CLI 経由の場合、config file を読み込んで `GenerateClientOptions` を取り出してから上記パイプラインを実行する：

```
[koya.config.ts path]
  ↓ (import config, get default export)
[GenerateClientOptions]
  ↓ (上記パイプライン)
```

### 6.3 watch mode

`chokidar` で以下を監視：

- 各 controller class の source file
- それらが import している file（depth: 全部、schema 定義 file 等が含まれる）
- CLI の場合は config file 自体も監視
- 変更検知で全 pipeline を再実行
- 出力 file (`<dist>/app.gen.ts` / `<dist>/openapi.json`) が **変化した時のみ** disk write（diff チェック）

dev 体験：build step を background で起動 → handler / schema を編集 → 自動的に出力 file が更新 → IDE が re-typecheck → client コードが新しい型で動く。

### 6.4 OpenAPI 出力フォーマット

- OpenAPI 3.1 を default
- `--openapi-version 3.0` で 3.0 に切り替え可能（将来拡張）
- **error response の自動登録は行わない**（§4.3）。利用者が `return res.json(errorBody, 4xx)` で明示 return した response のみ OpenAPI に乗る
- throw された `HTTPException` は AST で追跡せず、OpenAPI には登録されない（runtime のみ）。利用者が contract に error response を載せたい場合は明示 return を使う
- runtime の global error handler が返す `KoyaErrorSchema` 形式の response 自体は Phase 2 (3) で確定（spec / 実装は本 phase スコープ外）

---

## 7. 型関数

### 7.1 `Route<M, P, H>`

```ts
export type Route<
  M extends string,
  P extends string,
  H extends (...args: never[]) => unknown
> = {
  readonly method: M
  readonly path: P
  readonly params: ExtractPathParams<P>
  readonly body: ExtractRequestBody<H>
  readonly response: ExtractResponse<H> | ExtractValidationErrors<H>
  //                                        ↑ handler 引数 default に validated() があれば
  //                                        TypedResponse<ValidationErrorBody, 400, 'json'> を union 追加
}
```

`response` field が `ExtractResponse<H>` (handler 戻り値型) と `ExtractValidationErrors<H>` (validation 失敗時 400) の union になる。`hc<AppType>` client 側では status による narrowing が可能。

### 7.2 `BuildAppType<Routes>`

```ts
export type BuildAppType<Routes extends readonly Route<string, string, never>[]> =
  // Routes を hono の AppType 互換構造に畳み込む
  // hono の hc が require する型 shape：
  // { [Path]: { $get: { input: ..., output: ... }, $post: { ... } } }
```

具体的な実装は Phase 2 (2) plan の中で書く（hono の `hono/hono-base.d.ts` の AppType shape を参照）。

### 7.3 抽出ユーティリティ

| 型関数 | 用途 |
|---|---|
| `ExtractPathParams<P>` | path string `'/users/:id'` から `{ id: string }` を導出 |
| `ExtractRequestBody<H>` | handler の引数 default で `validated(...)` の戻り値型を抽出 |
| `ExtractResponse<H>` | handler の戻り値型から `Awaited<ReturnType<H>>` を取り、`TypedResponse<T, S, F>` を分解して status 別に分類 |
| `ExtractValidationErrors<H>` | handler 引数 default に `validated()` の戻り値が **1 つでもあれば** `TypedResponse<ValidationErrorBody, 400, 'json'>` を返す。なければ `never` |

`ValidationErrorBody` は `@koya/core` で valibot 定義（Phase 2 (3) で `KoyaErrorSchema` の variant として確定、MVP では `{ error: 'validation_failed', issues: ValiIssue[] }` 形式）。`@koya/contract` は `@koya/core` から型として import する。

---

## 8. spec §4.1 (Phase 2 (1)) 更新

Phase 2 (1) spec の §4.1 を以下に更新する：

> **(更新後 §4.1)** ユーザーが書くのは Entry クラスと Provider。Hono の `Context` には **直接触らせない**。response 制御は `response()` primitive の戻す **`ResponseBuilder`** を経由する。
>
> 公開 API として `hono.Context` / `Hono` クラス本体 / `@needle-di/core.Container` 等は引き続き露出してはならない。`ResponseBuilder` の戻り値型 `TypedResponse<T, S, F>` は hono 由来の型だが、利用者は **そのまま return する** だけで触ることはなく、AppType の解析対象として使われる。
>
> client 側 (`hc<AppType>` を呼ぶ側) は hono の `hono/client` を **直接利用** する。これは server 側の隠蔽と独立した方針で、hono の成熟した RPC client 機構を再発明しないため。

比較表 (`docs/comparison/koya-vs-nestjs.md`) の RPC 行 / hono client 関連も更新が必要。

---

## 9. スコープ

### 9.1 MVP (Phase 2 (2)) に含めるもの

- `@koya/core` への `response()` primitive 追加
- `@koya/core` から `HTTPException` re-export（hono の `HTTPException` をそのまま、subclass なし）
- `@koya/contract` package 新規作成
  - 型関数: `Route<M, P, H>` / `BuildAppType<...>` / `ExtractPathParams` / `ExtractRequestBody` / `ExtractResponse`
  - build step CLI: `koya-contract build` / `watch`
  - AST 解析機構（共通基盤）
  - AppType 出力 (`app.gen.ts`)
  - OpenAPI 3.1 出力 (`openapi.json`)
  - watch mode (chokidar)
- examples/hello を Phase 2 (2) API でリライトし dogfood として動作確認
- example で `hc<AppType>` を呼ぶ e2e test（同 monorepo 内で型互換確認）
- example から `openapi.json` を生成、Swagger UI で手動確認

### 9.2 Phase 2 後続フェーズで扱うもの

| Phase | スコープ |
|---|---|
| (3) Error handling + Validation contract | runtime global error handler の挙動確定: `HTTPException` throw → status + `KoyaErrorSchema` 形式 response、generic Error → 500 + `KoyaErrorSchema`、`ValiError` → 400 + structured issues。`KoyaErrorSchema` は valibot で定義。OpenAPI / AppType への影響はなし（contract に error response を載せたい利用者は本 phase の `return res.json(errorBody, 4xx)` を使う） |
| (4) Testing utility | resolver override（依存差し替え）、request mocking、time/clock mock、in-memory database、HTTP fixture |
| (5) Lifecycle hook | startup hook (`onStart` 等) で外部リソース fail-fast 初期化 |

旧 Phase 2 (2) Error handling は (3) に番号が下がる。

### 9.3 当面採用しないもの (将来検討)

| 項目 | 理由 |
|---|---|
| controllers の **glob パターン指定** (`controllers: ['./src/controllers/**/*.ts']` 等) | `createHttpApp` / `generateClient` 両方に同時導入する形で将来追加。MVP では具体 identifier array のみ |
| `query()` / `header()` primitive | Phase 2 (1) 同様の引数 default primitive、HTTP 拡張時に追加 |
| GraphQL schema generation | 別 Entry 種別 (`@GraphQLResolver` 等) と resolver lifecycle 設計が必要、別 phase |
| OpenAPI 3.0 出力 | 3.1 を default、必要になれば `--openapi-version` で切り替え |
| operation summary / description (JSDoc 抽出) | best-effort で取る案はあるが MVP 不要 |
| tags / grouping (controller 名から自動) | 将来の OpenAPI 強化時 |
| security / authentication 表現 | guard 系 primitive 導入時 |
| response 例 / request 例 | testing fixture 連携時 |
| 複数 contract を 1 config で並列定義 (`defineConfig([...])`) | MVP では 1 config = 1 contract |
| dynamic controller list (`spread`, 条件分岐) | MVP では identifier array literal のみ |
| 動的 `validated()` schema (`v.object({}).extend(...)` 変数経由) | MVP では module top-level identifier reference のみ |

### 9.4 unsupported（やらない）

| 項目 | 理由 |
|---|---|
| TSDoc / JSDoc override (`@returns` / `@response` 等) | spec §4.8、Scramble zero-annotation 思想を維持、negative spec |
| 独自 RPC client | hono `hc` を再発明しない |
| `c` (hono Context) を handler に渡す | spec §4.4 / 8、責務分離を型で強制 |
| 関数 (`ok` / `created` / etc.) で status を表現 | hono の TypedResponse pattern (`res.json(data, 201)`) で十分、汎用名は他 lib (neverthrow 等) と衝突 |

---

## 10. 制約事項

### 10.1 build step の前提

- TypeScript 6.0+
- 各 controller class の source file 及び依存 file の TS 型解決が走る → typecheck が通る状態で実行する
- `ts-morph` / `ts-json-schema-generator` の依存を許容（dev dependency、runtime には影響なし）

### 10.2 利用者規約（強制 / 推奨）

| ルール | 強制 / 推奨 | 違反時 |
|---|---|---|
| `validated(SchemaIdent)` の `SchemaIdent` は module top-level export | **強制** | build error |
| `pathParam('name')` の引数は string literal | **強制** | build error |
| `generateClient({ controllers: [...] })` / `createHttpApp({ controllers: [...] })` の controllers は identifier array literal | **強制** | build error |
| handler 戻り値型が `unknown` / `any` | **強制** | build error |
| 同名ペア (`const X = v.object(...)` + `type X = v.InferOutput<typeof X>`) | **推奨** | components が別名で複数登録される（意図的なら可） |
| 戻り値の TS 型注釈を明示 (`: Promise<User>`) | **推奨** | 推論で十分なら省略可、推論不可なら明示が必要 |
| runtime の `createHttpApp` と build step の `generateClient` に **同じ controllers list を渡す** | **推奨** | 別々の list を渡すと runtime と AppType が乖離する。利用者は controllers を別 file に集約して両方から import するのが推奨 |

### 10.3 hono 隠蔽の境界

| 対象 | 露出可否 |
|---|---|
| `hono.Hono` クラス | **不可** |
| `hono.Context` 型 | **不可**（`response()` 経由でのみ使用） |
| `hono.TypedResponse<T, S, F>` 型 | **可**（`ResponseBuilder` の戻り値型として表に出る） |
| `hono/http-exception` の `HTTPException` | **可**（`@koya/core` から re-export） |
| `hono/client` の `hc` | **可**（client 側で利用者が直接 import） |

---

## 11. 検討経緯の要約

1. **Error handling 先行案** → 設計議論中に「response の type safety を確立しないと error response の形が決まらない」と判明、順番を逆転して contract (AppType + OpenAPI) を先にする
2. **decorator option で response schema** (`@Get('/:id', { response: UserSchema })`) → handler 戻り値型と option の二重定義 / ずれリスクで却下
3. **handler 内 schema 関数** (`return ok(UserSchema, user)`) → schema 抽出が handler 実行依存、AST 解析と相性悪い
4. **NestJS / routing-controllers の手法** (DTO class + reflect-metadata + `@ApiResponse` 等) → reflect-metadata 不採用方針 (spec §3) と相性悪い
5. **typia / nestia の手法** (TS transformer) → koya の oxc/tsdown チェーンと相性悪い、valibot と世界観が競合
6. **tsoa の手法** → controller 規約が衝突、内部 type resolver が独立 export なし
7. **Scramble 流静的解析** → handler のソースから AST + TS Compiler API で抽出、利用者は注釈不要。**採用**
8. **生成 file がコード転記** → handler 変更で stale 化リスク、controller list 自動追従が必要
9. **「最小限 codegen + 型参照」hybrid** → path/method/controller 参照のみ literal で書き、handler signature は `typeof Controller.prototype.method` で型参照。handler 内部実装変更は型推論で自動追従。**採用**
10. **hono 互換 vs koya 独自 client** → hono `hc` を借りる方が ecosystem 利益大、独自 client は再発明。**hc 採用**
11. **`json` / `redirect` 等の wrapper 関数** → `ok` / `created` のような status 別関数は汎用すぎ / neverthrow 等との衝突 / 拡張性低い。却下
12. **`context()` で hono `c` 渡す** → request 系 method (`c.req.valid` 等) も触れてしまい責務分離が型で強制できない
13. **`response()` primitive で `ResponseBuilder`** → response 制御 method (`json` / `redirect` / `text` / `body` / `header`) のみ提供、`c` 全体は型レベルで隠蔽、実装は AsyncLocalStorage で hono Context bypass。**採用**
14. **`Response` 直接 return → build error** → 撤回、hono が許容する形は koya も許容、AppType / OpenAPI には omit + warning
15. **同名ペア規約 (valibot const X + type X)** → 当初強制を検討、利用者負担 / anonymous 戻り値の許容を考慮して **推奨に格下げ**（強制は build error 条件のみ）
16. **TSDoc override** → 採用しない決定、negative spec として §10 に記録
17. **throw を AST 解析して contract に乗せる案** → 撤回。throw の到達先を完全に追うには handler 内 if/else / 呼び出し先 service / repository の throw まで再帰的に解析する必要があり現実的でない。`Route<M, P, H, ThrowType>` の第 4 引数で利用者が明示する案も DRY 違反で却下。**throw は contract に乗せず、runtime error handling のみ**。type-safe error response が欲しい利用者は `return res.json(errorBody, 4xx)` で明示 return する（hono RPC 流儀そのまま）
18. **入力探索方式 (entry file 検索)** → 撤回。`createHttpApp` は entry 別 bundle で複数箇所に書かれる前提、検索基準として不適切。**`generateClient({ controllers, dist })` で controllers を直接受け取る** programmatic API + config based CLI に変更
19. **`validated()` の validation error は contract に乗せる（throw だが特殊扱い）** → hono の validator middleware (`zValidator` / `valibotValidator` 等) は validation 失敗時に明示的に `c.json(error, 400)` を return することで AppType に 400 を載せる。koya は handler 内 lazy validation + throw を維持しつつ、**`Route<M, P, H>` 型関数の `ExtractValidationErrors<H>` で handler 引数 default の `validated()` 存在を型計算で検出して 400 + `ValidationErrorBody` を response union に自動追加** する。AST 追跡ではなく型計算で完結するため一般 throw とは扱いが異なる

---

## 12. brainstorming 確定事項 (2026-05-03)

| # | 論点 | 確定 |
|---|---|---|
| 1 | Phase 2 順序入れ替え (Error → Contract 先行) | 確定。理由: response type safety が先に固まらないと error response の型が決まらない |
| 2 | RPC client | hono `hc<AppType>` を直接利用、独自 client なし |
| 3 | AppType 生成方式 | 「最小限 codegen (path/method/controller 参照) + 型参照 (typeof Controller.prototype.method)」hybrid |
| 4 | 生成 file 出力先 | `<dist>/app.gen.ts` / `<dist>/openapi.json`、`dist` は利用者が指定、commit する |
| 5 | input 取得 | `generateClient({ controllers, dist })` で controllers を **直接受け取る**（programmatic API + CLI + config file）。`createHttpApp` の AST 検索は行わない |
| 6 | OpenAPI lib | input = `@valibot/to-json-schema` / output = `ts-json-schema-generator` / AST = `ts-morph` |
| 7 | 同名ペア規約 | 推奨だが強制ではない、build error は推論不可ケースのみ |
| 8 | TSDoc override | 採らない、negative spec |
| 9 | response 制御 | `response()` primitive (`ResponseBuilder`) 経由、hono Context は型レベルで非露出 |
| 10 | handler 戻り値 | hono 互換すべて許容（素データ T = koya 拡張、TypedResponse / Response / Promise / throw HTTPException） |
| 11 | env primitive | 不要、adapter class 経由 (spec §4.10 維持) |
| 12 | wrapper 関数 (`ok`, `created` 等) | 不要、`res.json(data, status)` で status 制御 |
| 13 | GraphQL | 別 phase に分離、本 phase スコープ外 |
| 14 | spec §4.1 更新 | server 側 hono Context 非露出維持、client 側 `hc` 直接利用許容、`TypedResponse` 型は表に出すが触らない |
| 15 | package 構成 | `@koya/contract` 単一 package |
| 16 | watch mode | chokidar で controller files / 依存 file / config file を監視、出力 file は変化時のみ disk write |
| 17 | API 形式 | programmatic `generateClient({ controllers, dist })` + `defineConfig({...})` + CLI (`koya-contract build` / `watch`)。entry file の AST 検索は行わない |
| 18 | error 表現 | throw は contract に乗らない（hono RPC 流儀）。type-safe error response は `return res.json(errorBody, 4xx)` で明示 return。Phase 2 (3) は runtime error handler の挙動確定のみで contract には影響しない |
| 19 | validation error の contract 乗せ | **特殊扱い**。`validated()` の存在を `Route<M, P, H>` の `ExtractValidationErrors<H>` で型計算検出し、`TypedResponse<ValidationErrorBody, 400, 'json'>` を response union に自動追加。一般 throw とは扱いが異なる（AST 追跡不要、型計算で完結） |

---

## 13. Phase 2 (2) plan で扱う作業項目

`docs/superpowers/plans/2026-05-03-koya-phase2-2-contract.md` で扱う主要タスク:

1. `@koya/core` への `response()` primitive 追加 (§4.4 / §5.2)
   - `ResponseBuilder` type 定義
   - AsyncLocalStorage 経由で hono Context bypass する実装
   - unit test
2. `@koya/core` から `HTTPException` re-export (§9.4)
3. `@koya/core` に `ValidationErrorBody` 型定義 (valibot)
   - MVP では既存 `error-handler.ts` の形 (`{ error: 'validation_failed', issues: ValiIssue[] }`) を valibot で表現
   - `@koya/contract` の `ExtractValidationErrors<H>` と `KoyaErrorSchema` (Phase 2 (3)) からそれぞれ参照される
   - 既存 `error-handler.ts` を valibot 定義に揃える
4. `@koya/contract` package 新規作成 (§6 / §7)
   - package.json / tsconfig / build (tsdown) / test (vitest)
   - 型関数: `Route<M, P, H>` / `BuildAppType<...>` / `ExtractPathParams` / `ExtractRequestBody` / `ExtractResponse` / `ExtractValidationErrors`
   - 型関数の type-level test (vitest type-only test)
   - `GenerateClientOptions` / `defineConfig` 型定義
   - `ValidationErrorBody` 型を `@koya/core` から import
5. Programmatic API: `generateClient({ controllers, dist, watch? })` 実装
   - controllers list を受け取る
   - 各 controller class の source file を `ts-morph` で load
6. AST 解析機構 (`@koya/contract` 内)
   - controller class metadata 抽出 (`@Controller` / `@Get` 等の decorator 引数)
   - handler signature 抽出 (`validated(...)` / `pathParam(...)` の AST 解析)
   - response 型抽出 (TS Compiler API)
7. AppType 出力ロジック (`<dist>/app.gen.ts` 生成)
8. OpenAPI 出力ロジック (`<dist>/openapi.json` 生成)
   - valibot schema → JSON Schema (`@valibot/to-json-schema`)
   - TS 型 → JSON Schema (`ts-json-schema-generator`)
   - named type → `components/schemas/<Name>` 登録
   - paths / operations 組み立て
   - `validated()` の存在 → `400` response に `ValidationErrorBody` schema を自動登録（AppType の `ExtractValidationErrors` と対応）
9. CLI (`koya-contract build` / `watch`)
   - `cac` で arg parse
   - config file (`koya.config.ts` 等) auto-detect + load
   - `chokidar` で watch（controller files / 依存 file / config file）
10. examples/hello を Phase 2 (2) API でリライト
    - `response()` primitive 利用例
    - `koya.config.ts` 追加 + `app.gen.ts` / `openapi.json` 生成 commit
    - `hc<AppType>` を呼ぶ e2e test 追加（validation error 400 narrowing も検証）
11. spec §4.1 更新（Phase 2 (1) spec ファイルを直接編集）
12. 比較表 (`docs/comparison/koya-vs-nestjs.md`) の関連行更新

---
