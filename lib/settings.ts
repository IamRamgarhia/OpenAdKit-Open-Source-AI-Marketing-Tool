import { getProvider } from "./providers";
import { resolveStoredValue, prepareForStorage, isVaultEnabled, isCiphertext, forgetPlaintext } from "./key-vault";

const KEYS = {
  activeProvider: "ados.active_provider",
  activeBrain: "ados.active_brain",
  totalCost: "ados.total_cost_usd",
  totalIn: "ados.total_input_tokens",
  totalOut: "ados.total_output_tokens",
  onboarded: "ados.onboarded",
  tourSeen: "ados.tour_seen",
  language: "ados.default_language",
  toneOverride: "ados.tone_override",
  charWarn: "ados.char_warn",
  autoSave: "ados.autosave",
  currency: "ados.currency",
  // Per-provider keys: `ados.provider.{id}.key`
  // Per-provider model: `ados.provider.{id}.model`
  // Legacy (migrated): "ados.api_key", "ados.model"
} as const;

function safeLocal(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function providerKeyName(providerId: string): string {
  return `ados.provider.${providerId}.key`;
}
function providerModelName(providerId: string): string {
  return `ados.provider.${providerId}.model`;
}

/**
 * Model IDs that were removed from a provider's catalog, mapped to their
 * replacement IN THAT PROVIDER'S CATALOG. A saved selection pointing at a
 * retired ID silently breaks cost estimation (findModel returns null → every
 * generation reports $0) and can 404 at the provider, so we rewrite it on read.
 *
 * Keyed by provider: the same model string can mean different things on
 * different hosts, and a global map once rewrote Cerebras' "llama-3.1-8b" to
 * "gpt-oss-20b" — a model Cerebras doesn't serve. Add a row here whenever a
 * model is dropped from lib/providers/*; settings-vault.test.ts asserts every
 * target exists in its provider's catalog. Only list models that are actually
 * retired/dropped — claude-opus-4-6 is still served and stays selectable.
 */
export const RETIRED_MODEL_IDS: Record<string, Record<string, string>> = {
  anthropic: {
    // Date-suffixed variants are not valid model IDs — use the bare alias.
    "claude-haiku-4-5-20251001": "claude-haiku-4-5",
    // Dropped from our catalog (superseded); map to the current generation.
    "claude-opus-4-5": "claude-opus-5-5",
    "claude-sonnet-4-5": "claude-sonnet-5-5",
  },
  google: {
    // 2.0 Flash Lite withdrawn from the Gemini API; 1.5 family retired.
    "gemini-2.0-flash-lite": "gemini-3.5-flash-lite",
    "gemini-1.5-flash": "gemini-3.6-flash",
    "gemini-1.5-pro": "gemini-2.5-pro",
  },
  groq: {
    // Mixtral decommissioned by Groq.
    "mixtral-8x7b-32768": "openai/gpt-oss-120b",
  },
  cerebras: {
    // Cerebras no longer serves any Llama model.
    "llama-3.3-70b": "gpt-oss-120b",
    "llama-3.1-8b": "gpt-oss-120b",
  },
  openrouter: {
    // Both free models withdrawn from the catalog.
    "meta-llama/llama-3.3-70b-instruct:free": "google/gemma-4-31b-it:free",
    "deepseek/deepseek-chat-v3:free": "google/gemma-4-31b-it:free",
    "anthropic/claude-sonnet-4-6": "anthropic/claude-sonnet-5",
    "google/gemini-2.5-flash": "google/gemini-3.6-flash",
    "openai/gpt-4.1-mini": "openai/gpt-5.6-luna",
  },
  deepseek: {
    // V3/R1 era IDs superseded by V4.
    "deepseek-chat": "deepseek-v4-flash",
    "deepseek-reasoner": "deepseek-v4-pro",
  },
  mistral: {
    // Moving off floating aliases to explicit dated IDs.
    "mistral-large-latest": "mistral-large-3-25-12",
    "mistral-small-latest": "mistral-small-4-0-26-03",
  },
  openai: {
    // Kept serving upstream, but dropped from our catalog, so a saved
    // selection would silently price at $0.
    "gpt-5": "gpt-5.6-terra",
    "gpt-5-mini": "gpt-5.6-luna",
    "gpt-4.1": "gpt-5.6-terra",
  },
};

function migrateModelId(providerId: string, model: string): string {
  return RETIRED_MODEL_IDS[providerId]?.[model] ?? model;
}

let _migrated = false;
function migrateLegacyOnce() {
  if (_migrated) return;
  const s = safeLocal();
  if (!s) return;
  const legacyKey = s.getItem("ados.api_key");
  const legacyModel = s.getItem("ados.model");
  if (legacyKey && legacyKey.startsWith("sk-ant-")) {
    if (!s.getItem(providerKeyName("anthropic"))) s.setItem(providerKeyName("anthropic"), legacyKey);
    if (!s.getItem(KEYS.activeProvider)) s.setItem(KEYS.activeProvider, "anthropic");
    const modelMap: Record<string, string> = {
      sonnet: "claude-sonnet-5",
      opus: "claude-opus-5",
      haiku: "claude-haiku-4-5",
    };
    if (legacyModel && modelMap[legacyModel]) {
      s.setItem(providerModelName("anthropic"), modelMap[legacyModel]);
    }
    s.removeItem("ados.api_key");
    s.removeItem("ados.model");
  }
  // Rewrite any stored model selection that points at a retired ID.
  for (let i = 0; i < s.length; i++) {
    const k = s.key(i);
    if (!k || !k.startsWith("ados.provider.") || !k.endsWith(".model")) continue;
    const providerId = k.slice("ados.provider.".length, -".model".length);
    const v = s.getItem(k);
    if (!v) continue;
    const next = migrateModelId(providerId, v);
    if (next !== v) s.setItem(k, next);
  }
  _migrated = true;
}

export function getActiveProviderId(): string | null {
  migrateLegacyOnce();
  return safeLocal()?.getItem(KEYS.activeProvider) ?? null;
}
export function setActiveProviderId(id: string): void {
  safeLocal()?.setItem(KEYS.activeProvider, id);
}
/** Clear the active provider. Used when the active provider's key is deleted
 *  and no other configured provider is available to take over. */
export function clearActiveProviderId(): void {
  safeLocal()?.removeItem(KEYS.activeProvider);
}

export function getProviderKey(providerId: string): string {
  migrateLegacyOnce();
  const name = providerKeyName(providerId);
  const raw = safeLocal()?.getItem(name) ?? "";
  // Transparently decrypts when the optional key vault is enabled + unlocked;
  // returns "" for unreadable ciphertext so callers behave as they would for a
  // missing key (prompting the user rather than sending garbage to a provider).
  return resolveStoredValue(name, raw);
}
/**
 * Persist a secret, encrypting it when the vault is unlocked. Plaintext is
 * written first so a failed encrypt can't lose the user's key; the ciphertext
 * write-back only happens if the stored value is STILL the one we encrypted —
 * otherwise a clear (or a newer save) made while the encrypt was in flight
 * would be silently undone. With the vault enabled but locked the value stays
 * plaintext until unlockVault() re-encrypts it.
 */
function writeSecret(name: string, value: string): void {
  const s = safeLocal();
  if (!s) return;
  s.setItem(name, value);
  if (!isVaultEnabled()) return;
  prepareForStorage(name, value)
    .then((stored) => {
      if (stored !== value && s.getItem(name) === value) s.setItem(name, stored);
    })
    .catch(() => {
      /* leave plaintext; unlockVault() re-encrypts */
    });
}

export function setProviderKey(providerId: string, key: string): void {
  writeSecret(providerKeyName(providerId), key);
}
export function clearProviderKey(providerId: string): void {
  const name = providerKeyName(providerId);
  safeLocal()?.removeItem(name);
  forgetPlaintext(name);
}
/**
 * Is a key PERSISTED for this provider? Distinct from getProviderKey() being
 * non-empty: that returns "" for ciphertext behind a locked vault, and the
 * Settings UI must not claim "not configured" just because the vault is shut.
 * Also distinct from whatever is currently typed into the input box.
 */
export function hasProviderKey(providerId: string): boolean {
  const raw = safeLocal()?.getItem(providerKeyName(providerId));
  return Boolean(raw && raw.trim());
}

export function getActiveModelId(providerId: string): string | null {
  migrateLegacyOnce();
  const stored = safeLocal()?.getItem(providerModelName(providerId)) ?? null;
  if (!stored) return null;
  return migrateModelId(providerId, stored);
}
export function setActiveModelId(providerId: string, model: string): void {
  safeLocal()?.setItem(providerModelName(providerId), model);
}

/**
 * Is at least one key STORED? Deliberately does not require the key vault to
 * be unlocked — a locked vault means "prove who you are", not "you have no
 * account", and bouncing the user to onboarding for it would be wrong.
 * Usability of a specific key is getProvidersWithKeys()' job.
 */
export function hasAnyKeyConfigured(): boolean {
  migrateLegacyOnce();
  const s = safeLocal();
  if (!s) return false;
  for (let i = 0; i < s.length; i++) {
    const k = s.key(i);
    if (k && k.startsWith("ados.provider.") && k.endsWith(".key")) {
      const v = s.getItem(k);
      const id = k.slice("ados.provider.".length, -".key".length);
      // Encrypted values count as configured — they're real keys behind a lock.
      if (isCiphertext(v) || isPlausibleKey(id, v)) return true;
    }
  }
  return false;
}

/** Plausibility check for a stored API key. We deliberately keep this LOOSE:
 *  the only authoritative validation is Save+Verify (which calls the real API).
 *  Strict per-provider prefix checks here would mark working keys as missing
 *  when the provider's key format changes (it has — OpenRouter ships keys with
 *  both `sk-or-` and other prefixes; some Gemini keys are shorter than 30 chars
 *  depending on how the user provisioned them).
 *
 *  Length-only check: a string of 12+ characters has enough entropy that it's
 *  almost certainly a real key. A typo'd "abc123" doesn't pass. The original
 *  `length > 8` threshold passed obviously bogus "invalid!" (audit #23); 12
 *  is the right floor without being prefix-strict. */
function isPlausibleKey(_providerId: string, key: string | null): boolean {
  if (!key) return false;
  const k = key.trim();
  if (k.length < 16) return false;
  // Real keys are a single opaque token: no whitespace, and enough distinct
  // characters to rule out placeholder junk ("aaaaaaaaaaaaaaaaaa", "your-key-here").
  if (/\s/.test(k)) return false;
  if (new Set(k).size < 10) return false;
  return true;
}

/** Return every provider id that has a saved key (length > 8) in localStorage.
 *  Used by the launch wizard's failover logic to pick a backup when the active
 *  provider stalls. */
export function getProvidersWithKeys(): string[] {
  migrateLegacyOnce();
  const s = safeLocal();
  if (!s) return [];
  const ids: string[] = [];
  for (let i = 0; i < s.length; i++) {
    const k = s.key(i);
    if (k && k.startsWith("ados.provider.") && k.endsWith(".key")) {
      const id = k.slice("ados.provider.".length, -".key".length);
      // Resolve through the vault: callers (failover, vision fallback, the
      // regenerate dialog) need keys they can actually USE right now, so a
      // key sitting behind a locked vault must not be offered.
      const v = resolveStoredValue(k, s.getItem(k));
      if (id && isPlausibleKey(id, v)) ids.push(id);
    }
  }
  return ids;
}

// --- Brand brain ---
export function getActiveBrainId(): string | null {
  return safeLocal()?.getItem(KEYS.activeBrain) ?? null;
}
export function setActiveBrainId(id: string | null): void {
  const s = safeLocal();
  if (!s) return;
  const prev = s.getItem(KEYS.activeBrain);
  if (id) s.setItem(KEYS.activeBrain, id);
  else s.removeItem(KEYS.activeBrain);
  if (prev !== id && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("ados:active-brain-changed", { detail: { id } }));
  }
}

