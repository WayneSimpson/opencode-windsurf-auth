/**
 * Dynamic model catalog — auto-generates friendly model names from the live
 * Cognition cloud catalog at runtime.
 *
 * The cloud's `GetCascadeModelConfigs` returns `ClientModelConfig` entries
 * with `model_uid` strings like `claude-opus-4-7-medium`. These UIDs encode
 * enough structure (base name + version + variant suffix) to auto-generate
 * friendly names (`claude-opus-4.7` with variant `medium`) without a static
 * lookup table. New models appear automatically — no code changes needed.
 *
 * Legacy `MODEL_*` UIDs (e.g. `MODEL_PRIVATE_2`, `MODEL_CHAT_O3`) are opaque
 * and can't be auto-parsed. Those fall back to a static lookup table built
 * from `VARIANT_CATALOG` in `models.ts`.
 *
 * Resolution order in `resolveModelDynamic()`:
 *   1. Dynamic catalog (from cloud) — primary, handles new models
 *   2. Static catalog (resolveModel()) — fallback when cloud is unavailable
 *   3. Error — unknown models throw, NO pass-through to the cloud
 */

import type { ModelCatalogEntry } from '../cloud-direct/catalog.js';
import { getCatalogEntries } from '../cloud-direct/catalog.js';
import {
  resolveModel,
  getLegacyUidLookup,
  type ResolvedModel,
} from './models.js';

// ─── Types ──────────────────────────────────────────────────────────────

/** A model entry in the dynamic catalog, same shape as VARIANT_CATALOG entries. */
export interface DynamicCatalogEntry {
  /** Friendly canonical id (e.g. "claude-opus-4.7") */
  id: string;
  /** Cloud model_uid for the default variant (e.g. "claude-opus-4-7-medium") */
  defaultUid: string;
  defaultVariant?: string;
  /** Human label from the cloud (e.g. "Claude Opus 4.7 Medium") */
  label: string;
  /** Per-model context/output limit from the cloud */
  maxTokens?: number;
  contextWindow?: number;
  /** Whether the model accepts image attachments */
  supportsImages?: boolean;
  /** Variants keyed by variant name (lowercase) */
  variants?: Record<string, DynamicVariantEntry>;
}

export interface DynamicVariantEntry {
  /** Cloud model_uid for this variant */
  modelUid: string;
  /** Human description from the cloud label */
  description: string;
}

/** Map of friendly base name → dynamic catalog entry */
export type DynamicCatalog = Record<string, DynamicCatalogEntry>;

// ─── UID Parser ─────────────────────────────────────────────────────────

/**
 * Known variant suffixes, ordered longest-first for greedy matching.
 * When a UID ends with one of these (as `-suffix`), it's stripped to
 * reveal the base name. New variant words can be added here without
 * breaking existing parsing — unrecognized suffixes just stay part of
 * the base name (the model still resolves, just without variant split).
 */
const VARIANT_SUFFIXES: string[] = [
  // 2-segment variants (check first, they're longer)
  'thinking-1m',
  'thinking-fast',
  'low-fast',
  'medium-fast',
  'high-fast',
  'xhigh-fast',
  'max-fast',
  'none-priority',
  'low-priority',
  'medium-priority',
  'high-priority',
  'xhigh-priority',
  // 1-segment variants
  'minimal',
  'medium',
  'thinking',
  'xhigh',
  'high',
  'low',
  'fast',
  'base',
  'none',
  'max',
  '1m',
  'lite',
];

/**
 * Parse a cloud string UID into a friendly base name + optional variant.
 *
 * Examples:
 *   claude-opus-4-7-medium     → { friendlyBase: "claude-opus-4.7", variant: "medium" }
 *   claude-opus-4-7-low-fast   → { friendlyBase: "claude-opus-4.7", variant: "low-fast" }
 *   claude-opus-4-6            → { friendlyBase: "claude-opus-4.6", variant: undefined }
 *   swe-1-6-fast               → { friendlyBase: "swe-1.6", variant: "fast" }
 *   deepseek-v4                → { friendlyBase: "deepseek-v4", variant: undefined }
 *   kimi-k2-6                  → { friendlyBase: "kimi-k2.6", variant: undefined }
 */
