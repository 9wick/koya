import { Config, EnvConfig } from '@zeltjs/core';
import { config } from 'dotenv';

@Config
export class DotEnvConfig extends EnvConfig {
  protected readonly paths: string[] = ['.env'];

  constructor() {
    super();
    for (const path of this.paths) {
      config({ path, override: true });
    }
  }
}