// --- Usage ---
// Coerce a parsed localStorage value to a finite number so a corrupt "NaN"
// entry can't poison every downstream total. (Audit: NaN poisoning.)
function finiteOrZero(v: string | null | undefined): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}
export function getUsage(): { cost: number; input: number; output: number } {
  const s = safeLocal();
  return {
    cost: finiteOrZero(s?.getItem(KEYS.totalCost)),
    input: finiteOrZero(s?.getItem(KEYS.totalIn)),
    output: finiteOrZero(s?.getItem(KEYS.totalOut)),
  };
}
export function addUsage(cost: number, input: number, output: number): void {
  const s = safeLocal();
  if (!s) return;
  const cur = getUsage();
  // Ignore a non-finite incoming delta so one bad estimate can't corrupt totals.
  const nextCost = cur.cost + (Number.isFinite(cost) ? cost : 0);
  const nextIn = cur.input + (Number.isFinite(input) ? input : 0);
  const nextOut = cur.output + (Number.isFinite(output) ? output : 0);
  // Safari private mode throws QuotaExceededError synchronously on setItem.
  // Without this guard the exception propagates to every LLM call site and
  // crashes generation result-save. Usage tracking degrades gracefully.
  // (Audit finding #29.)
  // Never persist a non-finite total — fall back to the previous finite value.
  try {
    s.setItem(KEYS.totalCost, String(Number.isFinite(nextCost) ? nextCost : cur.cost));
    s.setItem(KEYS.totalIn, String(Number.isFinite(nextIn) ? nextIn : cur.input));
    s.setItem(KEYS.totalOut, String(Number.isFinite(nextOut) ? nextOut : cur.output));
  } catch {}
}
export function resetUsage(): void {
  const s = safeLocal();
  if (!s) return;
  s.removeItem(KEYS.totalCost);
  s.removeItem(KEYS.totalIn);
  s.removeItem(KEYS.totalOut);
}

