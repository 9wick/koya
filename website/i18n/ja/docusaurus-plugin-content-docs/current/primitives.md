---
sidebar_position: 9
---

# リクエスト＆レスポンスプリミティブ

Zeltはリクエストデータへのアクセスとレスポンスの構築のための関数型プリミティブを提供しています。これらのプリミティブはコントローラーメソッドのデフォルトパラメータとして使用できます。

## リクエストプリミティブ

### クエリパラメータ

```typescript
import { Controller, Get, queryParam, queryParams, response } from '@zeltjs/core';

@Controller('/search')
export class SearchController {
  @Get('/')
  search(
    q = queryParam('q'),
    tags = queryParams('tag'),
    res = response(),
  ) {
    // q: string | undefined
    // tags: string[]（指定されていない場合は空配列）
    return res.json({ query: q, tags });
  }
}
```

| 関数 | 戻り値の型 | 説明 |
|-----|----------|-----|
| `queryParam(name)` | `string \| undefined` | 単一のクエリパラメータを取得 |
| `queryParams(name)` | `string[]` | クエリパラメータのすべての値を取得 |

### ヘッダー

```typescript
import { Controller, Get, header, response } from '@zeltjs/core';

@Controller('/api')
export class ApiController {
  @Get('/info')
  info(
    userAgent = header('User-Agent'),
    acceptLanguage = header('Accept-Language'),
    res = response(),
  ) {
    return res.json({ userAgent, acceptLanguage });
  }
}
```

| 関数 | 戻り値の型 | 説明 |
|-----|----------|-----|
| `header(name)` | `string \| undefined` | リクエストヘッダーの値を取得 |

### Cookie

```typescript
import { Controller, Get, cookie, response } from '@zeltjs/core';

@Controller('/session')
export class SessionController {
  @Get('/')
  getSession(
    sessionId = cookie('session_id'),
    res = response(),
  ) {
    return res.json({ sessionId });
  }
}
```

| 関数 | 戻り値の型 | 説明 |
|-----|----------|-----|
| `cookie(name)` | `string \| undefined` | Cookieの値を取得 |

### URL＆パス

```typescript
import { Controller, Get, url, path, method, response } from '@zeltjs/core';

@Controller('/debug')
export class DebugController {
  @Get('/request')
  requestInfo(
    fullUrl = url(),
    requestPath = path(),
    httpMethod = method(),
    res = response(),
  ) {
    return res.json({
      url: fullUrl,      // "http://localhost:3000/debug/request?foo=bar"
      path: requestPath, // "/debug/request"
      method: httpMethod // "GET"
    });
  }
}
```

| 関数 | 戻り値の型 | 説明 |
|-----|----------|-----|
| `url()` | `string` | クエリ文字列を含む完全なリクエストURL |
| `path()` | `string` | クエリ文字列を含まないリクエストパス |
| `method()` | `string` | HTTPメソッド（GET、POSTなど） |

### リクエストボディ

```typescript
import { Controller, Post, body, response } from '@zeltjs/core';

@Controller('/upload')
export class UploadController {
  @Post('/text')
  async uploadText(res = response()) {
    const text = await body('text');
    return res.json({ received: text });
  }

  @Post('/json')
  async uploadJson(res = response()) {
    const data = await body('json');
    return res.json({ received: data });
  }

  @Post('/form')
  async uploadForm(res = response()) {
    const formData = await body('form');
    return res.json({ fields: Object.fromEntries(formData) });
  }
}
```

| タイプ | 戻り値の型 | 説明 |
|-------|----------|-----|
| `body('text')` | `Promise<string>` | 生のテキストボディ |
| `body('json')` | `Promise<unknown>` | パースされたJSONボディ |
| `body('form')` | `Promise<FormData>` | フォームデータ（multipartまたはurlencoded） |
| `body('arrayBuffer')` | `Promise<ArrayBuffer>` | 生のバイナリデータ |
| `body('blob')` | `Promise<Blob>` | Blobデータ |

:::tip
自動的な型推論を伴うバリデーション済みリクエストボディには、代わりに[`validated()`](./validation.md)を使用してください。
:::

### パスパラメータ

```typescript
import { Controller, Get, pathParam, response } from '@zeltjs/core';

@Controller('/users')
export class UserController {
  @Get('/:id')
  getUser(
    id = pathParam('id'),
    res = response(),
  ) {
    // id: string（未定義の場合はエラーをスロー）
    return res.json({ userId: id });
  }
}
```

| 関数 | 戻り値の型 | 説明 |
|-----|----------|-----|
| `pathParam(name)` | `string` | パスパラメータを取得（未定義の場合はエラー） |

## レスポンスプリミティブ

### response()

`response()`プリミティブはHTTPレスポンスを構築するためのビルダーを返します：

```typescript
import { Controller, Get, Post, response } from '@zeltjs/core';

@Controller('/api')
export class ApiController {
  @Get('/data')
  getData(res = response()) {
    return res.json({ message: 'Hello' });
  }

  @Get('/redirect')
  redirect(res = response()) {
    return res.redirect('/new-location', 302);
  }

  @Get('/text')
  getText(res = response()) {
    return res.text('Plain text response');
  }

  @Post('/created')
  create(res = response()) {
    return res.json({ id: '123' }, 201);
  }
}
```

### レスポンスメソッド

| メソッド | 説明 |
|---------|-----|
| `json(data, status?, headers?)` | オプションのステータスコードとヘッダー付きJSONレスポンス |
| `text(data, status?)` | プレーンテキストレスポンス |
| `redirect(url, status?)` | HTTPリダイレクト（デフォルト: 302） |
| `body(data, status?)` | 生のボディレスポンス |
| `header(name, value)` | レスポンスヘッダーを設定（チェーン可能） |

### Cookieの設定

```typescript
import { Controller, Post, response } from '@zeltjs/core';

@Controller('/auth')
export class AuthController {
  @Post('/login')
  login(res = response()) {
    return res
      .setCookie('session_id', 'abc123', {
        httpOnly: true,
        secure: true,
        sameSite: 'Strict',
        maxAge: 60 * 60 * 24, // 1日
      })
      .json({ success: true });
  }

  @Post('/logout')
  logout(res = response()) {
    return res
      .deleteCookie('session_id')
      .json({ success: true });
  }
}
```

### Cookieオプション

| オプション | 型 | 説明 |
|-----------|---|-----|
| `domain` | `string` | Cookieドメイン |
| `expires` | `Date` | 有効期限 |
| `httpOnly` | `boolean` | HTTP-onlyフラグ |
| `maxAge` | `number` | 最大有効期間（秒） |
| `path` | `string` | Cookieパス |
| `secure` | `boolean` | Secureフラグ |
| `sameSite` | `'Strict' \| 'Lax' \| 'None'` | SameSite属性 |

## レスポンスメソッドのチェーン

状態を変更するレスポンスメソッド（`header`、`setCookie`、`deleteCookie`）はビルダーを返すため、メソッドチェーンが可能です：

```typescript
@Get('/download')
download(res = response()) {
  return res
    .header('Content-Disposition', 'attachment; filename="report.csv"')
    .header('Cache-Control', 'no-cache')
    .setCookie('download_started', 'true')
    .text('id,name\n1,Alice\n2,Bob');
}
```
