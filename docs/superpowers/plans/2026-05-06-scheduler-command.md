# Scheduler & Command 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** zeltフレームワークに Scheduler（定期実行）と Command（CLIコマンド）機能を追加する

**Architecture:** 
- Scheduler は `@zelt/core` に追加し、croner を使用してジョブを管理。既存の WeakMap ベースのメタデータパターンに従う
- Command は `@zelt/command` として新規パッケージを作成し、citty 互換の型定義を提供
- CLI は `@zelt/cli` に `zelt run` コマンドを追加し、glob でコマンドファイルを発見・実行

**Tech Stack:** croner, citty, needle-di, tinyglobby, valibot

---

## Phase 1: Scheduler (packages/core)

### Task 1: Scheduler メタデータストア

**Files:**
- Create: `packages/core/src/internal/scheduler-metadata.ts`
- Test: `packages/core/src/internal/scheduler-metadata.test.ts`

- [ ] **Step 1: テストファイル作成**

```typescript
// packages/core/src/internal/scheduler-metadata.test.ts
import { describe, expect, it } from 'vitest';

import {
  appendScheduleMetadata,
  getScheduledMetadata,
  getScheduleMetadata,
  setScheduledMetadata,
} from './scheduler-metadata';

describe('scheduler-metadata', () => {
  describe('setScheduledMetadata / getScheduledMetadata', () => {
    it('stores and retrieves scheduled class marker', () => {
      class TestScheduler {}
      setScheduledMetadata(TestScheduler);
      expect(getScheduledMetadata(TestScheduler)).toBe(true);
    });

    it('returns undefined for unmarked class', () => {
      class UnmarkedClass {}
      expect(getScheduledMetadata(UnmarkedClass)).toBeUndefined();
    });
  });

  describe('appendScheduleMetadata / getScheduleMetadata', () => {
    it('appends and retrieves schedule metadata', () => {
      class TestScheduler {}
      appendScheduleMetadata(TestScheduler, {
        methodName: 'dailyTask',
        cronExpression: '0 3 * * *',
        timezone: 'Asia/Tokyo',
      });

      const schedules = getScheduleMetadata(TestScheduler);
      expect(schedules).toHaveLength(1);
      expect(schedules[0]).toEqual({
        methodName: 'dailyTask',
        cronExpression: '0 3 * * *',
        timezone: 'Asia/Tokyo',
      });
    });

    it('appends multiple schedules', () => {
      class TestScheduler {}
      appendScheduleMetadata(TestScheduler, {
        methodName: 'task1',
        cronExpression: '0 * * * *',
      });
      appendScheduleMetadata(TestScheduler, {
        methodName: 'task2',
        cronExpression: '0 0 * * *',
      });

      const schedules = getScheduleMetadata(TestScheduler);
      expect(schedules).toHaveLength(2);
    });

    it('returns empty array for class without schedules', () => {
      class EmptyScheduler {}
      expect(getScheduleMetadata(EmptyScheduler)).toEqual([]);
    });
  });
});
```

- [ ] **Step 2: テスト実行（失敗確認）**

Run: `cd /workspaces/github.com/zeltjs/zelt && pnpm test packages/core/src/internal/scheduler-metadata.test.ts`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: メタデータストア実装**

```typescript
// packages/core/src/internal/scheduler-metadata.ts
type ScheduleMetadata = {
  readonly methodName: string | symbol;
  readonly cronExpression: string;
  readonly timezone?: string;
};

const scheduledStore = new WeakMap<object, true>();
const scheduleStore = new WeakMap<object, ScheduleMetadata[]>();

export const setScheduledMetadata = (cls: object): void => {
  scheduledStore.set(cls, true);
};

export const getScheduledMetadata = (cls: object): true | undefined =>
  scheduledStore.get(cls);

export const appendScheduleMetadata = (cls: object, meta: ScheduleMetadata): void => {
  const existing = scheduleStore.get(cls) ?? [];
  scheduleStore.set(cls, [...existing, meta]);
};

export const getScheduleMetadata = (cls: object): readonly ScheduleMetadata[] =>
  scheduleStore.get(cls) ?? [];
```

- [ ] **Step 4: テスト実行（成功確認）**

Run: `cd /workspaces/github.com/zeltjs/zelt && pnpm test packages/core/src/internal/scheduler-metadata.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add packages/core/src/internal/scheduler-metadata.ts packages/core/src/internal/scheduler-metadata.test.ts
git commit -m "feat(core): add scheduler metadata store"
```

---

### Task 2: @Scheduled デコレータ

**Files:**
- Create: `packages/core/src/decorators/scheduled.ts`
- Test: `packages/core/src/decorators/scheduled.test.ts`

- [ ] **Step 1: テストファイル作成**

```typescript
// packages/core/src/decorators/scheduled.test.ts
import { describe, expect, it } from 'vitest';

import { getScheduledMetadata } from '../internal/scheduler-metadata';

import { Scheduled } from './scheduled';

describe('@Scheduled', () => {
  it('marks class as scheduled', () => {
    @Scheduled()
    class TestScheduler {}

    expect(getScheduledMetadata(TestScheduler)).toBe(true);
  });

  it('makes class injectable', () => {
    @Scheduled()
    class TestScheduler {}

    // needle-di stores metadata on the class
    expect(Reflect.getMetadata('needledi:injectable', TestScheduler)).toBe(true);
  });
});
```

- [ ] **Step 2: テスト実行（失敗確認）**

Run: `cd /workspaces/github.com/zeltjs/zelt && pnpm test packages/core/src/decorators/scheduled.test.ts`
Expected: FAIL

- [ ] **Step 3: デコレータ実装**

```typescript
// packages/core/src/decorators/scheduled.ts
import { injectable } from '@needle-di/core';

import { setScheduledMetadata } from '../internal/scheduler-metadata';

type AnyClass = new (...args: never[]) => object;

export const Scheduled =
  () =>
  <T extends AnyClass>(target: T): T => {
    setScheduledMetadata(target);
    const wrapped: T | void = injectable<T>()(target);
    return wrapped ?? target;
  };
```

- [ ] **Step 4: テスト実行（成功確認）**

Run: `cd /workspaces/github.com/zeltjs/zelt && pnpm test packages/core/src/decorators/scheduled.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add packages/core/src/decorators/scheduled.ts packages/core/src/decorators/scheduled.test.ts
git commit -m "feat(core): add @Scheduled decorator"
```

---

### Task 3: @Cron デコレータ

**Files:**
- Create: `packages/core/src/decorators/cron.ts`
- Test: `packages/core/src/decorators/cron.test.ts`

- [ ] **Step 1: テストファイル作成**

