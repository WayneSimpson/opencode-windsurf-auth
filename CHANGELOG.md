# Changelog

### 2026-09-20 11:15:31 +01:00 — Add a remote OpenClaw route with dynamic model capabilities
- Type: Added/Fixed
- Scope: api/auth/models/tools/docs
- Files:
  - `src/plugin.ts`: add the independent Bearer-gated OpenClaw listener; static-token authorization; configurable host/port; compact capability-rich `/v1/models`; standard `reasoning_effort` and `reasoning.effort` routing; separate protected debug captures; OpenClaw-only tool-schema normalization and adaptive MCP-validation fallback
  - `src/cloud-direct/catalog.ts`: decode authoritative `model_info.model_family_uid`, native context window, maximum output tokens, and `is_default_model_in_family` from the live Cognition catalog
  - `src/plugin/dynamic-catalog.ts`: group modern models by the cloud family UID, discover arbitrary future variant suffixes, select the cloud-designated default, and retain the static fallback for opaque legacy `MODEL_*` identifiers
  - `tests/unit/openclaw-listener.test.ts`: cover listener isolation/authentication, host validation, model capability metadata, reasoning controls, schema normalization, and adaptive tool-description/schema retries
  - `tests/unit/variant.test.ts`: cover authoritative family grouping, dotted family IDs, and unknown future variant names
  - `README.md`: document remote Gateway/node topology, compact model discovery, reasoning selection, tool compatibility behavior, security/logging constraints, and the Devin Local-only upstream response
- Rationale: OpenClaw's Gateway runs on a different server from the paired execution node and needs a dedicated Tailscale-reachable OpenAI-compatible route without learning OpenCode's process secret. Generic OpenClaw tool catalogs also exposed a Cognition validator bug: valid large descriptions return `failed_precondition: Unable to process request due to an MCP configuration issue`. The route now retries only that pre-output error with progressively safer metadata while preserving normal OpenCode behavior.
- Model catalog: `/v1/models` exposes one row per account-enabled model family rather than one row per variant. Rows include `default_variant`, `available_variants`, `supported_reasoning_efforts`, `context_window`, `max_tokens`, image support, and nested variant IDs. The Gateway can therefore show one model and use its reasoning picker. Modern models and new variant names are discovered from live Cognition family metadata; the cache refresh interval remains ten minutes.
- Route isolation: OpenClaw-only request normalization and MCP fallback are enabled only on the optional listener. OpenCode keeps its compact catalog, `providerOptions.windsurf.variant` flow, per-process authentication, and original tool payload behavior. The improved family/default/context parsing is shared by both routes.
- Verification: 47 tests pass; TypeScript typecheck and build pass. Live OpenClaw traffic with 191 tools produced reasoning and final text after the blank-description fallback. Live `swe-2` requests with `reasoning_effort` values `medium`, `high`, and `max` resolved to `swe-2-medium`, `swe-2-high`, and `swe-2-max` respectively; subsequent inference was blocked only by the account's temporary free-model rate limit.
- Risk/Impact: On the first request for a tool catalog that Cognition rejects, the OpenClaw route can make additional upstream validation attempts before yielding output. The successful blank-description mode preserves names and parameter schemas but gives the model less tool-selection guidance; the minimal-schema mode is a last resort. Both listeners still share the same Cognition quota.
- Rollback hint: remove the OpenClaw listener environment variables and restart OpenCode to disable the remote route; revert the files above and rebuild to remove capability discovery/retry behavior. No Gateway or node configuration is modified by the plugin itself.
- Notes: Some catalog-listed models now return `This model is only in Devin Local. (trace ID: ...)`. This is an upstream product-availability restriction, not a proxy failure. It may indicate Cognition is moving specific routes away from Cascade/GetChatMessage toward Devin Local, but that wider migration is not confirmed. Keep the finding documented and revisit later; do not prioritize automatic filtering while the desired models continue to work.

### 2026-09-15 13:05:00 +01:00 — Wire opencode variants to real cloud model UIDs
- Type: Fixed
- Scope: config/docs
- Files:
  - opencode_config_example.json: replace 102 empty `"variant": {}` picker entries with `providerOptions.windsurf.variant` payloads so selecting a variant actually switches the cloud model_uid
  - install.sh: emit the same payload shape from both the Node and Python config branches (via small `variants(...)`/`_variants(...)` helpers)
  - README.md: update the config snippet and replace the stale `model:variant` CLI example with `--variant`; document the empty-`{}` and `reasoning: true` auto-variant traps
- Rationale: opencode merges a selected variant's options object into the request, and the plugin reads `providerOptions.windsurf.variant` to resolve the cloud uid. Empty `{}` entries produced picker variants that silently ran the default uid. Verified end-to-end on opencode 1.18.30: `--variant medium`/`max` on `windsurf/swe-2` resolved to `swe-2-medium`/`swe-2-max`, and `--variant xhigh` on `windsurf/grok-4.6` resolved to `grok-4-6-xhigh`.
- Risk/Impact: Variant selections now change the upstream model (the intended behavior). `run -m "model#variant"` crashes opencode 1.18.30 with "Unexpected server error" before reaching the plugin — use `--variant` on the CLI; the `#` syntax is unverified on this build.
- Rollback hint: restore the previous example config / install.sh variant shapes; no runtime code changed.
- Notes: Models marked `"reasoning": true` get auto-generated variants (`none`/`minimal`/`low`/`medium`/`high`/`xhigh`, payload `{reasoningEffort}`) which the plugin ignores — hide them with `"name": { "disabled": true }` in the variants map. Variant names unknown to the live catalog fall back to the model's default uid; they are never passed through raw.

### 2026-09-15 12:25:00 +01:00 — Add SWE-2 to static model catalog
- Type: Added
- Scope: api
- Files:
  - src/plugin/models.ts: add `swe-2` entry to VARIANT_CATALOG with three variants (high, medium, max) using string UIDs confirmed live in Cognition cloud catalog
  - opencode_config_example.json: add `swe-2` model entry with variants subtree
- Rationale: Cognition now serves `swe-2-high`, `swe-2-medium`, and `swe-2-max` (262K context, image-capable). The dynamic catalog already resolves them, but the static fallback threw `UnknownModelError` for `windsurf/swe-2*` when the cloud catalog fetch failed — the same failure mode that broke the scout subagent before the swe-1.7 entry was added. There is no bare `swe-2` uid upstream; `swe-2-high` is the default because it is first in the cloud's catalog order and flagged isRecommended, matching what the dynamic catalog resolves bare `swe-2` to.
- Risk/Impact: None — purely additive. Existing model resolution unaffected.
- Rollback hint: remove the `swe-2` entry from VARIANT_CATALOG in models.ts and rebuild.
- Notes: Cloud UIDs verified via `bun run scripts/sync-models.ts --dump` on 2026-09-15. The scout subagent in opencode.jsonc was moved from `windsurf/swe-1-7-medium` to `windsurf/swe-2-medium`.

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
