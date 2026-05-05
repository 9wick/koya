import { Container } from '@needle-di/core';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { Config } from '../../config';

import { LoggerConfig } from './config';
import { Logger } from './logger';

describe('Logger', () => {
  const consoleSpy = vi.spyOn(console, 'log');

  beforeEach(() => {
    consoleSpy.mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockReset();
  });

  it('logs info by default', () => {
    const container = new Container();
    const logger = container.get(Logger);

    logger.info('test message');
    expect(consoleSpy).toHaveBeenCalledWith('[INFO] test message');
  });

  it('respects log level from config', () => {
    @Config
    class WarnConfig extends LoggerConfig {
      override get level(): 'debug' | 'info' | 'warn' | 'error' {
        return 'warn';
      }
    }

    const container = new Container();
    container.bind(WarnConfig);
    container.bind({ provide: LoggerConfig, useExisting: WarnConfig });

    const logger = container.get(Logger);

    logger.info('should not log');
    expect(consoleSpy).not.toHaveBeenCalled();

    logger.warn('should log');
    expect(consoleSpy).toHaveBeenCalledWith('[WARN] should log');
  });

  it('logs debug when level is debug', () => {
    @Config
    class DebugConfig extends LoggerConfig {
      override get level(): 'debug' | 'info' | 'warn' | 'error' {
        return 'debug';
      }
    }

    const container = new Container();
    container.bind(DebugConfig);
    container.bind({ provide: LoggerConfig, useExisting: DebugConfig });

    const logger = container.get(Logger);

    logger.debug('debug message');
    expect(consoleSpy).toHaveBeenCalledWith('[DEBUG] debug message');
  });
});
