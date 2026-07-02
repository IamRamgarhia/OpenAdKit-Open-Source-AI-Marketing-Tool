import { getProvider } from "./providers";

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
      sonnet: "claude-sonnet-4-6",
      opus: "claude-opus-4-7",
      haiku: "claude-haiku-4-5-20251001",
    };
    if (legacyModel && modelMap[legacyModel]) {
      s.setItem(providerModelName("anthropic"), modelMap[legacyModel]);
    }
    s.removeItem("ados.api_key");
    s.removeItem("ados.model");
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

export function getProviderKey(providerId: string): string {
  migrateLegacyOnce();
  return safeLocal()?.getItem(providerKeyName(providerId)) ?? "";
}
export function setProviderKey(providerId: string, key: string): void {
  safeLocal()?.setItem(providerKeyName(providerId), key);
}
export function clearProviderKey(providerId: string): void {
  safeLocal()?.removeItem(providerKeyName(providerId));
}

export function getActiveModelId(providerId: string): string | null {
  return safeLocal()?.getItem(providerModelName(providerId)) ?? null;
}
export function setActiveModelId(providerId: string, model: string): void {
  safeLocal()?.setItem(providerModelName(providerId), model);
}

export function hasAnyKeyConfigured(): boolean {
  migrateLegacyOnce();
  const s = safeLocal();
  if (!s) return false;
  for (let i = 0; i < s.length; i++) {
    const k = s.key(i);
    if (k && k.startsWith("ados.provider.") && k.endsWith(".key")) {
      const v = s.getItem(k);
      const id = k.slice("ados.provider.".length, -".key".length);
      if (isPlausibleKey(id, v)) return true;
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
  return key.trim().length >= 12;
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
      const v = s.getItem(k);
      const id = k.slice("ados.provider.".length, -".key".length);
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
  return safeLocal()?.getItem("ados.jina_key") ?? "";
}
export function setJinaKey(v: string): void {
  const s = safeLocal();
  if (!s) return;
  if (v) s.setItem("ados.jina_key", v);
  else s.removeItem("ados.jina_key");
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
