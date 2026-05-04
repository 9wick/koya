import type { Context, MiddlewareHandler, Next } from 'hono';

export type FunctionMiddleware = MiddlewareHandler;

export type MiddlewareClass = new (...args: never[]) => MiddlewareInstance;

export type MiddlewareInstance = {
  use(c: Context, next: Next): Promise<Response | undefined>;
};

export type MiddlewareInput = FunctionMiddleware | MiddlewareClass;

export type MiddlewareIdentifier = FunctionMiddleware | MiddlewareClass;