```typescript
// packages/core/src/decorators/cron.test.ts
import { describe, expect, it } from 'vitest';

import { getScheduleMetadata } from '../internal/scheduler-metadata';

import { Cron } from './cron';
import { Scheduled } from './scheduled';

describe('@Cron', () => {
  it('registers cron expression for method', () => {
    @Scheduled()
    class TestScheduler {
      @Cron('0 3 * * *')
      dailyTask() {}
    }

    const schedules = getScheduleMetadata(TestScheduler);
    expect(schedules).toHaveLength(1);
    expect(schedules[0]).toEqual({
      methodName: 'dailyTask',
      cronExpression: '0 3 * * *',
      timezone: undefined,
    });
  });

  it('supports timezone option', () => {
    @Scheduled()
    class TestScheduler {
      @Cron('0 9 * * 1', { tz: 'Asia/Tokyo' })
      weeklyTask() {}
    }

    const schedules = getScheduleMetadata(TestScheduler);
    expect(schedules[0]?.timezone).toBe('Asia/Tokyo');
  });

  it('throws when applied to static method', () => {
    expect(() => {
      @Scheduled()
      class TestScheduler {
        @Cron('0 * * * *')
        static staticTask() {}
      }
      return TestScheduler;
    }).toThrow('@Cron cannot be applied to static methods');
  });
});
```

- [ ] **Step 2: テスト実行（失敗確認）**

Run: `cd /workspaces/github.com/zeltjs/zelt && pnpm test packages/core/src/decorators/cron.test.ts`
Expected: FAIL

- [ ] **Step 3: デコレータ実装**

```typescript
// packages/core/src/decorators/cron.ts
import { appendScheduleMetadata } from '../internal/scheduler-metadata';

type CronOptions = {
  readonly tz?: string;
};

export const Cron =
  (expression: string, options?: CronOptions): MethodDecorator =>
  (target, propertyKey): void => {
    if (typeof target === 'function') {
      throw new Error('@Cron cannot be applied to static methods');
    }
    appendScheduleMetadata(target.constructor, {
      methodName: propertyKey,
      cronExpression: expression,
      timezone: options?.tz,
    });
  };
```

- [ ] **Step 4: テスト実行（成功確認）**

Run: `cd /workspaces/github.com/zeltjs/zelt && pnpm test packages/core/src/decorators/cron.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add packages/core/src/decorators/cron.ts packages/core/src/decorators/cron.test.ts
git commit -m "feat(core): add @Cron decorator"
```

---

### Task 4: @Daily デコレータ

**Files:**
- Create: `packages/core/src/decorators/daily.ts`
- Test: `packages/core/src/decorators/daily.test.ts`

- [ ] **Step 1: テストファイル作成**

```typescript
// packages/core/src/decorators/daily.test.ts
import { describe, expect, it } from 'vitest';

import { getScheduleMetadata } from '../internal/scheduler-metadata';

import { Daily } from './daily';
import { Scheduled } from './scheduled';

describe('@Daily', () => {
  it('converts hour to cron expression', () => {
    @Scheduled()
    class TestScheduler {
      @Daily({ hour: 3 })
      dailyTask() {}
    }

    const schedules = getScheduleMetadata(TestScheduler);
    expect(schedules[0]?.cronExpression).toBe('0 3 * * *');
  });

  it('includes minute in cron expression', () => {
    @Scheduled()
    class TestScheduler {
      @Daily({ hour: 14, minute: 30 })
      afternoonTask() {}
    }

    const schedules = getScheduleMetadata(TestScheduler);
    expect(schedules[0]?.cronExpression).toBe('30 14 * * *');
  });

  it('supports timezone option', () => {
    @Scheduled()
    class TestScheduler {
      @Daily({ hour: 9, tz: 'America/New_York' })
      nycTask() {}
    }

    const schedules = getScheduleMetadata(TestScheduler);
    expect(schedules[0]?.timezone).toBe('America/New_York');
  });

  it('defaults minute to 0', () => {
    @Scheduled()
    class TestScheduler {
      @Daily({ hour: 0 })
      midnightTask() {}
    }

    const schedules = getScheduleMetadata(TestScheduler);
    expect(schedules[0]?.cronExpression).toBe('0 0 * * *');
  });
});
```

- [ ] **Step 2: テスト実行（失敗確認）**

Run: `cd /workspaces/github.com/zeltjs/zelt && pnpm test packages/core/src/decorators/daily.test.ts`
Expected: FAIL

- [ ] **Step 3: デコレータ実装**

```typescript
// packages/core/src/decorators/daily.ts
import { appendScheduleMetadata } from '../internal/scheduler-metadata';

type DailyOptions = {
  readonly hour: number;
  readonly minute?: number;
  readonly tz?: string;
};

export const Daily =
  (options: DailyOptions): MethodDecorator =>
  (target, propertyKey): void => {
    if (typeof target === 'function') {
      throw new Error('@Daily cannot be applied to static methods');
    }
    const minute = options.minute ?? 0;
    const cronExpression = `${minute} ${options.hour} * * *`;
    appendScheduleMetadata(target.constructor, {
      methodName: propertyKey,
      cronExpression,
      timezone: options.tz,
    });
  };
```

- [ ] **Step 4: テスト実行（成功確認）**

Run: `cd /workspaces/github.com/zeltjs/zelt && pnpm test packages/core/src/decorators/daily.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add packages/core/src/decorators/daily.ts packages/core/src/decorators/daily.test.ts
git commit -m "feat(core): add @Daily decorator"
```

---

### Task 5: @Weekly デコレータ

**Files:**
- Create: `packages/core/src/decorators/weekly.ts`
- Test: `packages/core/src/decorators/weekly.test.ts`

- [ ] **Step 1: テストファイル作成**

```typescript
// packages/core/src/decorators/weekly.test.ts
import { describe, expect, it } from 'vitest';

import { getScheduleMetadata } from '../internal/scheduler-metadata';

import { Scheduled } from './scheduled';
import { Weekly } from './weekly';

describe('@Weekly', () => {
  it('converts day and hour to cron expression', () => {
    @Scheduled()
    class TestScheduler {
      @Weekly({ day: 'monday', hour: 9 })
      weeklyTask() {}
    }

    const schedules = getScheduleMetadata(TestScheduler);
    expect(schedules[0]?.cronExpression).toBe('0 9 * * 1');
  });

  it('maps all days correctly', () => {
    const dayMap: Record<string, string> = {
      sunday: '0',
      monday: '1',
      tuesday: '2',
      wednesday: '3',
      thursday: '4',
      friday: '5',
      saturday: '6',
    };

    for (const [dayName, cronDay] of Object.entries(dayMap)) {
      @Scheduled()
      class TestScheduler {
        @Weekly({ day: dayName as 'monday', hour: 10 })
        task() {}
      }

      const schedules = getScheduleMetadata(TestScheduler);
      expect(schedules[0]?.cronExpression).toBe(`0 10 * * ${cronDay}`);
    }
  });

  it('includes minute in cron expression', () => {
    @Scheduled()
    class TestScheduler {
      @Weekly({ day: 'friday', hour: 17, minute: 30 })
      endOfWeek() {}
    }

    const schedules = getScheduleMetadata(TestScheduler);
    expect(schedules[0]?.cronExpression).toBe('30 17 * * 5');
  });

  it('supports timezone option', () => {
    @Scheduled()
    class TestScheduler {
      @Weekly({ day: 'sunday', hour: 8, tz: 'Europe/London' })
      londonTask() {}
    }

    const schedules = getScheduleMetadata(TestScheduler);
    expect(schedules[0]?.timezone).toBe('Europe/London');
  });
});
```

- [ ] **Step 2: テスト実行（失敗確認）**

