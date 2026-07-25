# Changelog

### 2026-07-24 20:51:44 +01:00 — Make Paseo Windsurf proxies process-safe
- Type: Fixed
- Scope: api
- Files:
  - src/plugin.ts: use an OS-assigned loopback port for Paseo OpenCode children while preserving the 42100 fallback and explicit overrides
  - tests/unit/proxy-port.test.ts: cover standalone, Paseo, desktop, explicit, and invalid port selection
- Rationale: Paseo launches multiple OpenCode children, so a shared 42102 proxy port caused EADDRINUSE and provider failures.
- Risk/Impact: Paseo child proxy ports become dynamic; standalone web and CLI defaults remain compatible.
- Rollback hint: restore the previous plugin build and reinstate the Paseo proxy environment override if required.
- Notes: `chat.params` continues to inject the actual process-local base URL.

### 2026-07-21 17:15:00 +01:00 — Configurable proxy port for multi-process support
- Type: Added
- Scope: api
- Files:
  - src/plugin.ts: Make WINDSURF_PROXY_PORT configurable via env var; auto-detect desktop app via OPENCODE_CLIENT=desktop and use port 42101; update EADDRINUSE error message with guidance
- Rationale: Running both the systemd web service and the desktop app's serve process caused EADDRINUSE on the fixed port 42100. The plugin's chat.params hook already injects baseURL dynamically, so each process can use a different port without config file changes. Auto-detection means zero configuration — the desktop app process gets 42101 automatically.
- Risk/Impact: None — defaults to 42100 for web service / CLI (fully backward compatible). Desktop app gets 42101 automatically.
- Rollback hint: Unset WINDSURF_PROXY_PORT or revert plugin.ts to previous revision
- Notes: Explicit WINDSURF_PROXY_PORT env var always wins over auto-detection.

### 2026-07-21 17:10:00 +01:00 — Fix parallel subagent TTFB timeouts
- Type: Fixed
- Scope: api
- Files:
  - src/cloud-direct/chat.ts: Always allocate a fresh cascadeId per request when caller doesn't provide one; increase TTFB timeout from 60s to 120s
- Rationale: Concurrent opencode subagents shared a cached cascadeId keyed by (apiKey, host), causing cloud-side serialization. The second request waited behind the first, and with 54K+ token prompts taking 50+ seconds to first byte, the 60s TTFB timer fired falsely. Fresh cascadeIds let requests proceed in parallel; the higher timeout accommodates legitimately slow first-turn processing.
- Risk/Impact: Losing cross-turn cascade context (prompt cache on cascade level). SessionId still cached for prompt-cache benefits. No breaking changes — callers passing explicit cascadeId are unaffected.
- Rollback hint: Revert chat.ts to previous revision (restore `cascadeId: sessionIds.cascadeId` and `CLOUD_STREAM_TTFB_MS = 60_000`)
- Notes: Diagnosis showed one request took 53s TTFB (7s under old timeout); concurrent request timed out at 60s. Earlier concurrent requests with small prompts (6-9K tokens) worked fine.
