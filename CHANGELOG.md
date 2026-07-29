# Changelog

### 2026-07-28 13:45:00 +01:00 — Fix grok-code-fast to use MODEL_PRIVATE_4 (actual cloud UID)
- Type: Fixed
- Scope: api
- Files:
  - src/plugin/models.ts: add `grok-code-fast` entry to VARIANT_CATALOG with `defaultUid: 'MODEL_PRIVATE_4'`; change MODEL_NAME_TO_ENUM mapping from `GROK_CODE_FAST` (345) to `PRIVATE_4` (222)
- Rationale: GetCascadeModelConfigs dump shows "Grok Code Fast 1" is served as `MODEL_PRIVATE_4` (enum 222), not `MODEL_XAI_GROK_CODE_FAST` (enum 345). The XAI_GROK prefix fix from 13:35 was correct format but wrong UID — the cloud doesn't serve Grok Code Fast under the XAI namespace, it uses a private slot. The dynamic catalog was mapping MODEL_PRIVATE_4 to `private-4` (its generic name), so `grok-code-fast` fell through to the static catalog which produced the wrong UID.
- Risk/Impact: Fixes `windsurf/grok-code-fast` model resolution. The `GROK_CODE_FAST` enum (345) is now unused for resolution but kept in types.ts for completeness. `GROK_2` prefix override from 13:35 is still valid (cloud serves grok-2 as MODEL_XAI_GROK_2).
- Rollback hint: remove the `grok-code-fast` entry from VARIANT_CATALOG and revert MODEL_NAME_TO_ENUM mapping to `ModelEnum.GROK_CODE_FAST`.
- Notes: Confirmed via `bun run scripts/sync-models.ts --dump`: label "Grok Code Fast 1", modelEnum 222, modelUid "MODEL_PRIVATE_4", maxTokens 256000.

### 2026-07-28 13:35:00 +01:00 — Fix GROK_CODE_FAST and GROK_2 cloud UID prefix
- Type: Fixed
- Scope: api
- Files:
  - src/plugin/models.ts: add `GROK_CODE_FAST` and `GROK_2` to `ENUM_PREFIX_OVERRIDES` so they produce `MODEL_XAI_GROK_CODE_FAST` and `MODEL_XAI_GROK_2` instead of `MODEL_GROK_CODE_FAST` and `MODEL_GROK_2`
- Rationale: All Grok models use the `MODEL_XAI_GROK_*` prefix in the Cognition cloud catalog (documented in the comment at line 27). `GROK_3` and `GROK_3_MINI_REASONING` already had overrides, but `GROK_CODE_FAST` and `GROK_2` were missing. The plugin sent `MODEL_GROK_CODE_FAST` which the cloud rejected with "not listed in the Cognition catalog for your account".
- Risk/Impact: Fixes `windsurf/grok-code-fast` and `windsurf/grok-2` model resolution. No impact on other models.
- Rollback hint: remove the two lines from `ENUM_PREFIX_OVERRIDES` and rebuild.
- Notes: Error confirmed in opencode.log: `Model uid "MODEL_GROK_CODE_FAST" is not listed in the Cognition catalog`. The explore subagent in opencode.jsonc uses `windsurf/grok-code-fast`.

### 2026-07-28 07:35:00 +01:00 — Add SWE-1.7 to static model catalog
- Type: Added
- Scope: api
- Files:
  - src/plugin/models.ts: add `swe-1.7` entry to VARIANT_CATALOG with three variants (max, lightning, medium) using string UIDs confirmed live in Cognition cloud catalog
- Rationale: The scout subagent in opencode.jsonc referenced `windsurf/swe-1.7` but the plugin's static catalog only knew about swe-1.5 and swe-1.6. When the dynamic catalog fetch failed, the static fallback threw `UnknownModelError`.
- Risk/Impact: None — purely additive. Existing model resolution unaffected. Cloud still gates access via `disabled` flag in per-account catalog.
- Rollback hint: remove the `swe-1.7` entry from VARIANT_CATALOG in models.ts and rebuild.
- Notes: Cloud UIDs verified via `bun run scripts/sync-models.ts --dump` on 2026-07-28.

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