Run: `cd /workspaces/github.com/zeltjs/zelt && pnpm test packages/core/src/decorators/weekly.test.ts`
Expected: FAIL

- [ ] **Step 3: デコレータ実装**

```typescript
// packages/core/src/decorators/weekly.ts
import { appendScheduleMetadata } from '../internal/scheduler-metadata';

type DayOfWeek = 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday';

type WeeklyOptions = {
  readonly day: DayOfWeek;
  readonly hour: number;
  readonly minute?: number;
  readonly tz?: string;
};

const dayToCron: Record<DayOfWeek, string> = {
  sunday: '0',
  monday: '1',
  tuesday: '2',
  wednesday: '3',
  thursday: '4',
  friday: '5',
  saturday: '6',
};

export const Weekly =
  (options: WeeklyOptions): MethodDecorator =>
  (target, propertyKey): void => {
    if (typeof target === 'function') {
      throw new Error('@Weekly cannot be applied to static methods');
    }
    const minute = options.minute ?? 0;
    const cronDay = dayToCron[options.day];
    const cronExpression = `${minute} ${options.hour} * * ${cronDay}`;
    appendScheduleMetadata(target.constructor, {
      methodName: propertyKey,
      cronExpression,
      timezone: options.tz,
    });
  };
```

- [ ] **Step 4: テスト実行（成功確認）**

Run: `cd /workspaces/github.com/zeltjs/zelt && pnpm test packages/core/src/decorators/weekly.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add packages/core/src/decorators/weekly.ts packages/core/src/decorators/weekly.test.ts
git commit -m "feat(core): add @Weekly decorator"
```

---

### Task 6: @Hourly デコレータ

**Files:**
- Create: `packages/core/src/decorators/hourly.ts`
- Test: `packages/core/src/decorators/hourly.test.ts`

- [ ] **Step 1: テストファイル作成**

```typescript
// packages/core/src/decorators/hourly.test.ts
import { describe, expect, it } from 'vitest';

import { getScheduleMetadata } from '../internal/scheduler-metadata';

import { Hourly } from './hourly';
import { Scheduled } from './scheduled';

describe('@Hourly', () => {
  it('generates hourly cron expression with default minute 0', () => {
    @Scheduled()
    class TestScheduler {
      @Hourly()
      hourlyTask() {}
    }

    const schedules = getScheduleMetadata(TestScheduler);
    expect(schedules[0]?.cronExpression).toBe('0 * * * *');
  });

  it('includes specified minute', () => {
    @Scheduled()
    class TestScheduler {
      @Hourly({ minute: 30 })
      halfPastTask() {}
    }

    const schedules = getScheduleMetadata(TestScheduler);
    expect(schedules[0]?.cronExpression).toBe('30 * * * *');
  });

  it('supports timezone option', () => {
    @Scheduled()
    class TestScheduler {
      @Hourly({ minute: 15, tz: 'UTC' })
      utcTask() {}
    }

    const schedules = getScheduleMetadata(TestScheduler);
    expect(schedules[0]?.timezone).toBe('UTC');
  });
});
```

- [ ] **Step 2: テスト実行（失敗確認）**

Run: `cd /workspaces/github.com/zeltjs/zelt && pnpm test packages/core/src/decorators/hourly.test.ts`
Expected: FAIL

- [ ] **Step 3: デコレータ実装**

```typescript
// packages/core/src/decorators/hourly.ts
import { appendScheduleMetadata } from '../internal/scheduler-metadata';

type HourlyOptions = {
  readonly minute?: number;
  readonly tz?: string;
};

export const Hourly =
  (options?: HourlyOptions): MethodDecorator =>
  (target, propertyKey): void => {
    if (typeof target === 'function') {
      throw new Error('@Hourly cannot be applied to static methods');
    }
    const minute = options?.minute ?? 0;
    const cronExpression = `${minute} * * * *`;
    appendScheduleMetadata(target.constructor, {
      methodName: propertyKey,
      cronExpression,
      timezone: options?.tz,
    });
  };
```

- [ ] **Step 4: テスト実行（成功確認）**

Run: `cd /workspaces/github.com/zeltjs/zelt && pnpm test packages/core/src/decorators/hourly.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add packages/core/src/decorators/hourly.ts packages/core/src/decorators/hourly.test.ts
git commit -m "feat(core): add @Hourly decorator"
```

---

### Task 7: @Every デコレータ

**Files:**
- Create: `packages/core/src/decorators/every.ts`
- Test: `packages/core/src/decorators/every.test.ts`

- [ ] **Step 1: テストファイル作成**

```typescript
// packages/core/src/decorators/every.test.ts
import { describe, expect, it } from 'vitest';

import { getScheduleMetadata } from '../internal/scheduler-metadata';

import { Every } from './every';
import { Scheduled } from './scheduled';

describe('@Every', () => {
  it('generates interval cron for minutes', () => {
    @Scheduled()
    class TestScheduler {
      @Every({ minutes: 5 })
      frequentTask() {}
    }

    const schedules = getScheduleMetadata(TestScheduler);
    expect(schedules[0]?.cronExpression).toBe('*/5 * * * *');
  });

  it('generates interval cron for seconds', () => {
    @Scheduled()
    class TestScheduler {
      @Every({ seconds: 30 })
      veryFrequentTask() {}
    }

    const schedules = getScheduleMetadata(TestScheduler);
    expect(schedules[0]?.cronExpression).toBe('*/30 * * * * *');
  });
});
```

- [ ] **Step 2: テスト実行（失敗確認）**

Run: `cd /workspaces/github.com/zeltjs/zelt && pnpm test packages/core/src/decorators/every.test.ts`
Expected: FAIL

- [ ] **Step 3: デコレータ実装**

```typescript
// packages/core/src/decorators/every.ts
import { appendScheduleMetadata } from '../internal/scheduler-metadata';

type EveryOptions = { minutes: number } | { seconds: number };

export const Every =
  (options: EveryOptions): MethodDecorator =>
  (target, propertyKey): void => {
    if (typeof target === 'function') {
      throw new Error('@Every cannot be applied to static methods');
    }

    const cronExpression =
      'minutes' in options ? `*/${options.minutes} * * * *` : `*/${options.seconds} * * * * *`;

    appendScheduleMetadata(target.constructor, {
      methodName: propertyKey,
      cronExpression,
      timezone: undefined,
    });
  };
```

- [ ] **Step 4: テスト実行（成功確認）**

Run: `cd /workspaces/github.com/zeltjs/zelt && pnpm test packages/core/src/decorators/every.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add packages/core/src/decorators/every.ts packages/core/src/decorators/every.test.ts
git commit -m "feat(core): add @Every decorator"
```

---

### Task 8: Scheduler Runner（croner 統合）

**Files:**
- Create: `packages/core/src/scheduler/runner.ts`
- Test: `packages/core/src/scheduler/runner.test.ts`
- Modify: `packages/core/package.json`

- [ ] **Step 1: croner 依存関係追加**

```bash
cd /workspaces/github.com/zeltjs/zelt && pnpm add croner@9.1.0 -F @zeltjs/core
```

- [ ] **Step 2: テストファイル作成**

