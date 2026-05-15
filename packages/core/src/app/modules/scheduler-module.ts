import type { SchedulerRunner } from '../../scheduler/runner';
import { createSchedulerRunner } from '../../scheduler/runner';
import type { Module, ReadyContext } from '../module';

export type SchedulerClass = new (...args: never[]) => object;

export type SchedulerModule = Module & {
  readonly startScheduler: () => Promise<void>;
  readonly stopScheduler: () => Promise<void>;
};

export const createSchedulerModule = (schedulers: readonly SchedulerClass[]): SchedulerModule => {
  let runner: SchedulerRunner | undefined;

  const setup = (): void => {};

  const ready = async (context: ReadyContext): Promise<void> => {
    if (schedulers.length === 0) return;
    runner = createSchedulerRunner(schedulers, context.resolver);
  };

  const startScheduler = async (): Promise<void> => {
    if (runner && !runner.isRunning()) {
      await runner.startup();
    }
  };

  const stopScheduler = async (): Promise<void> => {
    if (runner?.isRunning()) {
      await runner.shutdown();
    }
  };

  const shutdown = async (): Promise<void> => {
    await stopScheduler();
  };

  return {
    setup,
    ready,
    shutdown,
    startScheduler,
    stopScheduler,
  };
};
