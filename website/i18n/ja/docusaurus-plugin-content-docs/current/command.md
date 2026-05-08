---
sidebar_position: 13
---

# コマンド

Zeltは依存性注入をサポートしたCLIコマンドを構築するための`@zeltjs/command`パッケージを提供しています。

## インストール

```bash
pnpm add @zeltjs/command
```

## コマンドの作成

`@Command`デコレータを使用してCLIコマンドを定義します：

```typescript
import { Command, type CommandContext } from '@zeltjs/command';

@Command({
  name: 'greet',
  description: 'Greet a user',
})
export class GreetCommand {
  args = {
    name: { type: 'positional' as const, description: 'Name to greet' },
  };

  run(ctx: CommandContext<typeof this.args>) {
    console.log(`Hello, ${ctx.args.name}!`);
  }
}
```

## 設定

`zelt.config.ts`に`commands`オプションを追加します：

```typescript
import { defineConfig } from '@zeltjs/cli';

export default defineConfig({
  controllers: 'src/controllers/**/*.ts',
  commands: 'src/commands/**/*.ts',
});
```

## コマンドの実行

`zelt run`を使用してコマンドを実行します：

```bash
# コマンドを実行
zelt run greet Alice

# カスタム設定ファイルを指定
zelt run -c ./config/zelt.config.ts greet Alice
```

## 引数とオプション

### 位置引数

```typescript
@Command({ name: 'copy' })
export class CopyCommand {
  args = {
    source: { 
      type: 'positional' as const,
      required: true,
      description: 'Source file path',
    },
    destination: {
      type: 'positional' as const,
      required: true,
      description: 'Destination file path',
    },
  };

  run(ctx: CommandContext<typeof this.args>) {
    console.log(`Copying ${ctx.args.source} to ${ctx.args.destination}`);
  }
}
```

### オプション（フラグ）

```typescript
@Command({ name: 'build' })
export class BuildCommand {
  options = {
    watch: {
      type: 'boolean' as const,
      alias: 'w',
      default: false,
      description: 'Watch for changes',
    },
    outDir: {
      type: 'string' as const,
      alias: 'o',
      default: 'dist',
      description: 'Output directory',
    },
  };

  run(ctx: CommandContext<Record<string, never>, typeof this.options>) {
    if (ctx.options.watch) {
      console.log('Watching for changes...');
    }
    console.log(`Output directory: ${ctx.options.outDir}`);
  }
}
```

```bash
# 使用例
zelt run build --watch --outDir=out
zelt run build -w -o out
```

### 引数とオプションの組み合わせ

```typescript
@Command({ name: 'deploy' })
export class DeployCommand {
  args = {
    environment: {
      type: 'positional' as const,
      required: true,
      description: 'Target environment (staging, production)',
    },
  };

  options = {
    dryRun: {
      type: 'boolean' as const,
      default: false,
      description: 'Simulate deployment without making changes',
    },
    tag: {
      type: 'string' as const,
      description: 'Docker image tag to deploy',
    },
  };

  run(ctx: CommandContext<typeof this.args, typeof this.options>) {
    const { environment } = ctx.args;
    const { dryRun, tag } = ctx.options;

    if (dryRun) {
      console.log(`[DRY RUN] Would deploy to ${environment}`);
    } else {
      console.log(`Deploying ${tag ?? 'latest'} to ${environment}`);
    }
  }
}
```

## 依存性注入

コマンドは依存性注入をサポートしており、サービスを使用できます：

```typescript
import { Command, type CommandContext } from '@zeltjs/command';
import { inject } from '@zeltjs/core';
import { DatabaseService } from '../services/database.service';

@Command({ name: 'migrate' })
export class MigrateCommand {
  constructor(private readonly db = inject(DatabaseService)) {}

  async run(ctx: CommandContext) {
    await this.db.runMigrations();
    console.log('Migrations completed');
  }
}
```

## 型推論

`CommandContext`型は引数とオプションの型を自動的に推論します：

```typescript
@Command({ name: 'example' })
export class ExampleCommand {
  args = {
    file: { type: 'positional' as const, required: true },
    count: { type: 'positional' as const, default: '10' },
  };

  options = {
    verbose: { type: 'boolean' as const, default: false },
    format: { type: 'string' as const },
  };

  run(ctx: CommandContext<typeof this.args, typeof this.options>) {
    // ctx.args.file: string（必須）
    // ctx.args.count: string（デフォルト値あり）
    // ctx.options.verbose: boolean（デフォルト値あり）
    // ctx.options.format: string | undefined（オプション）
  }
}
```

## 非同期コマンド

コマンドは非同期にできます：

```typescript
@Command({ name: 'sync' })
export class SyncCommand {
  async run(ctx: CommandContext) {
    console.log('Starting sync...');
    await this.fetchData();
    await this.processData();
    console.log('Sync completed');
  }

  private async fetchData() {
    // ...
  }

  private async processData() {
    // ...
  }
}
```