export function parseFamilyUid(
  uid: string,
  familyUid: string,
): { friendlyBase: string; variant?: string } {
  const candidates = [...new Set([familyUid, familyUid.replace(/\./g, '-')])]
    .sort((a, b) => b.length - a.length);
  for (const candidate of candidates) {
    if (uid === candidate) return { friendlyBase: familyUid };
    if (uid.startsWith(`${candidate}-`)) {
      return { friendlyBase: familyUid, variant: uid.slice(candidate.length + 1) };
    }
  }
  return { friendlyBase: familyUid, variant: uid };
}

function parseStringUid(uid: string): { friendlyBase: string; variant?: string } {
  const segments = uid.split('-');

  // Try to match the longest variant suffix from the end of the UID.
  // We check multi-segment suffixes first (they're longer), then single.
  let variant: string | undefined;
  let baseSegments = segments;

  for (const suffix of VARIANT_SUFFIXES) {
    const suffixParts = suffix.split('-');
    if (segments.length <= suffixParts.length) continue;

    // Check if the last N segments match this suffix
    const tail = segments.slice(segments.length - suffixParts.length);
    if (tail.join('-') === suffix) {
      variant = suffix;
      baseSegments = segments.slice(0, segments.length - suffixParts.length);
      break;
    }
  }

  // Convert version pattern in the base: find the first pair of consecutive
  // segments where segment[i] is a single digit or letter+digit, and
  // segment[i+1] is a single digit. Replace the hyphen between them with a dot.
  //
  // Examples: 4-7 → 4.7, 3-5 → 3.5, 5-4 → 5.4, k2-6 → k2.6, m2-5 → m2.5
  const friendlyBase = convertVersionPattern(baseSegments);

  return { friendlyBase, variant };
}

/**
 * Convert the version pattern in a UID's base segments.
 *
 * Scans for the first pair of consecutive segments where:
 *   - segment[i] matches /^\d$/ or /^[a-z]\d$/ (single digit or letter+digit)
 *   - segment[i+1] matches /^\d$/ (single digit)
 *
 * Replaces the hyphen between them with a dot. Only converts the first match
 * to avoid mangling UIDs with multiple numeric segments.
 */
function convertVersionPattern(segments: string[]): string {
  for (let i = 0; i < segments.length - 1; i++) {
    const cur = segments[i];
    const next = segments[i + 1];
    if (/^\d$/.test(next) && (/^\d$/.test(cur) || /^[a-z]\d$/.test(cur))) {
      // Join with dot instead of hyphen at this position
      const result = [...segments];
      result[i] = cur + '.' + next;
      result.splice(i + 1, 1);
      return result.join('-');
    }
  }
  return segments.join('-');
}

// ─── Dynamic Catalog Builder ────────────────────────────────────────────

/**
 * Build a dynamic catalog from the live cloud `GetCascadeModelConfigs`.
 *
 * For each non-disabled model in the cloud catalog:
 *   - String UIDs (e.g. `claude-opus-4-7-medium`) → auto-parsed into
 *     friendly base name + variant
 *   - Legacy `MODEL_*` UIDs → looked up in the static `VARIANT_CATALOG`
 *     via `getLegacyUidLookup()`. Unrecognized MODEL_* UIDs are skipped
 *     (we can't guess their friendly names).
 *
 * Returns `null` if the cloud catalog fetch fails — the caller should
 * fall back to the static catalog in that case.
 */
