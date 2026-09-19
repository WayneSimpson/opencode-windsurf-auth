import { afterAll, describe, expect, test } from 'bun:test';
import * as http from 'http';
import type { AddressInfo } from 'net';
import {
  getOpenClawToken,
  resolveOpenClawPort,
  resolveOpenClawHost,
  createStaticTokenAuthorizer,
  createProxyHandler,
  startLoopbackServer,
} from '../../src/plugin.js';

const TEST_TOKEN = 'test-openclaw-token-0123456789abcdef';

describe('resolveOpenClawPort', () => {
  test('defaults to 42102', () => {
    expect(resolveOpenClawPort({})).toBe(42102);
  });

  test('honours a valid explicit port including OS-assigned zero', () => {
    expect(resolveOpenClawPort({ WINDSURF_OPENCLAW_PORT: '42199' })).toBe(42199);
    expect(resolveOpenClawPort({ WINDSURF_OPENCLAW_PORT: '0' })).toBe(0);
  });

  test('falls back to the default for invalid values', () => {
    expect(resolveOpenClawPort({ WINDSURF_OPENCLAW_PORT: '-1' })).toBe(42102);
    expect(resolveOpenClawPort({ WINDSURF_OPENCLAW_PORT: '65536' })).toBe(42102);
    expect(resolveOpenClawPort({ WINDSURF_OPENCLAW_PORT: 'nope' })).toBe(42102);
  });
});

describe('resolveOpenClawHost', () => {
  test('defaults to loopback for safety/backwards compatibility', () => {
    expect(resolveOpenClawHost({})).toBe('127.0.0.1');
    expect(resolveOpenClawHost({ WINDSURF_OPENCLAW_HOST: '' })).toBe('127.0.0.1');
  });

  test('honours an explicit IP or hostname', () => {
    expect(resolveOpenClawHost({ WINDSURF_OPENCLAW_HOST: '100.102.46.68' })).toBe('100.102.46.68');
    expect(resolveOpenClawHost({ WINDSURF_OPENCLAW_HOST: 'media-server.tail9c6d49.ts.net' })).toBe(
      'media-server.tail9c6d49.ts.net',
    );
    expect(resolveOpenClawHost({ WINDSURF_OPENCLAW_HOST: '::1' })).toBe('::1');
  });

  test('rejects invalid hosts', () => {
    expect(() => resolveOpenClawHost({ WINDSURF_OPENCLAW_HOST: 'not a host!' })).toThrow();
    expect(() => resolveOpenClawHost({ WINDSURF_OPENCLAW_HOST: 'http://evil.com' })).toThrow();
    expect(() => resolveOpenClawHost({ WINDSURF_OPENCLAW_HOST: 'bad_host' })).toThrow();
  });
});

describe('getOpenClawToken', () => {
  test('returns null when unset or empty (disabled by default)', () => {
    expect(getOpenClawToken({})).toBeNull();
    expect(getOpenClawToken({ WINDSURF_OPENCLAW_TOKEN: '' })).toBeNull();
  });

  test('returns the configured token', () => {
    expect(getOpenClawToken({ WINDSURF_OPENCLAW_TOKEN: 'abc123' })).toBe('abc123');
  });

  test('rejects unusable tokens', () => {
    expect(() => getOpenClawToken({ WINDSURF_OPENCLAW_TOKEN: '   ' })).toThrow();
    expect(() => getOpenClawToken({ WINDSURF_OPENCLAW_TOKEN: 'tok\nen' })).toThrow();
  });
});

