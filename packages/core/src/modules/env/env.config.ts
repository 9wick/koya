import { Config } from '../../config';

@Config
export class EnvConfig {
  static readonly Token = EnvConfig;

  get(_key: string): string | undefined {
    return undefined;
  }
}
