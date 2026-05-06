import { Config } from '../../config';

@Config
export class EnvConfig {
  static readonly Token = EnvConfig;

  get(_key: string): string | undefined {
    throw new Error('EnvConfig.get() must be implemented by subclass');
  }
}

@Config
export class ProcessEnvConfig extends EnvConfig {
  override get(key: string): string | undefined {
    return process.env[key];
  }
}