export async function buildDynamicCatalog(
  apiKey: string,
  host: string,
  signal?: AbortSignal,
): Promise<DynamicCatalog | null> {
  const entries = await getCatalogEntries(apiKey, host, signal);
  if (!entries) return null;

  const legacyLookup = getLegacyUidLookup();
  const catalog: DynamicCatalog = {};

  for (const entry of entries.values()) {
    // Skip disabled models — they can't be used by this account
    if (entry.disabled) continue;

    const uid = entry.modelUid;

    if (uid.startsWith('MODEL_')) {
      // Legacy opaque UID — look up in static table
      const legacy = legacyLookup.get(uid);
      if (!legacy) continue; // Unrecognized MODEL_* UID, skip

      addToCatalog(catalog, legacy.friendlyBase, uid, entry, legacy.variant, legacy.description);
    } else {
      // String UID — auto-parse friendly name + variant
      const parsed = entry.modelFamilyUid
        ? parseFamilyUid(uid, entry.modelFamilyUid)
        : parseStringUid(uid);
      addToCatalog(catalog, parsed.friendlyBase, uid, entry, parsed.variant, entry.label);
    }
  }

  return catalog;
}

/**
 * Add a cloud catalog entry to the dynamic catalog, grouping variants
 * under their friendly base name.
 */
function addToCatalog(
  catalog: DynamicCatalog,
  friendlyBase: string,
  uid: string,
  cloudEntry: ModelCatalogEntry,
  variant: string | undefined,
  description: string | undefined,
): void {
  let entry = catalog[friendlyBase];
  if (!entry) {
    entry = {
      id: friendlyBase,
      defaultUid: uid,
      defaultVariant: variant,
      label: cloudEntry.label,
      maxTokens: cloudEntry.maxOutputTokens ?? cloudEntry.maxTokens,
      contextWindow: cloudEntry.contextWindow,
      supportsImages: cloudEntry.supportsImages,
    };
    catalog[friendlyBase] = entry;
  }

  // If this entry has a variant, add it to the variants map
  if (variant && variant.length > 0) {
    if (!entry.variants) entry.variants = {};
    // Don't overwrite an existing variant with the same key
    if (!entry.variants[variant]) {
      entry.variants[variant] = {
        modelUid: uid,
        description: description ?? cloudEntry.label,
      };
    }
  }

  if (cloudEntry.isDefaultModelInFamily) {
    entry.defaultUid = uid;
    entry.defaultVariant = variant;
  }

  // Update maxTokens/supportsImages if we see a higher value (take the
  // most permissive setting across variants)
  const maxTokens = cloudEntry.maxOutputTokens ?? cloudEntry.maxTokens;
  if (maxTokens && (!entry.maxTokens || maxTokens > entry.maxTokens)) {
    entry.maxTokens = maxTokens;
  }
  if (
    cloudEntry.contextWindow &&
    (!entry.contextWindow || cloudEntry.contextWindow > entry.contextWindow)
  ) {
    entry.contextWindow = cloudEntry.contextWindow;
  }
  if (cloudEntry.supportsImages && !entry.supportsImages) {
    entry.supportsImages = true;
  }
}

// ─── Dynamic Model List for /v1/models ──────────────────────────────────

/**
 * Model info for the /v1/models endpoint — includes friendly name,
 * variants, and cloud metadata (maxTokens, supportsImages).
 */
export interface DynamicModelInfo {
  id: string;
  label: string;
  defaultVariant?: string;
  maxTokens?: number;
  contextWindow?: number;
  supportsImages?: boolean;
  variants?: Record<string, { id: string; description: string }>;
}

/**
 * Get the list of models from the dynamic catalog, formatted for the
 * `/v1/models` endpoint. Returns `null` if the dynamic catalog can't
 * be built (caller falls back to static `getCanonicalModels()`).
 */