// --- Onboarding / tour ---
export function isOnboarded(): boolean {
  return safeLocal()?.getItem(KEYS.onboarded) === "1";
}
export function setOnboarded(): void {
  safeLocal()?.setItem(KEYS.onboarded, "1");
}
export function hasSeenTour(): boolean {
  return safeLocal()?.getItem(KEYS.tourSeen) === "1";
}
export function markTourSeen(): void {
  safeLocal()?.setItem(KEYS.tourSeen, "1");
}

// --- Generator preferences ---
export function getLanguage(): string {
  return safeLocal()?.getItem(KEYS.language) ?? "English";
}
export function setLanguage(v: string): void {
  safeLocal()?.setItem(KEYS.language, v);
}
export function getToneOverride(): string {
  return safeLocal()?.getItem(KEYS.toneOverride) ?? "";
}
export function setToneOverride(v: string): void {
  safeLocal()?.setItem(KEYS.toneOverride, v);
}
export function getCharWarn(): boolean {
  return safeLocal()?.getItem(KEYS.charWarn) !== "0";
}
export function setCharWarn(v: boolean): void {
  safeLocal()?.setItem(KEYS.charWarn, v ? "1" : "0");
}
export function getAutoSave(): boolean {
  return safeLocal()?.getItem(KEYS.autoSave) !== "0";
}
export function setAutoSave(v: boolean): void {
  safeLocal()?.setItem(KEYS.autoSave, v ? "1" : "0");
}

