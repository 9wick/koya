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
