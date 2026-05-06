# zeltjs/benchmarks - fastify/benchmarks フォーク

## Context

zeltjsとNestJSを比較するベンチマーク環境を構築する。
fastify/benchmarksをフォークして、NestJSとzeltjsを追加する。

## 方針

fastify/benchmarksをそのままフォークし、以下を追加：
- nestjs-express
- nestjs-fastify  
- zeltjs
- routing-controllers（オプション）

## 実装タスク

### 1. フォーク作成
```bash
gh repo fork fastify/benchmarks --clone --remote
cd benchmarks
```

### 2. フレームワーク追加

#### benchmarks/nestjs-express.mjs
```javascript
import { NestFactory } from '@nestjs/core';
import { Controller, Get, Module } from '@nestjs/common';

@Controller()
class HelloController {
  @Get()
  hello() { return 'Hello, World!'; }
}

@Module({ controllers: [HelloController] })
class AppModule {}

const app = await NestFactory.create(AppModule, { logger: false });
await app.listen(3000);
```

#### benchmarks/nestjs-fastify.mjs
```javascript
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { Controller, Get, Module } from '@nestjs/common';

@Controller()
class HelloController {
  @Get()
  hello() { return 'Hello, World!'; }
}

@Module({ controllers: [HelloController] })
class AppModule {}

const app = await NestFactory.create(AppModule, new FastifyAdapter(), { logger: false });
await app.listen(3000);
```

#### benchmarks/zeltjs.mjs
```javascript
import { serve } from '@zeltjs/adapter-node';
import { createHttpApp, Controller, Get } from '@zeltjs/core';

@Controller('/')
class HelloController {
  @Get()
  hello() { return 'Hello, World!'; }
}

const app = createHttpApp({ controllers: [HelloController] });
serve(app, { port: 3000 });
```

### 3. lib/packages.js にエントリ追加

```javascript
'nestjs-express': { ... },
'nestjs-fastify': { ... },
'zeltjs': { ... },
```

### 4. 起動時間計測（metrics/）追加

各フレームワーク用の startup ファイルを追加。

### 5. 依存関係追加

```bash
npm install @nestjs/core @nestjs/common @nestjs/platform-express @nestjs/platform-fastify
npm install @zeltjs/core @zeltjs/adapter-node
```

## 検証方法

```bash
node ./benchmark bench nestjs-express nestjs-fastify zeltjs hono
node ./benchmark compare -t
npm run metrics
```

## 重要ファイル

- `benchmarks/<name>.mjs` - サーバーコード
- `metrics/<name>.cjs` - 起動時間計測
- `lib/packages.js` - フレームワーク定義
