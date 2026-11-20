/**
 * Optional at-rest encryption for provider API keys.
 *
 * THREAT MODEL — read this before judging the design.
 *
 * What this protects against: a key sitting in plain text in localStorage,
 * readable by anything with DOM access — a malicious browser extension, a
 * shared/synced browser profile, someone with the machine, or a snapshot file
 * copied off disk when key-sync is enabled. That is a real and common exposure
 * for a BYOK product whose whole pitch is "your keys never leave the browser".
 *
 * What it CANNOT protect against: an XSS payload running while the vault is
 * unlocked. Once unlocked, the plaintext key is in memory by definition,
 * because the app has to send it to the provider. Anyone claiming a browser
 * app can defeat same-origin script execution is selling something. The honest
 * framing — and what the UI says — is "encrypted at rest, unlocked per session".
 *
 * Design:
 *  - PBKDF2-SHA256, 600k iterations (OWASP 2023 floor) → AES-GCM 256 key.
 *  - Per-key random IV; salt is per-vault and stored alongside.
 *  - The derived key lives in a module-level variable for the session only. It
 *    is never persisted — no sessionStorage, no IndexedDB — so closing the tab
 *    re-locks the vault.
 *  - Opt-in. With no vault configured, keys stay in plain localStorage exactly
 *    as before; nothing about the existing flow changes.
 */

const SALT_KEY = "ados.vault.salt";
const CHECK_KEY = "ados.vault.check";
const ENABLED_KEY = "ados.vault.enabled";
/** Ciphertext lives under the same per-provider key name with this prefix, so
 *  an encrypted value is never mistaken for a plaintext one. */
export const CIPHER_PREFIX = "enc.v1:";

const PBKDF2_ITERATIONS = 600_000;
const CHECK_PLAINTEXT = "openadkit-vault-ok";

/** Session-only derived key. Cleared on lock and on tab close (module reset). */
let sessionKey: CryptoKey | null = null;

/**
 * Synchronous plaintext cache.
 *
 * getProviderKey() is called from deep inside synchronous code paths that
 * can't be made async without rewriting every call site, so decrypted values
 * are cached in memory once unlocked. The cache is cleared on lock.
 */
const plaintextCache = new Map<string, string>();

function safeLocal(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function subtle(): SubtleCrypto | null {
  if (typeof crypto === "undefined" || !crypto.subtle) return null;
  return crypto.subtle;
}

/** True when the browser can actually do this (needs a secure context). */
export function isVaultSupported(): boolean {
  return Boolean(subtle());
}

/** True when the user has turned encryption on. */
export function isVaultEnabled(): boolean {
  return safeLocal()?.getItem(ENABLED_KEY) === "1";
}

/** True when a passphrase has been entered this session. */
export function isVaultUnlocked(): boolean {
  return sessionKey !== null;
}

function toB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  const CHUNK = 0x8000;
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += CHUNK) {
    parts.push(String.fromCharCode(...bytes.subarray(i, i + CHUNK)));
  }
  return btoa(parts.join(""));
}

function fromB64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const s = subtle();
  if (!s) throw new Error("WebCrypto unavailable — encryption needs a secure context (https or localhost).");
  const material = await s.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, [
    "deriveKey",
  ]);
  return s.deriveKey(
    { name: "PBKDF2", salt: salt as unknown as BufferSource, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptWith(key: CryptoKey, plaintext: string): Promise<string> {
  const s = subtle()!;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await s.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext));
  return `${CIPHER_PREFIX}${toB64(iv.buffer)}.${toB64(ct)}`;
}

async function decryptWith(key: CryptoKey, payload: string): Promise<string> {
  const s = subtle()!;
  const body = payload.slice(CIPHER_PREFIX.length);
  const dot = body.indexOf(".");
  if (dot < 0) throw new Error("Malformed encrypted value.");
  const iv = fromB64(body.slice(0, dot));
  const ct = fromB64(body.slice(dot + 1));
  const plain = await s.decrypt(
    { name: "AES-GCM", iv: iv as unknown as BufferSource },
    key,
    ct as unknown as BufferSource
  );
  return new TextDecoder().decode(plain);
}

export function isCiphertext(v: string | null | undefined): boolean {
  return typeof v === "string" && v.startsWith(CIPHER_PREFIX);
}

/**
 * Turn encryption on: derive a key from the passphrase, store a verifier blob,
 * and re-encrypt every plaintext provider key currently in localStorage.
 */
export async function enableVault(passphrase: string): Promise<void> {
  const s = safeLocal();
  if (!s) throw new Error("localStorage unavailable.");
  if (passphrase.length < 8) throw new Error("Use a passphrase of at least 8 characters.");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(passphrase, salt);
  s.setItem(SALT_KEY, toB64(salt.buffer));
  s.setItem(CHECK_KEY, await encryptWith(key, CHECK_PLAINTEXT));
  s.setItem(ENABLED_KEY, "1");
  sessionKey = key;
  await encryptExistingKeys();
  window.dispatchEvent(new Event("ados:vault-changed"));
}

