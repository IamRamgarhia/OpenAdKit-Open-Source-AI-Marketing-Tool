"use client";

import { useCallback, useEffect, useState } from "react";
import { Lock, Loader2 } from "lucide-react";
import {
  isVaultEnabled,
  isVaultUnlocked,
  unlockVault,
  primePlaintextCache,
} from "@/lib/key-vault";

/**
 * Session unlock prompt for the optional encrypted key vault.
 *
 * Rendered in the root layout so it appears once per session on whichever page
 * the user lands on. It's a banner, not a hard modal: with the vault locked the
 * app is still fully usable for everything that doesn't need a provider key
 * (browsing history, checklists, learning content, editing brand brains), and
 * blocking those would be worse than the risk it protects against.
 */
export function VaultGate() {
  const [needsUnlock, setNeedsUnlock] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sync = useCallback(() => {
    setNeedsUnlock(isVaultEnabled() && !isVaultUnlocked());
  }, []);

  useEffect(() => {
    sync();
    window.addEventListener("ados:vault-changed", sync);
    return () => window.removeEventListener("ados:vault-changed", sync);
  }, [sync]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const ok = await unlockVault(passphrase);
      if (!ok) {
        setError("That passphrase doesn't match.");
        return;
      }
      // Decrypt everything once so the synchronous getProviderKey() call sites
      // deep in the generation path don't each need to become async.
      await primePlaintextCache();
      setPassphrase("");
      sync();
    } finally {
      setBusy(false);
    }
  }

  if (!needsUnlock) return null;

  return (
    <div className="border-b border-live/40 bg-live/6 px-4 md:px-10 py-2">
      <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
        <Lock size={12} className="text-live shrink-0" />
        <span className="text-[12px] text-ink">
          Your API keys are encrypted. Unlock for this session to generate.
        </span>
        <input
          type="password"
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          placeholder="passphrase"
          className="input-base w-auto min-w-[180px] text-xs"
          autoComplete="current-password"
          aria-label="Vault passphrase"
        />
        <button type="submit" disabled={busy || !passphrase} className="btn-primary">
          {busy ? <Loader2 size={11} className="animate-spin" /> : <Lock size={11} />}
          unlock
        </button>
        {error ? (
          <span className="text-[11px] font-mono uppercase tracking-ui-wide text-neg">{error}</span>
        ) : null}
      </form>
    </div>
  );
}