```typescript
// packages/core/src/scheduler/runner.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Cron } from '../decorators/cron';
import { Scheduled } from '../decorators/scheduled';
import { createContainer } from '../internal/container';

import { type SchedulerRunner, createSchedulerRunner } from './runner';

describe('SchedulerRunner', () => {
  let runner: SchedulerRunner;

  afterEach(async () => {
    if (runner) {
      await runner.stop();
    }
  });

  it('starts and stops scheduler jobs', async () => {
    const taskFn = vi.fn();

    @Scheduled()
    class TestScheduler {
      @Cron('* * * * * *')
      everySecond() {
        taskFn();
      }
    }

    const resolver = createContainer();
    runner = createSchedulerRunner([TestScheduler], resolver);

    runner.start();
    expect(runner.isRunning()).toBe(true);

    await runner.stop();
    expect(runner.isRunning()).toBe(false);
  });

  it('executes scheduled method', async () => {
    const taskFn = vi.fn();

    @Scheduled()
    class TestScheduler {
      @Cron('* * * * * *')
      everySecond() {
        taskFn();
      }
    }

    const resolver = createContainer();
    runner = createSchedulerRunner([TestScheduler], resolver);

    runner.start();

    await vi.waitFor(() => expect(taskFn).toHaveBeenCalled(), { timeout: 2000 });

    await runner.stop();
  });

  it('respects timezone setting', () => {
    @Scheduled()
    class TestScheduler {
      @Cron('0 9 * * *', { tz: 'Asia/Tokyo' })
      tokyoMorning() {}
    }

    const resolver = createContainer();
    runner = createSchedulerRunner([TestScheduler], resolver);

    runner.start();
    const jobs = runner.getJobs();
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.timezone).toBe('Asia/Tokyo');

    runner.stop();
  });
});
```

- [ ] **Step 3: テスト実行（失敗確認）**

Run: `cd /workspaces/github.com/zeltjs/zelt && pnpm test packages/core/src/scheduler/runner.test.ts`
Expected: FAIL

- [ ] **Step 4: Runner 実装**

```typescript
// packages/core/src/scheduler/runner.ts
import { Cron } from 'croner';

import { getScheduledMetadata, getScheduleMetadata } from '../internal/scheduler-metadata';

type SchedulerClass = new (...args: never[]) => object;
type Resolver = { get: <T extends object>(cls: new (...args: never[]) => T) => T };

type JobInfo = {
  readonly name: string;
  readonly cronExpression: string;
  readonly timezone: string | undefined;
};

export type SchedulerRunner = {
  readonly start: () => void;
  readonly stop: () => Promise<void>;
  readonly isRunning: () => boolean;
  readonly getJobs: () => readonly JobInfo[];
};

export const createSchedulerRunner = (
  schedulerClasses: readonly SchedulerClass[],
  resolver: Resolver,
): SchedulerRunner => {
  const jobs: Cron[] = [];
  const jobInfos: JobInfo[] = [];
  let running = false;

  const start = (): void => {
    if (running) return;

    for (const schedulerClass of schedulerClasses) {
      if (!getScheduledMetadata(schedulerClass)) {
        continue;
      }

      const instance = resolver.get(schedulerClass);
      const schedules = getScheduleMetadata(schedulerClass);

      for (const schedule of schedules) {
        const methodName = schedule.methodName;
        const method = (instance as Record<string | symbol, () => unknown>)[methodName];

        if (typeof method !== 'function') {
          continue;
        }

        const job = new Cron(
          schedule.cronExpression,
          { timezone: schedule.timezone },
          () => {
            void Promise.resolve(method.call(instance));
          },
        );

        jobs.push(job);
        jobInfos.push({
          name: String(methodName),
          cronExpression: schedule.cronExpression,
          timezone: schedule.timezone,
        });
      }
    }

    running = true;
  };

  const stop = async (): Promise<void> => {
    for (const job of jobs) {
      job.stop();
    }
    jobs.length = 0;
    running = false;
  };

  const isRunning = (): boolean => running;

  const getJobs = (): readonly JobInfo[] => jobInfos;

  return { start, stop, isRunning, getJobs };
};
```

- [ ] **Step 5: テスト実行（成功確認）**

Run: `cd /workspaces/github.com/zeltjs/zelt && pnpm test packages/core/src/scheduler/runner.test.ts`
Expected: PASS

- [ ] **Step 6: コミット**

```bash
git add packages/core/src/scheduler/runner.ts packages/core/src/scheduler/runner.test.ts packages/core/package.json pnpm-lock.yaml
git commit -m "feat(core): add scheduler runner with croner"
```

---

### Task 9: createHttpApp に schedulers オプション追加

**Files:**
- Modify: `packages/core/src/http/app.ts`
- Modify: `packages/core/src/http/app.test.ts` (create if not exists)

- [ ] **Step 1: 既存の app.ts を確認**

Read: `packages/core/src/http/app.ts`

- [ ] **Step 2: CreateHttpAppOptions に schedulers を追加**

```typescript
// packages/core/src/http/app.ts に追加する型定義
type SchedulerClass = new (...args: never[]) => object;

export type CreateHttpAppOptions = {
  readonly controllers: readonly ControllerClass[];
  readonly schedulers?: readonly SchedulerClass[];  // 追加
  readonly middlewares?: readonly MiddlewareInput[];
  readonly errorHandlers?: readonly ErrorHandlerClass[];
  readonly configs?: readonly (new (...args: never[]) => unknown)[];
};
```

- [ ] **Step 3: HttpApp 型に scheduler 関連メソッド追加**

```typescript
// packages/core/src/http/app.ts の HttpApp 型を拡張
export type HttpApp = {
  readonly fetch: (request: Request) => Promise<Response>;
  readonly request: (input: string | Request, init?: RequestInit) => Promise<Response>;
  readonly startScheduler: () => void;
  readonly stopScheduler: () => Promise<void>;
};
```

- [ ] **Step 4: createHttpApp 実装を修正**

