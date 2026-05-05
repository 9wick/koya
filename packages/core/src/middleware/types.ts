import type { Context, Env, Input, MiddlewareHandler } from 'hono';

export type FunctionMiddleware = MiddlewareHandler<Env, string, Input>;

export type MiddlewareClass = new (...args: never[]) => MiddlewareInstance;

export type KoyaContext = Context<Env, string, Input>;
export type KoyaNext = () => Promise<void>;

export type MiddlewareInstance = {
  use(c: KoyaContext, next: KoyaNext): Promise<Response | undefined>;
};

export type MiddlewareInput = FunctionMiddleware | MiddlewareClass;

export type MiddlewareIdentifier = FunctionMiddleware | MiddlewareClass;
