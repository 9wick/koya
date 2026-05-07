import { injectable } from '@needle-di/core';

export interface Disposable {
  shutdown(): Promise<void>;
}

export interface Lifecycle extends Disposable {
  startup(): Promise<void>;
}

@injectable()
export class LifecycleManager {
  private readonly lifecycles: Lifecycle[] = [];

  register(lifecycle: Lifecycle): void {
    this.lifecycles.push(lifecycle);
  }

  async startup(): Promise<void> {
    for (const lc of this.lifecycles) {
      await lc.startup();
    }
  }

  async shutdown(): Promise<void> {
    for (const lc of [...this.lifecycles].reverse()) {
      await lc.shutdown();
    }
  }
}