/** Re-encrypt every plaintext `ados.provider.*.key` (and the Jina key). */
async function encryptExistingKeys(): Promise<void> {
  const s = safeLocal();
  if (!s || !sessionKey) return;
  const targets: string[] = [];
  for (let i = 0; i < s.length; i++) {
    const k = s.key(i);
    if (!k) continue;
    if ((k.startsWith("ados.provider.") && k.endsWith(".key")) || k === "ados.jina_key") targets.push(k);
  }
  for (const k of targets) {
    const v = s.getItem(k);
    if (!v || isCiphertext(v)) continue;
    const ct = await encryptWith(sessionKey, v);
    // Skip if the value changed (cleared / replaced) while we were encrypting.
    if (s.getItem(k) !== v) continue;
    s.setItem(k, ct);
    plaintextCache.set(k, v);
  }
}

/** Unlock for this session. Returns false on a wrong passphrase. */
export async function unlockVault(passphrase: string): Promise<boolean> {
  const s = safeLocal();
  if (!s) return false;
  const saltB64 = s.getItem(SALT_KEY);
  const check = s.getItem(CHECK_KEY);
  if (!saltB64 || !check) return false;
  try {
    const key = await deriveKey(passphrase, fromB64(saltB64));
    const plain = await decryptWith(key, check);
    if (plain !== CHECK_PLAINTEXT) return false;
    sessionKey = key;
    // Keys saved while the vault was locked were stored as plaintext (there
    // was no key to encrypt with). Encrypt them now — previously nothing ever
    // did, so they stayed plaintext forever. Then warm the sync cache.
    await encryptExistingKeys();
    await primePlaintextCache();
    window.dispatchEvent(new Event("ados:vault-changed"));
    return true;
  } catch {
    // AES-GCM auth failure on a wrong passphrase throws — that IS the check.
    return false;
  }
}

/** Drop the session key. Encrypted values stay encrypted. */
export function lockVault(): void {
  sessionKey = null;
  // Decrypted keys must not outlive the lock.
  plaintextCache.clear();
  window.dispatchEvent(new Event("ados:vault-changed"));
}

/**
 * Turn encryption off, decrypting everything back to plaintext. Requires the
 * vault to be unlocked — otherwise we'd orphan the keys.
 */
export async function disableVault(): Promise<void> {
  const s = safeLocal();
  if (!s) return;
  if (!sessionKey) throw new Error("Unlock first — otherwise your keys would be left unreadable.");
  for (let i = 0; i < s.length; i++) {
    const k = s.key(i);
    if (!k) continue;
    if (!((k.startsWith("ados.provider.") && k.endsWith(".key")) || k === "ados.jina_key")) continue;
    const v = s.getItem(k);
    if (!isCiphertext(v)) continue;
    try {
      s.setItem(k, await decryptWith(sessionKey, v!));
    } catch {
      // Leave undecryptable values alone rather than destroying them.
    }
  }
  s.removeItem(SALT_KEY);
  s.removeItem(CHECK_KEY);
  s.removeItem(ENABLED_KEY);
  sessionKey = null;
  window.dispatchEvent(new Event("ados:vault-changed"));
}

/** Decrypt every stored key into the in-memory cache. Call right after unlock. */
export async function primePlaintextCache(): Promise<void> {
  const s = safeLocal();
  plaintextCache.clear();
  if (!s || !sessionKey) return;
  for (let i = 0; i < s.length; i++) {
    const k = s.key(i);
    if (!k) continue;
    if (!((k.startsWith("ados.provider.") && k.endsWith(".key")) || k === "ados.jina_key")) continue;
    const v = s.getItem(k);
    if (!isCiphertext(v)) continue;
    try {
      plaintextCache.set(k, await decryptWith(sessionKey, v!));
    } catch {
      /* skip */
    }
  }
}

/** Resolve a stored value, transparently decrypting when possible.
 *  Returns "" for ciphertext we can't read (locked vault) so callers behave
 *  exactly as they do for a missing key. */
export function resolveStoredValue(storageKey: string, raw: string | null): string {
  if (!raw) return "";
  if (!isCiphertext(raw)) return raw;
  return plaintextCache.get(storageKey) ?? "";
}

/** Encrypt-on-write when the vault is unlocked; plaintext otherwise. */
export async function prepareForStorage(storageKey: string, value: string): Promise<string> {
  if (!isVaultEnabled() || !sessionKey) return value;
  plaintextCache.set(storageKey, value);
  return encryptWith(sessionKey, value);
}

/** Drop one cached plaintext (the stored value was removed). */
export function forgetPlaintext(storageKey: string): void {
  plaintextCache.delete(storageKey);
}

export function clearPlaintextCache(): void {
  plaintextCache.clear();
}