```typescript
// packages/core/src/http/app.ts
import { Hono } from 'hono';

import { createContainer } from '../internal/container';
import { buildRoutes } from '../internal/route-builder';
import type {
  ErrorHandlerClass,
  ErrorHandlerInstance,
  MiddlewareInput,
  RequestContext,
} from '../middleware/types';
import { createSchedulerRunner, type SchedulerRunner } from '../scheduler/runner';

import { handleError } from './error-handler';

type ControllerClass = new (...args: never[]) => object;
type SchedulerClass = new (...args: never[]) => object;
type Resolver = { get: <T extends object>(cls: new (...args: never[]) => T) => T };

export type CreateHttpAppOptions = {
  readonly controllers: readonly ControllerClass[];
  readonly schedulers?: readonly SchedulerClass[];
  readonly middlewares?: readonly MiddlewareInput[];
  readonly errorHandlers?: readonly ErrorHandlerClass[];
  readonly configs?: readonly (new (...args: never[]) => unknown)[];
};

export type HttpApp = {
  readonly fetch: (request: Request) => Promise<Response>;
  readonly request: (input: string | Request, init?: RequestInit) => Promise<Response>;
  readonly startScheduler: () => void;
  readonly stopScheduler: () => Promise<void>;
};

const createErrorHandler =
  (errorHandlers: readonly ErrorHandlerInstance[]) =>
  async (err: Error, c: RequestContext): Promise<Response> => {
    for (const handler of errorHandlers) {
      const result = await handler.onError(err, c);
      if (result) return result;
    }
    return handleError(err);
  };

const resolveErrorHandler = (cls: ErrorHandlerClass, resolver: Resolver): ErrorHandlerInstance => {
  const instance: ErrorHandlerInstance = resolver.get(cls);
  return instance;
};

const resolveErrorHandlers = (
  classes: readonly ErrorHandlerClass[],
  resolver: Resolver,
): ErrorHandlerInstance[] => classes.map((cls) => resolveErrorHandler(cls, resolver));

export const createHttpApp = (options: CreateHttpAppOptions): HttpApp => {
  const resolver = createContainer({ configs: options.configs });
  const hono = new Hono({ strict: false });

  const errorHandlers = resolveErrorHandlers(options.errorHandlers ?? [], resolver);
  hono.onError(createErrorHandler(errorHandlers));

  buildRoutes(hono, options.controllers, resolver, options.middlewares ?? []);

  let schedulerRunner: SchedulerRunner | undefined;
  if (options.schedulers && options.schedulers.length > 0) {
    schedulerRunner = createSchedulerRunner(options.schedulers, resolver);
  }

  const fetch = (req: Request): Promise<Response> => Promise.resolve(hono.fetch(req));
  const request = (input: string | Request, init?: RequestInit): Promise<Response> => {
    const req =
      typeof input === 'string' ? new Request(new URL(input, 'http://localhost'), init) : input;
    return fetch(req);
  };

  const startScheduler = (): void => {
    schedulerRunner?.start();
  };

  const stopScheduler = async (): Promise<void> => {
    await schedulerRunner?.stop();
  };

  return { fetch, request, startScheduler, stopScheduler };
};
```

- [ ] **Step 5: テスト作成**

```typescript
// packages/core/src/http/app-scheduler.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Cron } from '../decorators/cron';
import { Scheduled } from '../decorators/scheduled';

import { createHttpApp, type HttpApp } from './app';

describe('createHttpApp with schedulers', () => {
  let app: HttpApp;

  afterEach(async () => {
    if (app) {
      await app.stopScheduler();
    }
  });

  it('accepts schedulers option', () => {
    @Scheduled()
    class TestScheduler {
      @Cron('0 * * * *')
      hourlyTask() {}
    }

    app = createHttpApp({
      controllers: [],
      schedulers: [TestScheduler],
    });

    expect(app.startScheduler).toBeDefined();
    expect(app.stopScheduler).toBeDefined();
  });

  it('starts and stops scheduler', async () => {
    const taskFn = vi.fn();

    @Scheduled()
    class TestScheduler {
      @Cron('* * * * * *')
      everySecond() {
        taskFn();
      }
    }

    app = createHttpApp({
      controllers: [],
      schedulers: [TestScheduler],
    });

    app.startScheduler();

    await vi.waitFor(() => expect(taskFn).toHaveBeenCalled(), { timeout: 2000 });

    await app.stopScheduler();
  });

  it('works without schedulers option', () => {
    app = createHttpApp({
      controllers: [],
    });

    expect(() => app.startScheduler()).not.toThrow();
  });
});
```

- [ ] **Step 6: テスト実行（成功確認）**

Run: `cd /workspaces/github.com/zeltjs/zelt && pnpm test packages/core/src/http/app-scheduler.test.ts`
Expected: PASS

- [ ] **Step 7: コミット**

```bash
git add packages/core/src/http/app.ts packages/core/src/http/app-scheduler.test.ts
git commit -m "feat(core): add schedulers option to createHttpApp"
```

---

### Task 10: Scheduler エクスポート追加

**Files:**
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: index.ts にエクスポート追加**

```typescript
// packages/core/src/index.ts に追加
export { Cron } from './decorators/cron';
export { Daily } from './decorators/daily';
export { Every } from './decorators/every';
export { Hourly } from './decorators/hourly';
export { Scheduled } from './decorators/scheduled';
export { Weekly } from './decorators/weekly';
```

- [ ] **Step 2: 型チェック実行**

Run: `cd /workspaces/github.com/zeltjs/zelt && pnpm typecheck`
Expected: PASS

- [ ] **Step 3: ビルド確認**

Run: `cd /workspaces/github.com/zeltjs/zelt && pnpm build`
Expected: PASS

- [ ] **Step 4: コミット**

```bash
git add packages/core/src/index.ts
git commit -m "feat(core): export scheduler decorators"
```

---

## Phase 2: Command Package (packages/command)

### Task 11: パッケージスキャフォールド

**Files:**
- Create: `packages/command/package.json`
- Create: `packages/command/tsconfig.json`
- Create: `packages/command/tsdown.config.ts`
- Create: `packages/command/src/index.ts`

- [ ] **Step 1: package.json 作成**

```json
{
  "name": "@zeltjs/command",
  "version": "0.0.1",
  "description": "Command decorators for Zelt framework",
  "type": "module",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/zeltjs/zelt.git",
    "directory": "packages/command"
  },
  "publishConfig": {
    "access": "public"
  },
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": [
    "dist"
  ],
  "scripts": {
    "build": "tsdown",
    "test": "vitest run",
    "typecheck": "tsc -b"
  },
  "dependencies": {
    "citty": "0.1.6"
  },
  "devDependencies": {
    "@needle-di/core": "1.1.2",
    "@types/node": "22.19.17"
  }
}
```

- [ ] **Step 2: tsconfig.json 作成**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: tsdown.config.ts 作成**

```typescript
import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
});
```

- [ ] **Step 4: 空の index.ts 作成**

```typescript
// packages/command/src/index.ts
export {};
```

- [ ] **Step 5: 依存関係インストール**

```bash
cd /workspaces/github.com/zeltjs/zelt && pnpm install
```

- [ ] **Step 6: コミット**

```bash
git add packages/command/
git commit -m "chore(command): scaffold @zeltjs/command package"
```

---

### Task 12: Command メタデータストア

**Files:**
- Create: `packages/command/src/internal/metadata.ts`
- Test: `packages/command/src/internal/metadata.test.ts`

- [ ] **Step 1: テストファイル作成**

```typescript
// packages/command/src/internal/metadata.test.ts
import { describe, expect, it } from 'vitest';

import { getCommandMetadata, setCommandMetadata } from './metadata';

describe('command-metadata', () => {
  it('stores and retrieves command metadata', () => {
    class TestCommand {}
    setCommandMetadata(TestCommand, {
      name: 'test:run',
      description: 'A test command',
    });

    const meta = getCommandMetadata(TestCommand);
    expect(meta).toEqual({
      name: 'test:run',
      description: 'A test command',
    });
  });

  it('returns undefined for unmarked class', () => {
    class UnmarkedClass {}
    expect(getCommandMetadata(UnmarkedClass)).toBeUndefined();
  });
});
```

- [ ] **Step 2: テスト実行（失敗確認）**

Run: `cd /workspaces/github.com/zeltjs/zelt && pnpm test packages/command/src/internal/metadata.test.ts`
Expected: FAIL

- [ ] **Step 3: メタデータストア実装**

