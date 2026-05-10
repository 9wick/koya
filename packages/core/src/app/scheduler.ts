import { LifecycleManager } from '../lifecycle';
import { createSchedulerRunner, type SchedulerRunner } from '../scheduler/runner';

import type { SchedulerClass } from './types';

type Resolver = { get: <T extends object>(cls: new (...args: never[]) => T) => T };

export const registerScheduler = (
  schedulers: readonly SchedulerClass[] | undefined,
  resolver: Resolver,
  lifecycle: LifecycleManager,
): SchedulerRunner | undefined => {
  if (!schedulers || schedulers.length === 0) return undefined;
  const runner = createSchedulerRunner(schedulers, resolver);
  lifecycle.register(runner);
  return runner;
};
