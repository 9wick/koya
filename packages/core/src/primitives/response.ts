import type { Context, TypedResponse } from 'hono';

import { getEntryContext } from '../internal/entry-context';

// Mirrors hono's StatusCode union; kept local to avoid depending on a non-public subpath export.
type StatusCode =
  | 100
  | 101
  | 102
  | 103
  | 200
  | 201
  | 202
  | 203
  | 204
  | 205
  | 206
  | 207
  | 208
  | 226
  | 300
  | 301
  | 302
  | 303
  | 304
  | 305
  | 306
  | 307
  | 308
  | 400
  | 401
  | 402
  | 403
  | 404
  | 405
  | 406
  | 407
  | 408
  | 409
  | 410
  | 411
  | 412
  | 413
  | 414
  | 415
  | 416
  | 417
  | 418
  | 421
  | 422
  | 423
  | 424
  | 425
  | 426
  | 428
  | 429
  | 431
  | 451
  | 500
  | 501
  | 502
  | 503
  | 504
  | 505
  | 506
  | 507
  | 508
  | 510
  | 511
  | -1;

type RedirectStatusCode = 300 | 301 | 302 | 303 | 304 | 305 | 306 | 307 | 308;

// Mirrors hono's ContentfulStatusCode = Exclude<StatusCode, 101 | 204 | 205 | 304>.
type ContentfulStatusCode = Exclude<StatusCode, 101 | 204 | 205 | 304>;

export type ResponseBuilder = {
  json<T, S extends ContentfulStatusCode = 200>(
    data: T,
    status?: S,
    headers?: Record<string, string>,
  ): TypedResponse<T, S, 'json'>;

  redirect<S extends RedirectStatusCode = 302>(
    url: string,
    status?: S,
  ): TypedResponse<undefined, S, 'redirect'>;

  text<T extends string, S extends ContentfulStatusCode = 200>(
    data: T,
    status?: S,
  ): TypedResponse<T, S, 'text'>;

  body<T extends BodyInit, S extends ContentfulStatusCode = 200>(
    data: T,
    status?: S,
  ): TypedResponse<T, S, 'body'>;

  header(name: string, value: string): ResponseBuilder;
};

// Minimal structural view of hono Context for building responses.
type ResponseContext = Pick<Context, 'json' | 'redirect' | 'text' | 'body' | 'header'>;

// Function overloads declare the public contract; the implementation signature is
// intentionally wider so that delegation to hono's overloaded methods type-checks
// without requiring an `as` assertion on the return value.
function makeJson(c: ResponseContext): ResponseBuilder['json'] {
  function json<T, S extends ContentfulStatusCode = 200>(
    data: T,
    status?: S,
    headers?: Record<string, string>,
  ): TypedResponse<T, S, 'json'>;
  function json(data: unknown, status?: ContentfulStatusCode, headers?: Record<string, string>) {
    return c.json(data, status, headers);
  }
  return json;
}

function makeRedirect(c: ResponseContext): ResponseBuilder['redirect'] {
  function redirect<S extends RedirectStatusCode = 302>(
    url: string,
    status?: S,
  ): TypedResponse<undefined, S, 'redirect'>;
  function redirect(url: string, status?: RedirectStatusCode) {
    return c.redirect(url, status);
  }
  return redirect;
}

function makeText(c: ResponseContext): ResponseBuilder['text'] {
  function text<T extends string, S extends ContentfulStatusCode = 200>(
    data: T,
    status?: S,
  ): TypedResponse<T, S, 'text'>;
  function text(data: string, status?: ContentfulStatusCode) {
    return c.text(data, status);
  }
  return text;
}

function makeBody(c: ResponseContext): ResponseBuilder['body'] {
  function body<T extends BodyInit, S extends ContentfulStatusCode = 200>(
    data: T,
    status?: S,
  ): TypedResponse<T, S, 'body'>;
  function body(data: string | ArrayBuffer | ReadableStream, status?: ContentfulStatusCode) {
    return c.body(data, status);
  }
  return body;
}

const buildResponseBuilder = (c: ResponseContext): ResponseBuilder => {
  const builder: ResponseBuilder = {
    json: makeJson(c),
    redirect: makeRedirect(c),
    text: makeText(c),
    body: makeBody(c),
    header: (name, value) => {
      c.header(name, value);
      return builder;
    },
  };
  return builder;
};

export const response = (): ResponseBuilder => {
  const ctx = getEntryContext();
  return buildResponseBuilder(ctx.honoContext);
};