```typescript
// packages/command/src/internal/metadata.ts
export type CommandMetadata = {
  readonly name: string;
  readonly description?: string;
};

const commandStore = new WeakMap<object, CommandMetadata>();

export const setCommandMetadata = (cls: object, meta: CommandMetadata): void => {
  commandStore.set(cls, meta);
};

export const getCommandMetadata = (cls: object): CommandMetadata | undefined =>
  commandStore.get(cls);
```

- [ ] **Step 4: テスト実行（成功確認）**

Run: `cd /workspaces/github.com/zeltjs/zelt && pnpm test packages/command/src/internal/metadata.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add packages/command/src/internal/metadata.ts packages/command/src/internal/metadata.test.ts
git commit -m "feat(command): add command metadata store"
```

---

### Task 13: Command 型定義

**Files:**
- Create: `packages/command/src/types.ts`

- [ ] **Step 1: 型定義ファイル作成**

```typescript
// packages/command/src/types.ts
export type ArgDefinition = {
  readonly type: 'positional';
  readonly default?: string;
  readonly description?: string;
  readonly required?: boolean;
};

export type OptionDefinition = {
  readonly type: 'boolean' | 'string';
  readonly alias?: string;
  readonly default?: boolean | string;
  readonly description?: string;
};

export type ArgsDefinition = Record<string, ArgDefinition>;
export type OptionsDefinition = Record<string, OptionDefinition>;

type InferArgType<T extends ArgDefinition> = T['default'] extends string
  ? string
  : T['required'] extends true
    ? string
    : string | undefined;

type InferOptionType<T extends OptionDefinition> = T['type'] extends 'boolean'
  ? T['default'] extends boolean
    ? boolean
    : boolean | undefined
  : T['default'] extends string
    ? string
    : string | undefined;

export type InferArgs<T extends ArgsDefinition> = {
  [K in keyof T]: InferArgType<T[K]>;
};

export type InferOptions<T extends OptionsDefinition> = {
  [K in keyof T]: InferOptionType<T[K]>;
};

export type CommandContext<
  TArgs extends ArgsDefinition = ArgsDefinition,
  TOptions extends OptionsDefinition = OptionsDefinition,
> = {
  readonly args: InferArgs<TArgs>;
  readonly options: InferOptions<TOptions>;
};

export type CommandClass = new (...args: never[]) => {
  args?: ArgsDefinition;
  options?: OptionsDefinition;
  run(ctx: CommandContext): Promise<void> | void;
};
```

- [ ] **Step 2: 型チェック実行**

Run: `cd /workspaces/github.com/zeltjs/zelt && pnpm typecheck`
Expected: PASS

- [ ] **Step 3: コミット**

```bash
git add packages/command/src/types.ts
git commit -m "feat(command): add command type definitions"
```

---

### Task 14: @Command デコレータ

**Files:**
- Create: `packages/command/src/decorators/command.ts`
- Test: `packages/command/src/decorators/command.test.ts`

- [ ] **Step 1: テストファイル作成**

```typescript
// packages/command/src/decorators/command.test.ts
import { describe, expect, it } from 'vitest';

import { getCommandMetadata } from '../internal/metadata';

import { Command } from './command';

describe('@Command', () => {
  it('stores command metadata', () => {
    @Command({
      name: 'db:migrate',
      description: 'Run database migrations',
    })
    class MigrateCommand {
      async run() {}
    }

    const meta = getCommandMetadata(MigrateCommand);
    expect(meta).toEqual({
      name: 'db:migrate',
      description: 'Run database migrations',
    });
  });

  it('makes class injectable', () => {
    @Command({ name: 'test' })
    class TestCommand {
      async run() {}
    }

    expect(Reflect.getMetadata('needledi:injectable', TestCommand)).toBe(true);
  });

  it('works without description', () => {
    @Command({ name: 'simple' })
    class SimpleCommand {
      async run() {}
    }

    const meta = getCommandMetadata(SimpleCommand);
    expect(meta?.name).toBe('simple');
    expect(meta?.description).toBeUndefined();
  });
});
```

- [ ] **Step 2: テスト実行（失敗確認）**

Run: `cd /workspaces/github.com/zeltjs/zelt && pnpm test packages/command/src/decorators/command.test.ts`
Expected: FAIL

- [ ] **Step 3: デコレータ実装**

```typescript
// packages/command/src/decorators/command.ts
import { injectable } from '@needle-di/core';

import { setCommandMetadata, type CommandMetadata } from '../internal/metadata';

type AnyClass = new (...args: never[]) => object;

type CommandOptions = {
  readonly name: string;
  readonly description?: string;
};

export const Command =
  (options: CommandOptions) =>
  <T extends AnyClass>(target: T): T => {
    const meta: CommandMetadata = {
      name: options.name,
      description: options.description,
    };
    setCommandMetadata(target, meta);
    const wrapped: T | void = injectable<T>()(target);
    return wrapped ?? target;
  };
```

- [ ] **Step 4: テスト実行（成功確認）**

Run: `cd /workspaces/github.com/zeltjs/zelt && pnpm test packages/command/src/decorators/command.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add packages/command/src/decorators/command.ts packages/command/src/decorators/command.test.ts
git commit -m "feat(command): add @Command decorator"
```

---

### Task 15: Command パッケージエクスポート

**Files:**
- Modify: `packages/command/src/index.ts`

- [ ] **Step 1: index.ts にエクスポート追加**

```typescript
// packages/command/src/index.ts
export { Command } from './decorators/command';
export { getCommandMetadata, type CommandMetadata } from './internal/metadata';
export type {
  ArgsDefinition,
  CommandClass,
  CommandContext,
  InferArgs,
  InferOptions,
  OptionsDefinition,
} from './types';
```

- [ ] **Step 2: ビルド確認**

Run: `cd /workspaces/github.com/zeltjs/zelt && pnpm build`
Expected: PASS

- [ ] **Step 3: コミット**

```bash
git add packages/command/src/index.ts
git commit -m "feat(command): export command module"
```

---

## Phase 3: CLI Extension (packages/cli)

### Task 16: CLI config スキーマに commands 追加

**Files:**
- Modify: `packages/cli/src/config/schema.ts`
- Modify: `packages/cli/src/config/index.test.ts`

- [ ] **Step 1: スキーマに commands フィールド追加**

```typescript
// packages/cli/src/config/schema.ts の ZeltConfigSchema を修正
export const ZeltConfigSchema = v.object({
  openapi: v.optional(OpenApiConfigSchema),
  build: v.optional(BuildConfigSchema),
  dev: v.optional(DevConfigSchema),
  commands: v.optional(v.string()),  // 追加: glob pattern

  // Legacy top-level fields for backward compatibility
  controllers: v.optional(v.array(v.string())),
  dist: v.optional(v.string()),
  tsconfig: v.optional(v.string()),
});
```

- [ ] **Step 2: テスト追加**

```typescript
// packages/cli/src/config/index.test.ts に追加
it('accepts commands glob pattern', async () => {
  await fs.writeFile(
    configPath,
    `export default { commands: 'src/commands/**/*.ts' }`,
  );

  const result = await loadZeltConfig({ cwd: tmpDir });

  expect(result.isOk()).toBe(true);
  if (result.isOk()) {
    expect(result.value.commands).toBe('src/commands/**/*.ts');
  }
});
```

