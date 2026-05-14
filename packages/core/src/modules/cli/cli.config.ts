import { Config } from '../../config';
import { ZeltNotImplementedError } from '../../errors';

export type Signal = 'SIGINT' | 'SIGTERM';
export type SignalHandler = () => void;

@Config
export class CliConfig {
  cwd(): string {
    throw new ZeltNotImplementedError({ className: 'CliConfig', methodName: 'cwd' });
  }

  argv(): readonly string[] {
    throw new ZeltNotImplementedError({ className: 'CliConfig', methodName: 'argv' });
  }

  exit(_code: number): never {
    throw new ZeltNotImplementedError({ className: 'CliConfig', methodName: 'exit' });
  }

  setExitCode(_code: number): void {
    throw new ZeltNotImplementedError({ className: 'CliConfig', methodName: 'setExitCode' });
  }

  onSignal(_signal: Signal, _handler: SignalHandler): void {
    throw new ZeltNotImplementedError({ className: 'CliConfig', methodName: 'onSignal' });
  }

  offSignal(_signal: Signal, _handler: SignalHandler): void {
    throw new ZeltNotImplementedError({ className: 'CliConfig', methodName: 'offSignal' });
  }
}
