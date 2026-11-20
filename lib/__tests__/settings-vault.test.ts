/**
 * Settings + key-vault state machine, against real WebCrypto (Node's
 * crypto.subtle) and an in-memory localStorage.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { installBrowserShim, removeBrowserShim, type MemoryStorage } from "./helpers/browser-shim";
import { PROVIDER_BY_ID, findModel } from "../providers";

let storage: MemoryStorage;

async function freshModules() {
  vi.resetModules();
  const vault = await import("../key-vault");
  const settings = await import("../settings");
  return { vault, settings };
}

const KEY_NAME = "ados.provider.groq.key";
const GROQ_KEY = "gsk_live_abcdefghijklmnop1234";

/** Let pending encrypt promises settle. */
async function settle() {
  for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 5));
}

beforeEach(() => {
  storage = installBrowserShim();
});
afterEach(() => removeBrowserShim());

describe("retired-model migration map", () => {
  it("every migration target exists in that provider's catalog", async () => {
    const { settings } = await freshModules();
    for (const [providerId, map] of Object.entries(settings.RETIRED_MODEL_IDS)) {
      expect(PROVIDER_BY_ID[providerId], `unknown provider ${providerId}`).toBeDefined();
      for (const [from, to] of Object.entries(map)) {
        expect(findModel(providerId, to), `${providerId}: ${from} -> ${to} is not in the catalog`).not.toBeNull();
        expect(findModel(providerId, from), `${providerId}: ${from} is still in the catalog — not retired`).toBeNull();
      }
    }
  });

  it("rewrites a retired Cerebras model to a model Cerebras actually lists", async () => {
    storage.setItem("ados.provider.cerebras.model", "llama-3.1-8b");
    const { settings } = await freshModules();
    const m = settings.getActiveModelId("cerebras")!;
    expect(findModel("cerebras", m)).not.toBeNull();
  });

  it("is scoped per provider (a Groq selection is not rewritten by another provider's row)", async () => {
    storage.setItem("ados.provider.groq.model", "llama-3.3-70b");
    const { settings } = await freshModules();
    expect(settings.getActiveModelId("groq")).toBe("llama-3.3-70b");
    expect(storage.getItem("ados.provider.groq.model")).toBe("llama-3.3-70b");
  });

  it("does not rewrite the live claude-opus-4-6", async () => {
    storage.setItem("ados.provider.anthropic.model", "claude-opus-4-6");
    const { settings } = await freshModules();
    expect(settings.getActiveModelId("anthropic")).toBe("claude-opus-4-6");
  });
});

describe("key vault", () => {
  it("lockVault clears the plaintext cache", async () => {
    const { vault, settings } = await freshModules();
    settings.setProviderKey("groq", GROQ_KEY);
    await vault.enableVault("correct horse battery");
    expect(vault.isCiphertext(storage.getItem(KEY_NAME))).toBe(true);
    await vault.primePlaintextCache();
    expect(settings.getProviderKey("groq")).toBe(GROQ_KEY);
    vault.lockVault();
    expect(settings.getProviderKey("groq")).toBe("");
  }, 20_000);

  it("a key saved while the vault is locked is encrypted on the next unlock", async () => {
    const first = await freshModules();
    await first.vault.enableVault("correct horse battery");
    first.vault.lockVault();
    first.settings.setProviderKey("groq", GROQ_KEY);
    await settle();
    expect(storage.getItem(KEY_NAME)).toBe(GROQ_KEY); // locked → plaintext for now
    expect(await first.vault.unlockVault("correct horse battery")).toBe(true);
    const stored = storage.getItem(KEY_NAME);
    expect(first.vault.isCiphertext(stored)).toBe(true);
    expect(first.settings.getProviderKey("groq")).toBe(GROQ_KEY);
  }, 20_000);

  it("clearing a key before the async encrypt resolves is not undone", async () => {
    const { vault, settings } = await freshModules();
    await vault.enableVault("correct horse battery");
    settings.setProviderKey("groq", GROQ_KEY);
    settings.clearProviderKey("groq");
    await settle();
    expect(storage.getItem(KEY_NAME)).toBeNull();
    expect(settings.getProviderKey("groq")).toBe("");
  }, 20_000);

  it("a newer key saved before the first encrypt resolves wins", async () => {
    const { vault, settings } = await freshModules();
    await vault.enableVault("correct horse battery");
    settings.setProviderKey("groq", GROQ_KEY);
    settings.setProviderKey("groq", "gsk_live_second_key_zyxwvu987");
    await settle();
    expect(settings.getProviderKey("groq")).toBe("gsk_live_second_key_zyxwvu987");
  }, 20_000);

  it("clearing the Jina key before its encrypt resolves is not undone", async () => {
    const { vault, settings } = await freshModules();
    await vault.enableVault("correct horse battery");
    settings.setJinaKey("jina_abcdefghijklmnopqrstuvwxyz");
    settings.setJinaKey("");
    await settle();
    expect(storage.getItem("ados.jina_key")).toBeNull();
  }, 20_000);
});
