import { afterEach, describe, expect, it, vi } from 'vitest';

import { Cron } from '../decorators/cron';
import { Scheduled } from '../decorators/scheduled';

import { createHttpApp, type HttpApp } from './app';

describe('createHttpApp with schedulers', () => {
  let app: HttpApp | undefined;

  afterEach(async () => {
    if (app) {
      await app.shutdown();
      app = undefined;
    }
  });

  it('accepts schedulers option', async () => {
    @Scheduled()
    class TestScheduler {
      @Cron('0 * * * *')
      hourlyTask() {}
    }

    app = await createHttpApp({
      controllers: [],
      schedulers: [TestScheduler],
    });

    expect(app.shutdown).toBeDefined();
    expect(app.startScheduler).toBeDefined();
    expect(app.stopScheduler).toBeDefined();
  });

  it('scheduler runs automatically after createHttpApp', async () => {
    const taskFn = vi.fn();

    @Scheduled()
    class TestScheduler {
      @Cron('* * * * * *')
      everySecond() {
        taskFn();
      }
    }

    app = await createHttpApp({
      controllers: [],
      schedulers: [TestScheduler],
    });

    await vi.waitFor(() => expect(taskFn).toHaveBeenCalled(), { timeout: 2000 });
  });

  it('works without schedulers option', async () => {
    app = await createHttpApp({
      controllers: [],
    });

    expect(app.shutdown).toBeDefined();
  });

  it('deprecated startScheduler/stopScheduler work for backward compatibility', async () => {
    const localApp = await createHttpApp({
      controllers: [],
    });
    app = localApp;

    expect(() => localApp.startScheduler()).not.toThrow();
    await expect(localApp.stopScheduler()).resolves.toBeUndefined();
  });
});
