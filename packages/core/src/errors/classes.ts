import { createErrorClass } from './factory';

export const ZeltDecoratorUsageError = createErrorClass('ZeltDecoratorUsageError');
export const ZeltLifecycleStateError = createErrorClass('ZeltLifecycleStateError');
export const ZeltContextNotAvailableError = createErrorClass('ZeltContextNotAvailableError');
export const ZeltAppConfigurationError = createErrorClass('ZeltAppConfigurationError');
export const ZeltRouteConfigurationError = createErrorClass('ZeltRouteConfigurationError');
export const ZeltMiddlewareExecutionError = createErrorClass('ZeltMiddlewareExecutionError');
export const ZeltNotImplementedError = createErrorClass('ZeltNotImplementedError');
export const ZeltSchemaValidationError = createErrorClass('ZeltSchemaValidationError');