- [ ] **Step 3: テスト実行（成功確認）**

Run: `cd /workspaces/github.com/zeltjs/zelt && pnpm test packages/cli/src/config/index.test.ts`
Expected: PASS

- [ ] **Step 4: コミット**

```bash
git add packages/cli/src/config/schema.ts packages/cli/src/config/index.test.ts
git commit -m "feat(cli): add commands field to config schema"
```

---

### Task 17: CLI に @zeltjs/command 依存関係追加

**Files:**
- Modify: `packages/cli/package.json`

- [ ] **Step 1: 依存関係追加**

```bash
cd /workspaces/github.com/zeltjs/zelt && pnpm add @zeltjs/command tinyglobby@0.2.14 -F @zeltjs/cli
```

- [ ] **Step 2: コミット**

```bash
git add packages/cli/package.json pnpm-lock.yaml
git commit -m "deps(cli): add @zeltjs/command and tinyglobby"
```

---

### Task 18: Command Loader 実装

**Files:**
- Create: `packages/cli/src/commands/run/loader.ts`
- Test: `packages/cli/src/commands/run/loader.test.ts`

- [ ] **Step 1: テストファイル作成**

```typescript
// packages/cli/src/commands/run/loader.test.ts
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { loadCommands } from './loader';

describe('loadCommands', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zelt-cmd-test-'));
    await fs.mkdir(path.join(tmpDir, 'src', 'commands'), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('loads command classes from glob pattern', async () => {
    const commandFile = path.join(tmpDir, 'src', 'commands', 'test.ts');
    await fs.writeFile(
      commandFile,
      `
import { Command } from '@zeltjs/command';

@Command({ name: 'test:run' })
export class TestCommand {
  async run() {}
}
`,
    );

    const commands = await loadCommands(tmpDir, 'src/commands/**/*.ts');

    expect(commands.size).toBe(1);
    expect(commands.has('test:run')).toBe(true);
  });

  it('returns empty map when no commands found', async () => {
    const commands = await loadCommands(tmpDir, 'src/commands/**/*.ts');
    expect(commands.size).toBe(0);
  });

  it('handles multiple commands in one file', async () => {
    const commandFile = path.join(tmpDir, 'src', 'commands', 'db.ts');
    await fs.writeFile(
      commandFile,
      `
import { Command } from '@zeltjs/command';

@Command({ name: 'db:migrate' })
export class MigrateCommand {
  async run() {}
}

@Command({ name: 'db:seed' })
export class SeedCommand {
  async run() {}
}
`,
    );

    const commands = await loadCommands(tmpDir, 'src/commands/**/*.ts');

    expect(commands.size).toBe(2);
    expect(commands.has('db:migrate')).toBe(true);
    expect(commands.has('db:seed')).toBe(true);
  });
});
```

- [ ] **Step 2: テスト実行（失敗確認）**

Run: `cd /workspaces/github.com/zeltjs/zelt && pnpm test packages/cli/src/commands/run/loader.test.ts`
Expected: FAIL

- [ ] **Step 3: Loader 実装**

```typescript
// packages/cli/src/commands/run/loader.ts
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

import { getCommandMetadata, type CommandClass } from '@zeltjs/command';
import { glob } from 'tinyglobby';

export const loadCommands = async (
  cwd: string,
  pattern: string,
): Promise<Map<string, CommandClass>> => {
  const files = await glob(pattern, { cwd, absolute: true });
  const commandMap = new Map<string, CommandClass>();

  for (const file of files) {
    const fileUrl = pathToFileURL(file).href;
    const module = (await import(fileUrl)) as Record<string, unknown>;

    for (const exportValue of Object.values(module)) {
      if (typeof exportValue === 'function') {
        const meta = getCommandMetadata(exportValue);
        if (meta) {
          commandMap.set(meta.name, exportValue as CommandClass);
        }
      }
    }
  }

  return commandMap;
};
```

- [ ] **Step 4: テスト実行（成功確認）**

Run: `cd /workspaces/github.com/zeltjs/zelt && pnpm test packages/cli/src/commands/run/loader.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add packages/cli/src/commands/run/loader.ts packages/cli/src/commands/run/loader.test.ts
git commit -m "feat(cli): add command loader"
```

---

### Task 19: Command Runner 実装

**Files:**
- Create: `packages/cli/src/commands/run/runner.ts`
- Test: `packages/cli/src/commands/run/runner.test.ts`

- [ ] **Step 1: テストファイル作成**

```typescript
// packages/cli/src/commands/run/runner.test.ts
import { Command, type CommandContext } from '@zeltjs/command';
import { describe, expect, it, vi } from 'vitest';

import { runCommand } from './runner';

describe('runCommand', () => {
  it('executes command with parsed args and options', async () => {
    const runFn = vi.fn();

    @Command({ name: 'test' })
    class TestCommand {
      args = {
        name: { type: 'positional' as const, default: 'world' },
      } as const;

      options = {
        verbose: { type: 'boolean' as const, alias: 'v', default: false },
      } as const;

      async run(ctx: CommandContext<typeof this.args, typeof this.options>) {
        runFn(ctx);
      }
    }

    await runCommand(TestCommand, ['hello', '--verbose']);

    expect(runFn).toHaveBeenCalledWith({
      args: { name: 'hello' },
      options: { verbose: true },
    });
  });

  it('uses default values when args not provided', async () => {
    const runFn = vi.fn();

    @Command({ name: 'test' })
    class TestCommand {
      args = {
        name: { type: 'positional' as const, default: 'default-name' },
      } as const;

      options = {
        count: { type: 'string' as const, default: '10' },
      } as const;

      async run(ctx: CommandContext<typeof this.args, typeof this.options>) {
        runFn(ctx);
      }
    }

    await runCommand(TestCommand, []);

    expect(runFn).toHaveBeenCalledWith({
      args: { name: 'default-name' },
      options: { count: '10' },
    });
  });
});
```

- [ ] **Step 2: テスト実行（失敗確認）**

Run: `cd /workspaces/github.com/zeltjs/zelt && pnpm test packages/cli/src/commands/run/runner.test.ts`
Expected: FAIL

- [ ] **Step 3: Runner 実装**

