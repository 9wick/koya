import { injectable } from '@needle-di/core';
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import { Controller } from '../decorators/controller';
import { Get, Post } from '../decorators/http-method';
import { inject } from '../primitives/inject';
import { pathParam } from '../primitives/path-param';
import { validated } from '../primitives/validated';

import { createHttpApp } from './app';

@injectable()
class Greeter {
  greet(name: string) {
    return `hello, ${name}`;
  }
}

@Controller('/hello')
class HelloController {
  constructor(private greeter = inject(Greeter)) {}

  @Get('/:name')
  greet() {
    return { message: this.greeter.greet(pathParam('name')) };
  }
}

@Controller('/echo')
class EchoController {
  @Post('/')
  create() {
    return validated(v.object({ msg: v.string() }));
  }
}

const buildApp = () => createHttpApp({ controllers: [HelloController, EchoController] });

describe('createHttpApp() — fetch', () => {
  it('serves a constructor-injected GET endpoint with pathParam', async () => {
    const app = buildApp();
    const res = await app.fetch(new Request('https://example.com/hello/koya'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ message: 'hello, koya' });
  });

  it('parses JSON body via validated()', async () => {
    const app = buildApp();
    const res = await app.fetch(
      new Request('https://example.com/echo/', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ msg: 'ok' }),
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ msg: 'ok' });
  });

  it('mounts multiple controllers under different base paths', async () => {
    const app = buildApp();
    const a = await app.fetch(new Request('https://example.com/hello/x'));
    const b = await app.fetch(
      new Request('https://example.com/echo/', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ msg: 'y' }),
      }),
    );
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
  });

  it('throws at createHttpApp() construction when a controller is missing @Controller', () => {
    class NoDecorator {
      @Get('/')
      list() {}
    }
    new NoDecorator();
    expect(() => createHttpApp({ controllers: [NoDecorator] })).toThrow(/missing @Controller/);
  });
});

describe('createHttpApp() — request', () => {
  it('accepts a path string with no init (defaults to GET)', async () => {
    const app = buildApp();
    const res = await app.request('/hello/koya');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ message: 'hello, koya' });
  });

  it('accepts a path string with init for POST + JSON body', async () => {
    const app = buildApp();
    const res = await app.request('/echo/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ msg: 'ok' }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ msg: 'ok' });
  });

  it('accepts a raw Request instance', async () => {
    const app = buildApp();
    const res = await app.request(new Request('https://x/hello/koya'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ message: 'hello, koya' });
  });

  it('ignores init when input is a Request (Request takes precedence)', async () => {
    const app = buildApp();
    // Request の method は GET、init で POST を指定しても Request 側が優先される
    const res = await app.request(new Request('https://x/hello/koya'), { method: 'POST' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ message: 'hello, koya' });
  });
});

describe('error paths', () => {
  it('returns 400 when validated() rejects the body', async () => {
    const app = buildApp();
    const res = await app.fetch(
      new Request('https://example.com/echo/', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ msg: 42 }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 for malformed JSON body (validated() sees undefined)', async () => {
    const app = buildApp();
    const res = await app.fetch(
      new Request('https://example.com/echo/', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: 'not-json',
      }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 500 when pathParam() asks for a missing parameter', async () => {
    @Controller('/x')
    class BrokenController {
      @Get('/')
      run() {
        return { v: pathParam('id') };
      }
    }
    const app = createHttpApp({ controllers: [BrokenController] });
    const res = await app.fetch(new Request('https://example.com/x/'));
    expect(res.status).toBe(500);
  });
});
