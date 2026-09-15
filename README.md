# opencode-windsurf-auth

[![npm version](https://img.shields.io/npm/v/opencode-windsurf-auth.svg)](https://www.npmjs.com/package/opencode-windsurf-auth)
[![npm beta](https://img.shields.io/npm/v/opencode-windsurf-auth/beta.svg?label=beta)](https://www.npmjs.com/package/opencode-windsurf-auth)
[![npm downloads](https://img.shields.io/npm/dw/opencode-windsurf-auth.svg)](https://www.npmjs.com/package/opencode-windsurf-auth)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> Use Windsurf models in [opencode](https://opencode.ai/): Claude, GPT, Gemini, Kimi, DeepSeek, SWE-1.6, and more with your existing Windsurf subscription. All via Windsurf OAuth, no app required.

## Install

### Option A - one-line wizard (recommended)

```bash
curl -fsSL https://raw.githubusercontent.com/rsvedant/opencode-windsurf-auth/master/install.sh | bash
```

The wizard backs up your existing `~/.config/opencode/opencode.json`, merges in the plugin entry + a curated 7-model `provider.windsurf` block (additive, your other settings are untouched), then launches `opencode auth login --provider windsurf` so you can sign in.

Flags:

| Flag | Effect |
|---|---|
| `--no-login` | Skip the sign-in step (run `opencode auth login --provider windsurf` later) |
| `--force` | Overwrite an existing `provider.windsurf` block (default: keep what's there) |
| `--help` | Show usage and exit |

Pass them through the pipe:
```bash
curl -fsSL https://raw.githubusercontent.com/rsvedant/opencode-windsurf-auth/master/install.sh | bash -s -- --no-login
```

### Option B - manual

Paste this into `~/.config/opencode/opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["opencode-windsurf-auth@beta"],
  "provider": {
    "windsurf": {
      "name": "Cognition (Windsurf)",
      "npm": "@ai-sdk/openai-compatible",
      "options": { "baseURL": "http://127.0.0.1:42100/v1" },
      "models": {
        "claude-opus-4.7": {
          "name": "Claude Opus 4.7",
          "limit": { "context": 1000000, "output": 128000 },
          "attachment": true,
          "modalities": { "input": ["text", "image"], "output": ["text"] },
          "variants": {
            "low":    { "providerOptions": { "windsurf": { "variant": "low" } } },
            "medium": { "providerOptions": { "windsurf": { "variant": "medium" } } },
            "high":   { "providerOptions": { "windsurf": { "variant": "high" } } },
            "xhigh":  { "providerOptions": { "windsurf": { "variant": "xhigh" } } },
            "max":    { "providerOptions": { "windsurf": { "variant": "max" } } },
            "low-fast":    { "providerOptions": { "windsurf": { "variant": "low-fast" } } },
            "medium-fast": { "providerOptions": { "windsurf": { "variant": "medium-fast" } } },
            "high-fast":   { "providerOptions": { "windsurf": { "variant": "high-fast" } } },
            "xhigh-fast":  { "providerOptions": { "windsurf": { "variant": "xhigh-fast" } } },
            "max-fast":    { "providerOptions": { "windsurf": { "variant": "max-fast" } } }
          }
        },
        "gpt-5.5": {
          "name": "GPT 5.5",
          "limit": { "context": 1050000, "output": 128000 },
          "attachment": true,
          "modalities": { "input": ["text", "image"], "output": ["text"] },
          "variants": {
            "none":   { "providerOptions": { "windsurf": { "variant": "none" } } },
            "low":    { "providerOptions": { "windsurf": { "variant": "low" } } },
            "medium": { "providerOptions": { "windsurf": { "variant": "medium" } } },
            "high":   { "providerOptions": { "windsurf": { "variant": "high" } } },
            "xhigh":  { "providerOptions": { "windsurf": { "variant": "xhigh" } } },
            "none-priority":   { "providerOptions": { "windsurf": { "variant": "none-priority" } } },
            "low-priority":    { "providerOptions": { "windsurf": { "variant": "low-priority" } } },
            "medium-priority": { "providerOptions": { "windsurf": { "variant": "medium-priority" } } },
            "high-priority":   { "providerOptions": { "windsurf": { "variant": "high-priority" } } },
            "xhigh-priority":  { "providerOptions": { "windsurf": { "variant": "xhigh-priority" } } }
          }
        },
        "kimi-k2.6": {
          "name": "Kimi K2.6",
          "limit": { "context": 262144, "output": 262144 },
          "attachment": true,
          "modalities": { "input": ["text", "image"], "output": ["text"] }
        },
        "gemini-3.5-flash": {
          "name": "Gemini 3.5 Flash",
          "limit": { "context": 1048576, "output": 65536 },
          "attachment": true,
          "modalities": { "input": ["text", "image"], "output": ["text"] },
          "variants": {
            "minimal": { "providerOptions": { "windsurf": { "variant": "minimal" } } },
            "low":     { "providerOptions": { "windsurf": { "variant": "low" } } },
            "medium":  { "providerOptions": { "windsurf": { "variant": "medium" } } },
            "high":    { "providerOptions": { "windsurf": { "variant": "high" } } }
          }
        },
        "claude-opus-4.6": {
          "name": "Claude Opus 4.6",
          "limit": { "context": 1000000, "output": 128000 },
          "attachment": true,
          "modalities": { "input": ["text", "image"], "output": ["text"] },
          "variants": {
            "thinking":      { "providerOptions": { "windsurf": { "variant": "thinking" } } },
            "1m":            { "providerOptions": { "windsurf": { "variant": "1m" } } },
            "thinking-1m":   { "providerOptions": { "windsurf": { "variant": "thinking-1m" } } },
            "fast":          { "providerOptions": { "windsurf": { "variant": "fast" } } },
            "thinking-fast": { "providerOptions": { "windsurf": { "variant": "thinking-fast" } } }
          }
        },
        "swe-1.6": {
          "name": "SWE 1.6",
          "limit": { "context": 1000000, "output": 128000 },
          "attachment": true,
          "modalities": { "input": ["text", "image"], "output": ["text"] },
          "variants": {
            "fast":        { "providerOptions": { "windsurf": { "variant": "fast" } } },
            "fast-low":    { "providerOptions": { "windsurf": { "variant": "fast-low" } } },
            "fast-medium": { "providerOptions": { "windsurf": { "variant": "fast-medium" } } },
            "fast-high":   { "providerOptions": { "windsurf": { "variant": "fast-high" } } }
          }
        },
        "deepseek-v4": {
          "name": "DeepSeek V4",
          "limit": { "context": 1000000, "output": 384000 }
        }
      }
    }
  }
}
```

Sign in:
```bash
opencode auth login --provider windsurf
# → browser opens; sign in with your Windsurf account
# → credential is saved automatically
```

Want the full catalog (94 models, all variants)? Copy [`opencode_config_example.json`](opencode_config_example.json) verbatim.

## Use

```bash
opencode run --model=windsurf/swe-1.6 "hi"
opencode run --model=windsurf/claude-opus-4.7 --variant high "what does this codebase do?"
opencode run --model=windsurf/kimi-k2.6 -f screenshot.png -- "describe this image"
```

Pick a reasoning variant with `--variant` on the CLI or the variant selector in the TUI's model dialog. Each entry in a model's `variants` map sends `providerOptions.windsurf.variant` to the plugin, which resolves it to a distinct cloud model UID (`high` → `claude-opus-4-7-high`, etc.). Variant names are the suffixes in the cloud UID — the same names Windsurf's own clients use.

Two gotchas:

- An empty variant (`"high": {}`) lists a picker entry that silently runs the default model — always map the name through `providerOptions` as shown above.
- If you set `"reasoning": true` on a model, opencode auto-generates `none`/`minimal`/`low`/`medium`/`high`/`xhigh` variants that only send `reasoningEffort` — which the plugin ignores. Declare the model's real variants explicitly and disable the ones that don't exist, e.g. `"minimal": { "disabled": true }`.

(If you call the proxy's `/v1/chat/completions` directly, outside opencode, `"model": "claude-opus-4.7:high"` also works — the colon suffix is resolved plugin-side.)

## Image attachments

Models with `"attachment": true` in your config accept image content parts via opencode's `-f <path>` flag (and the TUI's paste/drag-drop). The 7-model curated set above marks six as image-capable (everything except `deepseek-v4`). The full 94-model catalog in [`opencode_config_example.json`](opencode_config_example.json) flags 55 models as image-capable based on per-model verification against [models.dev](https://models.dev). Append custom models without the `attachment` flag and opencode automatically blocks image attachment in the UI.

## Sign in / sign out

```bash
opencode auth login --provider windsurf   # browser-based, recommended
opencode auth logout windsurf             # clears the credential

# Headless / SSH / no-browser fallback:
npx opencode-windsurf-auth login --manual
npx opencode-windsurf-auth whoami         # show signed-in account
npx opencode-windsurf-auth status         # show credentials path + version
```

Credentials are stored mode `0600` at the XDG-config location opencode itself uses, on every platform:

- Linux + macOS + Windows: `~/.config/opencode-windsurf-auth/credentials.json`

(opencode doesn't honor `%APPDATA%` on Windows either, it follows XDG conventions everywhere — so the plugin's credentials sit next to opencode's own config.)

## How it works

opencode loads the plugin from npm via its own cache. The plugin binds a Bearer-gated loopback proxy—fixed at `127.0.0.1:42100` for the standalone web service and OS-assigned for Paseo children—translates OpenAI-shaped chat requests into Cognition's Connect-RPC `GetChatMessage` wire format, and streams the response back as OpenAI SSE. Tool calls, MCP servers, reasoning deltas, token usage, image attachments — all wired through. No `language_server` runs. Auth uses a loopback OAuth callback on a random ephemeral port; the long-lived `api_key` from `RegisterUser` is then exchanged for a short-lived `user_jwt` on every chat. For the wire-protocol details see [docs/CASCADE_PROTOCOL.md](docs/CASCADE_PROTOCOL.md).

## Troubleshooting

<details>
<summary><strong>Windsurf proxy port is already in use</strong></summary>

The standalone web service uses `127.0.0.1:42100`; find a conflicting process with:

```bash
lsof -nP -iTCP:42100 -sTCP:LISTEN
kill -9 <PID>
```

The plugin refuses to silently adopt a foreign listener because a squatter could otherwise capture your prompts. Paseo children normally use OS-assigned loopback ports; only the standalone service should require `42100`. Re-run the affected OpenCode service after removing a stale listener.
</details>

<details>
<summary><strong>Sign-in browser didn't open / headless host</strong></summary>

The CLI fallback prints a URL you can click manually:

```bash
npx opencode-windsurf-auth login --manual
```

Or paste the URL it shows into any browser on a machine that can reach your headless host (the loopback callback won't work cross-host, so use `--manual` for fully-headless setups).
</details>

<details>
<summary><strong>Model says "I can't read images"</strong></summary>

Only models with `"attachment": true` in your `opencode.json` will receive image content from opencode. If you added a custom model and want image attachments, add:

```json
"attachment": true,
"modalities": { "input": ["text", "image"], "output": ["text"] }
```

(Adding the flag to a model that doesn't actually support vision will still let opencode attach the image, but the model will respond with "I can't read images" — that's the model talking, not the plugin.)
</details>

<details>
<summary><strong>"Cognition (Windsurf)" doesn't show up in <code>opencode auth login</code></strong></summary>

Confirm the plugin entry is present:

```bash
jq '.plugin' ~/.config/opencode/opencode.json
# Should contain "opencode-windsurf-auth@beta"
```

Then nuke opencode's plugin cache so it re-resolves from npm:

```bash
rm -rf ~/.cache/opencode/packages/opencode-windsurf-auth@beta
opencode auth login
```
</details>

## Project layout

```
src/
├── plugin.ts                # Proxy server + opencode hooks (auth + chat.params)
├── cli.ts                   # `opencode-windsurf-auth` standalone CLI
├── cloud-direct/            # Cognition Connect-RPC wire client
│   ├── chat.ts              # GetChatMessage stream + SSE adapter
│   ├── wire.ts              # Proto + Connect framing
│   ├── auth.ts              # GetUserJwt mint + cache
│   └── metadata.ts          # Metadata proto builder
├── oauth/                   # OAuth flow + credentials.json
│   ├── login.ts             # Loopback + manual-paste sign-in
│   ├── register-user.ts     # POST register.windsurf.com → api_key
│   └── storage.ts           # O_EXCL-locked, mode-0600 atomic write
└── plugin/
    ├── credentials-resolver.ts
    └── models.ts            # 110+ canonical model IDs + variant resolver
```

## Development

```bash
git clone https://github.com/rsvedant/opencode-windsurf-auth.git
cd opencode-windsurf-auth
bun install
bun run typecheck
bun run build
bun test
```

## Further reading

- [docs/CASCADE_PROTOCOL.md](docs/CASCADE_PROTOCOL.md) — Windsurf 2.x wire-format notes (why `RawGetChatMessage` is dead, why model UIDs are now strings, required metadata fields, etc.)

## License

[MIT](LICENSE)