```typescript
// packages/cli/src/commands/run/runner.ts
import type { CommandClass, CommandContext } from '@zeltjs/command';
import { Container } from '@needle-di/core';
import { parseArgs } from 'citty';

type ParsedArgs = {
  _: string[];
  [key: string]: unknown;
};

const buildCittyArgs = (
  commandClass: CommandClass,
): Record<string, { type: string; alias?: string; default?: unknown }> => {
  const instance = Object.create(commandClass.prototype) as {
    args?: Record<string, { type: string; default?: unknown }>;
    options?: Record<string, { type: string; alias?: string; default?: unknown }>;
  };

  const cittyArgs: Record<string, { type: string; alias?: string; default?: unknown }> = {};

  if (instance.args) {
    for (const [key, def] of Object.entries(instance.args)) {
      cittyArgs[key] = {
        type: 'positional',
        default: def.default,
      };
    }
  }

  if (instance.options) {
    for (const [key, def] of Object.entries(instance.options)) {
      cittyArgs[key] = {
        type: def.type,
        alias: def.alias,
        default: def.default,
      };
    }
  }

  return cittyArgs;
};

export const runCommand = async (
  commandClass: CommandClass,
  argv: string[],
): Promise<void> => {
  const cittyArgs = buildCittyArgs(commandClass);
  const parsed = parseArgs(argv, cittyArgs) as ParsedArgs;

  const container = new Container();
  const instance = container.get(commandClass);

  const positionalKeys = Object.keys(instance.args ?? {});
  const args: Record<string, string | undefined> = {};
  for (let i = 0; i < positionalKeys.length; i++) {
    const key = positionalKeys[i];
    if (key) {
      args[key] = (parsed._[i] as string | undefined) ?? (instance.args?.[key]?.default as string);
    }
  }

  const options: Record<string, unknown> = {};
  for (const key of Object.keys(instance.options ?? {})) {
    options[key] = parsed[key] ?? instance.options?.[key]?.default;
  }

  const ctx: CommandContext = { args, options } as CommandContext;
  await instance.run(ctx);
};
```

- [ ] **Step 4: テスト実行（成功確認）**

Run: `cd /workspaces/github.com/zeltjs/zelt && pnpm test packages/cli/src/commands/run/runner.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add packages/cli/src/commands/run/runner.ts packages/cli/src/commands/run/runner.test.ts
git commit -m "feat(cli): add command runner"
```

---

### Task 20: `zelt run` コマンド実装

**Files:**
- Create: `packages/cli/src/commands/run.ts`
- Modify: `packages/cli/src/commands/main.ts`

- [ ] **Step 1: run.ts 作成**

```typescript
// packages/cli/src/commands/run.ts
import { defineCommand } from 'citty';
import consola from 'consola';
import { match } from 'ts-pattern';

import { type ConfigLoadError, loadZeltConfig } from '../config/loader';

import { loadCommands } from './run/loader';
import { runCommand } from './run/runner';

type RunError =
  | ConfigLoadError
  | { type: 'NO_COMMANDS_CONFIG' }
  | { type: 'COMMAND_NOT_FOUND'; name: string }
  | { type: 'COMMAND_EXECUTION_FAILED'; error: unknown };

export const runCommandDef = defineCommand({
  meta: {
    name: 'run',
    description: 'Run a custom command',
  },
  args: {
    config: {
      type: 'string',
      alias: 'c',
      description: 'Path to zelt.config.ts',
    },
    command: {
      type: 'positional',
      description: 'Command name to run',
      required: true,
    },
  },
  async run({ args, rawArgs }) {
    const cwd = globalThis.process.cwd();
    const configFile = args.config as string | undefined;

    const configResult = await loadZeltConfig(
      configFile !== undefined ? { cwd, configFile } : { cwd },
    );

    if (configResult.isErr()) {
      const error = configResult.error;
      match(error)
        .with({ type: 'CONFIG_LOAD_FAILED' }, () => {
          consola.error('Failed to load config');
        })
        .exhaustive();
      return;
    }

    const config = configResult.value;

    if (!config.commands) {
      consola.error('No commands config found. Add "commands" to zelt.config.ts');
      return;
    }

    const commandName = args.command as string;
    const commands = await loadCommands(cwd, config.commands);

    const commandClass = commands.get(commandName);
    if (!commandClass) {
      consola.error(`Command not found: ${commandName}`);
      consola.info('Available commands:');
      for (const name of commands.keys()) {
        consola.info(`  - ${name}`);
      }
      return;
    }

    const commandArgs = rawArgs.slice(rawArgs.indexOf(commandName) + 1);

    try {
      await runCommand(commandClass, commandArgs);
    } catch (error) {
      consola.error('Command execution failed:', error);
    }
  },
});
```

- [ ] **Step 2: main.ts に run コマンド追加**

```typescript
// packages/cli/src/commands/main.ts
import { defineCommand } from 'citty';

import { buildCommand } from './build';
import { devCommand } from './dev';
import { runCommandDef } from './run';

export const mainCommand = defineCommand({
  meta: {
    name: 'zelt',
    version: '0.0.1',
    description: 'Zelt Framework CLI',
  },
  subCommands: {
    build: buildCommand,
    dev: devCommand,
    run: runCommandDef,
  },
});
```

- [ ] **Step 3: 型チェック実行**

Run: `cd /workspaces/github.com/zeltjs/zelt && pnpm typecheck`
Expected: PASS

- [ ] **Step 4: ビルド確認**

Run: `cd /workspaces/github.com/zeltjs/zelt && pnpm build`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add packages/cli/src/commands/run.ts packages/cli/src/commands/main.ts
git commit -m "feat(cli): add zelt run command"
```

---

### Task 21: E2E テスト

**Files:**
- Create: `packages/cli/src/commands/run.test.ts`

- [ ] **Step 1: E2Eテスト作成**

```typescript
// packages/cli/src/commands/run.test.ts
import { execSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('zelt run (e2e)', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zelt-run-e2e-'));
    await fs.mkdir(path.join(tmpDir, 'src', 'commands'), { recursive: true });

    await fs.writeFile(
      path.join(tmpDir, 'zelt.config.ts'),
      `export default { commands: 'src/commands/**/*.ts' }`,
    );

    await fs.writeFile(
      path.join(tmpDir, 'src', 'commands', 'hello.ts'),
      `
import { Command } from '@zeltjs/command';

@Command({ name: 'hello' })
export class HelloCommand {
  args = {
    name: { type: 'positional', default: 'World' },
  } as const;

  async run(ctx) {
    console.log('Hello, ' + ctx.args.name + '!');
  }
}
`,
    );
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('runs command with default args', () => {
    const result = execSync('npx zelt run hello', {
      cwd: tmpDir,
      encoding: 'utf-8',
    });

    expect(result).toContain('Hello, World!');
  });

  it('runs command with provided args', () => {
    const result = execSync('npx zelt run hello Claude', {
      cwd: tmpDir,
      encoding: 'utf-8',
    });

    expect(result).toContain('Hello, Claude!');
  });
});
```

- [ ] **Step 2: テスト実行（成功確認）**

Run: `cd /workspaces/github.com/zeltjs/zelt && pnpm test packages/cli/src/commands/run.test.ts`
Expected: PASS (or skip if environment setup is complex)

- [ ] **Step 3: コミット**

```bash
git add packages/cli/src/commands/run.test.ts
git commit -m "test(cli): add e2e tests for zelt run"
```

---

### Task 22: 全体テスト・ビルド確認

**Files:** None (verification only)

- [ ] **Step 1: 全テスト実行**

Run: `cd /workspaces/github.com/zeltjs/zelt && pnpm test`
Expected: All tests PASS

- [ ] **Step 2: 型チェック**

Run: `cd /workspaces/github.com/zeltjs/zelt && pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Lint**

Run: `cd /workspaces/github.com/zeltjs/zelt && pnpm lint`
Expected: PASS

- [ ] **Step 4: ビルド**

Run: `cd /workspaces/github.com/zeltjs/zelt && pnpm build`
Expected: PASS

- [ ] **Step 5: 最終コミット（必要に応じて）**

```bash
git status
# 必要に応じて残りの変更をコミット
```
