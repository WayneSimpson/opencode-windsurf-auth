import { describe, expect, test } from 'bun:test';
import { resolveWindsurfProxyPort } from '../../src/plugin.js';

describe('resolveWindsurfProxyPort', () => {
  test('keeps the standalone service default', () => {
    expect(resolveWindsurfProxyPort({})).toBe(42100);
  });

  test('uses a dynamic port for Paseo agents', () => {
    expect(resolveWindsurfProxyPort({ PASEO_AGENT_ID: 'agent-a' })).toBe(0);
    expect(resolveWindsurfProxyPort({ PASEO_WEB_UI_ENABLED: 'true' })).toBe(0);
  });

  test('preserves the desktop default when not running under Paseo', () => {
    expect(resolveWindsurfProxyPort({ OPENCODE_CLIENT: 'desktop' })).toBe(42101);
  });

  test('honours valid explicit ports including OS-assigned port zero', () => {
    expect(resolveWindsurfProxyPort({ WINDSURF_PROXY_PORT: '42102' })).toBe(42102);
    expect(resolveWindsurfProxyPort({ WINDSURF_PROXY_PORT: '0', PASEO_AGENT_ID: 'agent-a' })).toBe(0);
  });

  test('falls back safely for invalid explicit ports', () => {
    expect(resolveWindsurfProxyPort({ WINDSURF_PROXY_PORT: '-1' })).toBe(42100);
    expect(resolveWindsurfProxyPort({ WINDSURF_PROXY_PORT: '65536', PASEO_AGENT_ID: 'agent-a' })).toBe(0);
    expect(resolveWindsurfProxyPort({ WINDSURF_PROXY_PORT: 'not-a-port', OPENCODE_CLIENT: 'desktop' })).toBe(42101);
  });
});