// Optional Jina Reader API key (paid tier) — bypasses free-tier rate limits for URL ingest.
export function getJinaKey(): string {
  return resolveStoredValue("ados.jina_key", safeLocal()?.getItem("ados.jina_key") ?? "");
}
export function setJinaKey(v: string): void {
  const s = safeLocal();
  if (!s) return;
  if (!v) {
    s.removeItem("ados.jina_key");
    forgetPlaintext("ados.jina_key");
    return;
  }
  writeSecret("ados.jina_key", v);
}

// --- Backward-compat shims for legacy single-provider callers ---
// Resolve to the ACTIVE provider's key, not a global one.

export function getApiKey(): string {
  migrateLegacyOnce();
  const pid = getActiveProviderId();
  if (!pid) return "";
  return getProviderKey(pid);
}
export function setApiKey(key: string): void {
  // Caller had no provider context — store against the ACTIVE provider, default to anthropic.
  const pid = getActiveProviderId() ?? "anthropic";
  if (!getActiveProviderId()) setActiveProviderId(pid);
  setProviderKey(pid, key);
}
export function clearApiKey(): void {
  const pid = getActiveProviderId();
  if (pid) clearProviderKey(pid);
}

export type ModelKey = string;
export function getModel(): ModelKey {
  // Hardcoded "claude-sonnet-4-6" as fallback would break non-Anthropic users on a
  // cache miss — Groq/Mistral/etc. don't have that model ID. Fall back to the
  // active provider's own default. (Audit finding #22.)
  const pid = getActiveProviderId();
  if (!pid) return "";
  const fromStorage = getActiveModelId(pid);
  if (fromStorage) return fromStorage;
  return getProvider(pid)?.default_model ?? "";
}
export function setModel(m: ModelKey): void {
  const pid = getActiveProviderId() ?? "anthropic";
  setActiveModelId(pid, m);
}