describe('openclaw listener (ephemeral ports)', () => {
  const servers: Array<{ close(): void }> = [];
  afterAll(() => {
    for (const s of servers) {
      try { s.close(); } catch { /* already closed */ }
    }
  });

  async function start(token: string | null): Promise<{ port: number }> {
    if (token === null) throw new Error('token required to start');
    const handler = createProxyHandler(createStaticTokenAuthorizer(token));
    const server = await startLoopbackServer(handler, 0);
    servers.push(server);
    return server;
  }

  test('health endpoint is unauthenticated', async () => {
    const { port } = await start(TEST_TOKEN);
    const res = await fetch(`http://127.0.0.1:${port}/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  test('rejects /v1/* without a Bearer token', async () => {
    const { port } = await start(TEST_TOKEN);
    const res = await fetch(`http://127.0.0.1:${port}/v1/models`);
    expect(res.status).toBe(401);
  });

  test('rejects /v1/* with the wrong Bearer token', async () => {
    const { port } = await start(TEST_TOKEN);
    const res = await fetch(`http://127.0.0.1:${port}/v1/models`, {
      headers: { authorization: 'Bearer wrong-token' },
    });
    expect(res.status).toBe(401);
  });

  test('rejects a non-loopback Origin even with a valid token', async () => {
    const { port } = await start(TEST_TOKEN);
    const res = await fetch(`http://127.0.0.1:${port}/v1/models`, {
      headers: {
        authorization: `Bearer ${TEST_TOKEN}`,
        origin: 'https://evil.example.com',
      },
    });
    expect(res.status).toBe(403);
  });

  test('accepts the static token and reaches the handler', async () => {
    const { port } = await start(TEST_TOKEN);
    // /v1/models with a valid token gets past auth; upstream resolution
    // will fail without credentials, so accept anything that isn't 401/403.
    const res = await fetch(`http://127.0.0.1:${port}/v1/models`, {
      headers: { authorization: `Bearer ${TEST_TOKEN}` },
    });
    expect([200, 500, 503]).toContain(res.status);
  });

  test('unknown paths still require auth then 404', async () => {
    const { port } = await start(TEST_TOKEN);
    const unauth = await fetch(`http://127.0.0.1:${port}/nope`);
    expect(unauth.status).toBe(401);
    const auth = await fetch(`http://127.0.0.1:${port}/nope`, {
      headers: { authorization: `Bearer ${TEST_TOKEN}` },
    });
    expect(auth.status).toBe(404);
  });

  test('two listeners coexist on independent ports with independent tokens', async () => {
    const a = await start('token-for-listener-a');
    const b = await start('token-for-listener-b');
    expect(a.port).not.toBe(b.port);

    // A's token must not open B and vice versa.
    const cross = await fetch(`http://127.0.0.1:${b.port}/v1/models`, {
      headers: { authorization: 'Bearer token-for-listener-a' },
    });
    expect(cross.status).toBe(401);
    const ok = await fetch(`http://127.0.0.1:${b.port}/health`);
    expect(ok.status).toBe(200);
  });

  test('explicit bind host is honoured (still authenticates)', async () => {
    const handler = createProxyHandler(createStaticTokenAuthorizer(TEST_TOKEN));
    const server = await startLoopbackServer(handler, 0, '127.0.0.1');
    servers.push(server);
    const res = await fetch(`http://127.0.0.1:${server.port}/v1/models`, {
      headers: { authorization: `Bearer ${TEST_TOKEN}` },
    });
    expect([200, 500, 503]).toContain(res.status);
    const unauth = await fetch(`http://127.0.0.1:${server.port}/v1/models`);
    expect(unauth.status).toBe(401);
  });

  test('a non-loopback bind still enforces the Bearer token', async () => {
    // Bind to the machine's first non-loopback IPv4 (if any) to prove auth
    // isn't weakened when the OpenClaw listener is exposed to a peer.
    const { networkInterfaces } = await import('os');
    const ext = Object.values(networkInterfaces())
      .flat()
      .find((i) => i && i.family === 'IPv4' && !i.internal)?.address;
    if (!ext) return; // single-interface host — nothing to test
    const handler = createProxyHandler(createStaticTokenAuthorizer(TEST_TOKEN));
    let server: { port: number; close(): void };
    try {
      server = await startLoopbackServer(handler, 0, ext);
    } catch {
      return; // can't bind that interface in this environment — skip
    }
    servers.push(server);
    const unauth = await fetch(`http://${ext}:${server.port}/v1/models`);
    expect(unauth.status).toBe(401);
    const auth = await fetch(`http://${ext}:${server.port}/health`);
    expect(auth.status).toBe(200);
  });

  test('an invalid host fails only that bind — other listeners unaffected', async () => {
    const handler = createProxyHandler(createStaticTokenAuthorizer(TEST_TOKEN));
    // 'bogus host' isn't a valid bind address; the listen call must reject.
    await expect(startLoopbackServer(handler, 0, 'bogus host')).rejects.toThrow();
    // And a normal loopback listener started afterwards still works fine.
    const ok = await startLoopbackServer(handler, 0);
    servers.push(ok);
    const res = await fetch(`http://127.0.0.1:${ok.port}/health`);
    expect(res.status).toBe(200);
  });

  test('binding an occupied port fails without touching the first listener', async () => {
    // Occupy a port with a plain Node server, then try to bind our listener
    // on the same port — must reject, and the squatter keeps working.
    const squatter = http.createServer((_req, res) => {
      res.statusCode = 200;
      res.end('squatter');
    });
    await new Promise<void>((r) => squatter.listen(0, '127.0.0.1', r));
    const squatterPort = (squatter.address() as AddressInfo).port;
    try {
      const handler = createProxyHandler(createStaticTokenAuthorizer(TEST_TOKEN));
      await expect(startLoopbackServer(handler, squatterPort)).rejects.toThrow();

      const res = await fetch(`http://127.0.0.1:${squatterPort}/health`);
      expect(res.status).toBe(200);
      expect(await res.text()).toBe('squatter');
    } finally {
      await new Promise<void>((r) => squatter.close(() => r()));
    }
  });
});
