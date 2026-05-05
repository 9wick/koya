# koya Config / Module 設計

> `@koya/core` に Config 機構と Module パターンを導入する設計。Laravel 的な config 上書き + DI 統合を実現する。

## 1. 概要

### 目的

- Module（例: Logger）がデフォルト config を提供
- ユーザーが config を extends して上書き可能
- `createHttpApp({ configs })` で登録、DI 経由で inject

### 設計原則

- class 継承でシンプルに上書き
- Token = class 自身で needle-di の auto-bind を活用
- registry 不要（デフォルトは auto-bind に委ねる）

## 2. 公開 API

### Config Decorator

```ts
import { Config, injectConfig } from '@koya/core';

// Module 側: Token = 自分自身
@Config
class LoggerConfig {
  static readonly Token = LoggerConfig;
  get level() { return 'info'; }
}

// ユーザー側: extends で上書き
@Config
class MyLoggerConfig extends LoggerConfig {
  get level() { return 'debug'; }
}
```

### injectConfig

```ts
import { Injectable, injectConfig } from '@koya/core';
import { LoggerConfig } from '@koya/core/modules/logger';

@Injectable()
class LoggerService {
  constructor(private config = injectConfig(LoggerConfig)) {}
}
```

### createHttpApp

```ts
import { createHttpApp } from '@koya/core';
import { MyLoggerConfig } from './config/logger.config';

export default createHttpApp({
  controllers: [HelloController],
  configs: [MyLoggerConfig],  // 上書き config を渡す
});
```

## 3. 型定義

### ConfigClass

```ts
export type ConfigClass<T = any> = (new (...args: any[]) => T) & {
  readonly Token: new (...args: any[]) => T;
};
```

- `Token` は class 自身を指す
- 型レベルで Token の存在を強制

## 4. 実装詳細

### @Config Decorator

```ts
import { injectable } from '@needle-di/core';
import type { ConfigClass } from './types';

const findToken = (cls: Function): Function | null => {
  let current: Function | null = cls;
  while (current && current !== Function.prototype) {
    if ('Token' in current) {
      return (current as any).Token;
    }
    current = Object.getPrototypeOf(current);
  }
  return null;
};

export const Config = <T extends ConfigClass>(target: T): T => {
  if (!findToken(target)) {
    throw new Error(
      `@Config class "${target.name}" must have static Token (or extend a class that has one)`
    );
  }
  injectable()(target);
  return target;
};
```

- prototype chain を辿って Token を探索
- Token がなければ runtime エラー
- `injectable()` を呼んで DI 対応

### injectConfig

```ts
import { inject } from '@needle-di/core';
import type { ConfigClass } from './types';

export const injectConfig = <T>(configClass: ConfigClass<T>): T => {
  return inject<T>(configClass.Token);
};
```

### createHttpApp (configs 対応)

```ts
const findTokenOwner = (cls: Function): Function | null => {
  let current: Function | null = cls;
  while (current && current !== Function.prototype) {
    if ('Token' in current) {
      return (current as any).Token;
    }
    current = Object.getPrototypeOf(current);
  }
  return null;
};

export type CreateHttpAppOptions = {
  readonly controllers: readonly ControllerClass[];
  readonly middlewares?: readonly MiddlewareInput[];
  readonly configs?: readonly (new () => any)[];
};

export const createHttpApp = (options: CreateHttpAppOptions): HttpApp => {
  const container = new Container();
  
  // configs を bind
  for (const configClass of options.configs ?? []) {
    const token = findTokenOwner(configClass);
    if (token && token !== configClass) {
      container.bind(configClass);
      container.bind({ provide: token, useExisting: configClass });
    }
  }
  
  // ... 既存の処理
};
```

- ユーザー config の親 Token を探索
- 子クラスを bind + 親 Token に `useExisting` で紐付け
- デフォルト config は needle-di の auto-bind に委ねる

## 5. Logger Module

### ディレクトリ構造

```
packages/core/src/modules/logger/
  index.ts      # export { Logger, LoggerConfig }
  logger.ts     # Logger class
  config.ts     # LoggerConfig class
```

### LoggerConfig

```ts
import { Config } from '../../config';

@Config
export class LoggerConfig {
  static readonly Token = LoggerConfig;
  
  get level(): 'debug' | 'info' | 'warn' | 'error' {
    return 'info';
  }
}
```

### Logger

```ts
import { Injectable } from '../../decorators/injectable';
import { injectConfig } from '../../config';
import { LoggerConfig } from './config';

@Injectable()
export class Logger {
  constructor(private config = injectConfig(LoggerConfig)) {}

  debug(msg: string) { this.log('debug', msg); }
  info(msg: string) { this.log('info', msg); }
  warn(msg: string) { this.log('warn', msg); }
  error(msg: string) { this.log('error', msg); }

  private log(level: string, msg: string) {
    const levels = ['debug', 'info', 'warn', 'error'];
    if (levels.indexOf(level) >= levels.indexOf(this.config.level)) {
      console.log(`[${level.toUpperCase()}] ${msg}`);
    }
  }
}
```

## 6. ユーザー利用例

### デフォルト config のまま使う

```ts
import { createHttpApp, inject, Controller, Get } from '@koya/core';
import { Logger } from '@koya/core/modules/logger';

@Controller('/hello')
class HelloController {
  constructor(private logger = inject(Logger)) {}

  @Get('/')
  greet() {
    this.logger.info('Hello!');
    return { message: 'Hello' };
  }
}

export default createHttpApp({
  controllers: [HelloController],
  // configs は渡さない → LoggerConfig のデフォルトが使われる
});
```

### config を上書きする

```ts
// src/config/logger.config.ts
import { Config } from '@koya/core';
import { LoggerConfig } from '@koya/core/modules/logger';

@Config
export class AppLoggerConfig extends LoggerConfig {
  get level() {
    return process.env.LOG_LEVEL ?? 'debug';
  }
}

// app.ts
import { createHttpApp } from '@koya/core';
import { AppLoggerConfig } from './config/logger.config';

export default createHttpApp({
  controllers: [HelloController],
  configs: [AppLoggerConfig],
});
```

## 7. 将来の拡張

### eject コマンド (CLI)

```bash
koya eject logger
# → src/config/logger.config.ts を生成
```

生成されるファイル:
```ts
import { Config } from '@koya/core';
import { LoggerConfig } from '@koya/core/modules/logger';

@Config
export class AppLoggerConfig extends LoggerConfig {
  // カスタマイズをここに記述
}
```

### glob 対応

```ts
createHttpApp({
  controllers: await glob('./src/**/*.controller.ts'),
  configs: await glob('./src/config/*.config.ts'),
});
```

## 8. 技術的判断

### Token = class 自身

Symbol token だと auto-bind が効かず、registry が必要になる。Token = class 自身とすることで:
- デフォルト config は needle-di の auto-bind に委ねられる
- registry が不要になりシンプルに

### @Config vs @Injectable

- `@Config`: config class 専用、Token チェック + `injectable()` 呼び出し
- `@Injectable`: 通常の Service / Repository 用

config class に `inject()` を使う場合も `@Config` を使う（内部で `injectable()` を呼ぶため）。

### useExisting による上書き

`container.bind({ provide: ParentToken, useExisting: ChildClass })` で親 Token を子クラスにリダイレクト。needle-di が子クラスも親 Token に自動登録する問題を、明示的な bind で解決。
