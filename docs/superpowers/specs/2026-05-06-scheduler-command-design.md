# Scheduler & Command 機能設計

## 概要

zeltフレームワークに以下の機能を追加する:

1. **Scheduler** - デコレータベースの定期実行タスク（`@zelt/core` 拡張）
2. **Command** - CLIコマンド定義（`@zelt/command` 新規パッケージ）
3. **CLI拡張** - `zelt run` コマンド（`@zelt/cli` 拡張）

## 設計思想

- HttpController, ScheduledController, CommandController は全て「Entry」
- 書き心地は統一（デコレータベース、DI対応）
- Scheduler は常駐サーバー向け（サーバーレスは EventBridge + HTTP/Command で対応）

## 1. Scheduler (`@zelt/core` 拡張)

### デコレータ API

```typescript
import { Scheduled, Daily, Weekly, Hourly, Every, Cron } from '@zelt/core';

@Scheduled()
class ReportScheduler {
  constructor(private reportService: ReportService) {}

  @Daily({ hour: 3, minute: 0, tz: 'Asia/Tokyo' })
  async dailyReport() {
    await this.reportService.generateDaily();
  }

  @Weekly({ day: 'monday', hour: 9, tz: 'Asia/Tokyo' })
  async weeklyDigest() {
    await this.reportService.generateWeekly();
  }

  @Hourly({ minute: 30 })
  async hourlyCheck() {
    // 毎時30分に実行
  }

  @Every({ minutes: 5 })
  async frequentTask() {
    // 5分毎に実行
  }

  @Cron('0 */6 * * *')
  async complexSchedule() {
    // 6時間毎（生cron記法）
  }
}
```

### デコレータオプション

```typescript
type DailyOptions = {
  hour: number;       // 0-23
  minute?: number;    // 0-59, default: 0
  tz?: string;        // IANA timezone, default: system
};

type WeeklyOptions = {
  day: 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday';
  hour: number;
  minute?: number;
  tz?: string;
};

type HourlyOptions = {
  minute?: number;    // 0-59, default: 0
  tz?: string;
};

type EveryOptions =
  | { minutes: number }
  | { seconds: number };
```

### createHttpApp 拡張

```typescript
import { createHttpApp } from '@zelt/core';

const app = createHttpApp({
  controllers: [UserController, OrderController],
  schedulers: [ReportScheduler, CleanupScheduler],
  middlewares: [LoggingMiddleware],
  errorHandlers: [GlobalErrorHandler],
  configs: [AppConfig],
});
```

### 内部実装

- **ランタイム**: croner
- **メタデータ管理**: 既存の WeakMap パターンに準拠
- **ライフサイクル**: アプリ起動時にジョブ登録、shutdown時にジョブ停止

### ファイル構成

```
packages/core/src/
├── decorators/
│   ├── scheduled.ts
│   ├── cron.ts
│   ├── daily.ts
│   ├── weekly.ts
│   ├── hourly.ts
│   └── every.ts
├── internal/
│   └── scheduler-metadata.ts
└── scheduler/
    └── runner.ts
```

## 2. Command (`@zelt/command` 新規パッケージ)

### デコレータ API

```typescript
import { Command, type CommandContext } from '@zelt/command';

@Command({
  name: 'db:migrate',
  description: 'Run database migrations',
})
class MigrateCommand {
  args = {
    direction: {
      type: 'positional',
      default: 'up',
      description: 'Migration direction (up/down)',
    },
  } as const;

  options = {
    dryRun: {
      type: 'boolean',
      alias: 'd',
      default: false,
      description: 'Show what would be done without executing',
    },
    steps: {
      type: 'string',
      description: 'Number of migrations to run',
    },
  } as const;

  constructor(private db: DatabaseService) {}

  async run(ctx: CommandContext<typeof this.args, typeof this.options>) {
    const { direction } = ctx.args;
    const { dryRun, steps } = ctx.options;

    if (dryRun) {
      console.log(`Would migrate ${direction}`);
      return;
    }

    await this.db.migrate(direction, steps ? parseInt(steps) : undefined);
  }
}
```

### CommandContext 型

```typescript
type CommandContext<
  TArgs extends ArgsDefinition,
  TOptions extends OptionsDefinition,
> = {
  args: InferArgs<TArgs>;
  options: InferOptions<TOptions>;
};
```

### 依存関係

- citty（引数パース、型定義）
- needle-di（DI）

### ファイル構成

```
packages/command/
├── src/
│   ├── index.ts
│   ├── decorators/
│   │   └── command.ts
│   ├── internal/
│   │   └── metadata.ts
│   └── types.ts
├── package.json
├── tsconfig.json
└── tsdown.config.ts
```

## 3. CLI 拡張 (`@zelt/cli`)

### `zelt run` コマンド

```bash
# 使用例
zelt run db:migrate up --dry-run
zelt run db:seed
zelt run cache:clear

# ヘルプ
zelt run --help
zelt run db:migrate --help
```

### zelt.config.ts 設定

```typescript
import { defineConfig } from '@zelt/cli';

export default defineConfig({
  dev: {
    port: 3000,
  },
  build: {
    outDir: 'dist',
  },
  commands: 'src/commands/**/*.ts',
});
```

### 設定スキーマ拡張

```typescript
type ZeltConfig = {
  dev?: { port?: number; /* ... */ };
  build?: { outDir?: string; /* ... */ };
  commands?: string;  // glob pattern
};
```

### 実行フロー

1. `zelt run <command-name> [args...] [options...]` を実行
2. `zelt.config.ts` から `commands` glob パターンを取得
3. glob にマッチするファイルを動的インポート
4. 各ファイルから `@Command` メタデータを収集
5. `command-name` に一致するコマンドを特定
6. DI コンテナを構築し、コマンドインスタンスを生成
7. citty 経由で引数/オプションをパースし、`run()` を実行

### ファイル構成変更

```
packages/cli/src/
├── commands/
│   ├── dev.ts
│   ├── build.ts
│   ├── main.ts
│   └── run.ts        # 新規
├── config/
│   └── schema.ts     # commands フィールド追加
└── ...
```

## パッケージ依存関係

```
@zelt/core
├── croner (scheduler runtime)
├── needle-di
└── hono

@zelt/command
├── citty
└── needle-di

@zelt/cli
├── @zelt/command
├── citty
├── tinyglobby (glob解決)
└── ...
```

## 将来の拡張ポイント

- **createApp 命名・構造**: GraphQL 対応時に再検討（ネスト構造 or モジュール形式）
- **Scheduler hooks**: beforeJob / afterJob / onError
- **Command groups**: サブコマンドのグルーピング
