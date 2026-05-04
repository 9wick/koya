import { afterEach, describe, expect, it } from 'vitest';
import type { ServerType } from '@hono/node-server';

import { serve } from './index';

const createMockApp = () => ({
  fetch: async (req: Request) => new Response(`Hello from ${req.url}`),
  request: async () => new Response(''),
});

const waitForListening = (server: ServerType): Promise<void> =>
  new Promise((resolve) => {
    if (server.listening) {
      resolve();
    } else {
      server.once('listening', () => resolve());
    }
  });

describe('serve', () => {
  let server: ServerType | undefined;

  afterEach(() => {
    server?.close();
  });

  it('returns http.Server and listens on default port 3000', async () => {
    const app = createMockApp();
    server = serve(app);

    await waitForListening(server);

    expect(server).toBeDefined();
    expect(server.listening).toBe(true);

    const address = server.address();
    expect(address).not.toBeNull();
    expect(typeof address === 'object' && address?.port).toBe(3000);
  });

  it('listens on specified port', async () => {
    const app = createMockApp();
    server = serve(app, { port: 4567 });

    await waitForListening(server);

    expect(server.listening).toBe(true);

    const address = server.address();
    expect(typeof address === 'object' && address?.port).toBe(4567);
  });

  it('invokes callback with AddressInfo when options provided', async () => {
    const app = createMockApp();
    let receivedInfo: { port: number; address: string } | undefined;

    server = serve(app, { port: 5678 }, (info) => {
      receivedInfo = info;
    });

    await waitForListening(server);

    expect(receivedInfo).toBeDefined();
    expect(receivedInfo?.port).toBe(5678);
    expect(typeof receivedInfo?.address).toBe('string');
  });

  it('invokes callback when passed as second argument', async () => {
    const app = createMockApp();
    let receivedInfo: { port: number; address: string } | undefined;

    server = serve(app, (info) => {
      receivedInfo = info;
    });

    await waitForListening(server);

    expect(receivedInfo).toBeDefined();
    expect(receivedInfo?.port).toBe(3000);
  });

  it('responds to HTTP requests', async () => {
    const app = createMockApp();
    server = serve(app, { port: 6789 });

    await waitForListening(server);

    const response = await fetch('http://localhost:6789/hello');
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(text).toBe('Hello from http://localhost:6789/hello');
  });
});

describe('createAdaptorServer', () => {
  it('is exported from the module', async () => {
    const { createAdaptorServer } = await import('./index');
    expect(createAdaptorServer).toBeDefined();
    expect(typeof createAdaptorServer).toBe('function');
  });
});