export async function getDynamicModelList(
  apiKey: string,
  host: string,
  signal?: AbortSignal,
): Promise<DynamicModelInfo[] | null> {
  const catalog = await buildDynamicCatalog(apiKey, host, signal);
  if (!catalog) return null;

  return Object.values(catalog)
    .map((entry) => {
      const info: DynamicModelInfo = {
        id: entry.id,
        label: entry.label,
        defaultVariant: entry.defaultVariant,
        maxTokens: entry.maxTokens,
        contextWindow: entry.contextWindow,
        supportsImages: entry.supportsImages,
      };
      if (entry.variants) {
        info.variants = {};
        for (const [name, v] of Object.entries(entry.variants)) {
          info.variants[name] = { id: name, description: v.description };
        }
      }
      return info;
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

// ─── Async Model Resolver ───────────────────────────────────────────────

/**
 * Error thrown when a model name can't be resolved in either the dynamic
 * or static catalog. This is NOT a pass-through — the model name is never
 * sent to the cloud as a raw UID. The user gets a clear error message.
 */
export class UnknownModelError extends Error {
  constructor(modelName: string) {
    super(
      `Unknown Windsurf model: "${modelName}". ` +
        `The model is not in the live cloud catalog or the static fallback. ` +
        `Call /v1/models to see available models for your account.`,
    );
    this.name = 'UnknownModelError';
  }
}

/**
 * Resolve a friendly model name to a cloud model_uid using the dynamic
 * catalog (primary) with static fallback.
 *
 * Resolution order:
 *   1. Dynamic catalog (from cloud) — handles new models automatically
 *   2. Static catalog (resolveModel()) — fallback when cloud is unavailable
 *      or for legacy MODEL_* models not in the dynamic catalog
 *   3. Error — throws UnknownModelError, NO pass-through to the cloud
 *
 * The `apiKey` and `host` parameters are used to fetch the live catalog.
 * They're already available at the call sites (createStreamingResponse,
 * createNonStreamingResponse) via `credentials`.
 */
export async function resolveModelDynamic(
  modelName: string,
  variantOverride: string | undefined,
  apiKey: string,
  host: string,
  signal?: AbortSignal,
): Promise<ResolvedModel> {
  // Try dynamic catalog first
  const catalog = await buildDynamicCatalog(apiKey, host, signal);

  if (catalog) {
    const normalized = modelName.toLowerCase().trim();
    const { base, variant } = splitModelNameAgainstCatalog(normalized, catalog);
    const effectiveVariant = (variantOverride || variant || '').trim().toLowerCase() || undefined;

    const entry = catalog[base] || catalog[normalized];
    if (entry) {
      // If a variant is specified, try to find it
      if (effectiveVariant && entry.variants?.[effectiveVariant]) {
        const v = entry.variants[effectiveVariant]!;
        return {
          modelId: entry.id,
          modelUid: v.modelUid,
          variant: effectiveVariant,
        };
      }
      // No variant or variant not found — use default
      return {
        modelId: entry.id,
        modelUid: entry.defaultUid,
      };
    }
  }

  // Fall back to static catalog (handles legacy MODEL_* models, aliases,
  // and everything in VARIANT_CATALOG). This throws if the model is unknown.
  try {
    return resolveModel(modelName, variantOverride);
  } catch {
    // Static catalog also failed — unknown model, no pass-through
    throw new UnknownModelError(modelName);
  }
}

/**
 * Split a model name into base + variant, using the dynamic catalog keys
 * for progressive suffix peeling.
 *
 * Handles both colon-delimited (`claude-opus-4.7:low-fast`) and
 * hyphen-suffix (`claude-opus-4.7-low-fast`) forms. For hyphen-suffix,
 * tries progressively shorter base names against the catalog keys so
 * multi-segment variant names (e.g. `low-fast`, `thinking-1m`) work.
 */
function splitModelNameAgainstCatalog(
  raw: string,
  catalog: DynamicCatalog,
): { base: string; variant?: string } {
  // Colon-delimited form is unambiguous
  const colonIdx = raw.indexOf(':');
  if (colonIdx !== -1) {
    const base = raw.slice(0, colonIdx);
    const variant = raw.slice(colonIdx + 1).trim();
    return { base, variant: variant || undefined };
  }

  // Hyphen-suffix form: try progressively shorter suffix variants so
  // multi-segment variant names (e.g. `low-fast`, `thinking-1m`,
  // `medium-priority`) work too. Same approach as splitModelAndVariant
  // in models.ts but against the dynamic catalog.
  const parts = raw.split('-');
  for (let cut = 1; cut < parts.length; cut++) {
    const base = parts.slice(0, parts.length - cut).join('-');
    const maybeVariant = parts.slice(parts.length - cut).join('-');
    const entry = catalog[base];
    if (entry?.variants?.[maybeVariant]) {
      return { base, variant: maybeVariant };
    }
  }

  return { base: raw };
}
