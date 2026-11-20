"use client";

import { useEffect, useRef, useState } from "react";
import {
  KeyRound, Eye, EyeOff, Save, CheckCircle2, Loader2, Download, Upload, Trash2, ExternalLink, Zap, Lock, Unlock, AlertTriangle,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import {
  getActiveProviderId, setActiveProviderId, clearActiveProviderId,
  getProviderKey, setProviderKey, clearProviderKey, hasProviderKey,
  getActiveModelId, setActiveModelId, getUsage, resetUsage,
  getLanguage, setLanguage, getToneOverride, setToneOverride,
  getCharWarn, setCharWarn, getAutoSave, setAutoSave,
  getJinaKey, setJinaKey,
} from "@/lib/settings";
import { PROVIDERS, type Provider } from "@/lib/providers";
import { verifyApiKey, type KeyCheckResult } from "@/lib/llm";
import { exportAll, importAll, wipeAll } from "@/lib/storage";
import { formatCost, formatTokens } from "@/lib/utils";
import { CURRENCIES, getCurrencyCode, setCurrencyCode } from "@/lib/currency";
import { isHostedMode } from "@/lib/env";
import { getProviderLimits } from "@/lib/provider-limits";
import {
  getMonthlyBudgetUsd, setMonthlyBudgetUsd, isHardStopEnabled, setHardStopEnabled,
  getBudgetStatus, BUDGET_WARN_AT, type BudgetStatus,
} from "@/lib/budget";
import {
  isVaultSupported, isVaultEnabled, isVaultUnlocked, enableVault, disableVault,
  lockVault, primePlaintextCache, clearPlaintextCache,
} from "@/lib/key-vault";
import { useIsClient } from "@/lib/hooks/use-is-client";
import { checkForUpdate, setUpdateChecksEnabled, updateChecksEnabled } from "@/components/UpdateNotice";
import { McpConnectPanel } from "@/components/McpConnectPanel";

/**
 * NOT wrapped in <ApiKeyGate>. Settings is where you ADD a key — gating it on
 * already having one created a dead end: the StatusBar's "No key" badge links
 * here, and the gate bounced you straight back to /setup. Deleting your only
 * key also locked you out of the page you'd use to add another.
 */
export default function SettingsPage() {
  // Everything below reads localStorage in lazy useState initializers, so it
  // mounts only on the client (server + hydration render the placeholder).
  const isClient = useIsClient();
  if (!isClient) {
    return (
      <div className="min-h-[40vh] grid place-items-center text-sm text-ink-muted" role="status">
        Loading settings…
      </div>
    );
  }
  return <SettingsInner />;
}

function initialKeys(): Record<string, string> {
  const ks: Record<string, string> = {};
  for (const p of PROVIDERS) ks[p.id] = getProviderKey(p.id);
  return ks;
}
function initialModels(): Record<string, string> {
  const ms: Record<string, string> = {};
  for (const p of PROVIDERS) ms[p.id] = getActiveModelId(p.id) ?? p.default_model;
  return ms;
}

function SettingsInner() {
  const [activeId, setActiveId] = useState<string>(() => getActiveProviderId() ?? "");
  const [keys, setKeys] = useState<Record<string, string>>(initialKeys);
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [modelsByProvider, setModelsByProvider] = useState<Record<string, string>>(initialModels);
  const [testing, setTesting] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState<string | null>(null);
  // Per-provider verification result, shown inline on that provider's card and
  // kept until the next attempt. The old UI flashed "saved" for 1500ms and put
  // failures in a single banner at the top of a 9-provider list — easy to miss
  // entirely, and ambiguous about which card it referred to.
  const [verify, setVerify] = useState<Record<string, KeyCheckResult | null>>({});
  /** Provider ids with a key actually persisted (survives a locked vault). */
  const [savedIds, setSavedIds] = useState<string[]>(() => PROVIDERS.filter((p) => hasProviderKey(p.id)).map((p) => p.id));
  const refreshSavedIds = () => setSavedIds(PROVIDERS.filter((p) => hasProviderKey(p.id)).map((p) => p.id));
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState(getUsage);
  const [lang, setLang] = useState(getLanguage);
  const [tone, setTone] = useState(getToneOverride);
  const [charWarn, setCharWarnState] = useState(getCharWarn);
  const [autoSave, setAutoSaveState] = useState(getAutoSave);
  const [updateCheck, setUpdateCheckState] = useState(updateChecksEnabled);
  const [updateMsg, setUpdateMsg] = useState("");
  const [jina, setJinaState] = useState(getJinaKey);
  const [currency, setCurrencyState] = useState(getCurrencyCode);
  const [budget, setBudget] = useState(() => {
    const limit = getMonthlyBudgetUsd();
    return limit ? String(limit) : "";
  });
  const [hardStop, setHardStop] = useState(isHardStopEnabled);
  const [budgetStatus, setBudgetStatus] = useState<BudgetStatus | null>(null);
  const [vaultSupported] = useState(isVaultSupported);
  const [vaultEnabled, setVaultEnabled] = useState(isVaultEnabled);
  const [vaultUnlocked, setVaultUnlocked] = useState(isVaultUnlocked);
  const [vaultPass, setVaultPass] = useState("");
  const [vaultError, setVaultError] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Async status + live vault changes (external system → state in callbacks).
    let cancelled = false;
    getBudgetStatus()
      .then((st) => {
        if (!cancelled) setBudgetStatus(st);
      })
      .catch(() => {});
    const onVault = () => {
      setVaultEnabled(isVaultEnabled());
      setVaultUnlocked(isVaultUnlocked());
    };
    window.addEventListener("ados:vault-changed", onVault);
    return () => {
      cancelled = true;
      window.removeEventListener("ados:vault-changed", onVault);
    };
  }, []);

  function persistBudget(v: string) {
    setBudget(v);
    setMonthlyBudgetUsd(Number(v));
    getBudgetStatus().then(setBudgetStatus).catch(() => {});
  }
  function persistHardStop(v: boolean) {
    setHardStop(v);
    setHardStopEnabled(v);
    getBudgetStatus().then(setBudgetStatus).catch(() => {});
  }

  function refreshVault() {
    setVaultEnabled(isVaultEnabled());
    setVaultUnlocked(isVaultUnlocked());
  }

  async function turnOnVault() {
    setVaultError(null);
    try {
      await enableVault(vaultPass);
      await primePlaintextCache();
      setVaultPass("");
      refreshVault();
    } catch (e: any) {
      setVaultError(e?.message ?? "Could not enable encryption.");
    }
  }

  async function turnOffVault() {
    if (!confirm("Decrypt your API keys back to plain storage on this browser?")) return;
    setVaultError(null);
    try {
      await disableVault();
      clearPlaintextCache();
      refreshVault();
    } catch (e: any) {
      setVaultError(e?.message ?? "Could not disable encryption.");
    }
  }

  function persistJina(v: string) { setJinaState(v.trim()); setJinaKey(v.trim()); }

  async function saveProvider(p: Provider) {
    setError(null);
    const k = keys[p.id] ?? "";
    if (!k.trim()) {
      setVerify((v) => ({ ...v, [p.id]: { ok: false, authenticated: false, message: `Paste a ${p.name} key first.` } }));
      return;
    }
    setVerify((v) => ({ ...v, [p.id]: null }));
    setTesting(p.id);
    // try/finally — without it a network timeout/error would leave `testing`
    // stuck and the verify button permanently disabled until page reload.
    // (Audit finding #30.)
    let result: KeyCheckResult;
    try {
      result = await verifyApiKey(k, p.id);
    } catch (e: any) {
      result = { ok: false, authenticated: false, message: `Key check failed: ${e?.message ?? "network error"}.` };
    } finally {
      setTesting(null);
    }
    setVerify((v) => ({ ...v, [p.id]: result }));

    // Save whenever the key AUTHENTICATED, even if the call didn't fully
    // succeed. A 429 means the key is valid and merely throttled; discarding
    // it there would make the user delete a working key.
    if (!result.authenticated) return;

    setProviderKey(p.id, k);
    refreshSavedIds();
    setActiveModelId(p.id, modelsByProvider[p.id] ?? p.default_model);
    // Make this the active provider when nothing else is active. Without it, a
    // user could save + verify their first key here and still hit "No API key"
    // on every generator, because getApiKey() resolves against the ACTIVE
    // provider and there wasn't one.
    if (!getActiveProviderId()) {
      setActiveProviderId(p.id);
      setActiveId(p.id);
      window.dispatchEvent(new Event("ados:provider-changed"));
    }
    setSavedFlash(p.id);
    setTimeout(() => setSavedFlash(null), 1500);
  }

  function makeActive(p: Provider) {
    if (!keys[p.id]) {
      setError(`Add a ${p.name} key first.`);
      return;
    }
    setActiveProviderId(p.id);
    setActiveId(p.id);
    window.dispatchEvent(new Event("ados:provider-changed"));
  }

  function removeProviderKey(p: Provider) {
    if (!confirm(`Forget the ${p.name} key on this browser?`)) return;
    clearProviderKey(p.id);
    const nextKeys = { ...keys, [p.id]: "" };
    setKeys(nextKeys);
    setVerify((v) => ({ ...v, [p.id]: null }));
    refreshSavedIds();
    // If we just deleted the ACTIVE provider's key, hand the active slot to
    // another configured provider (or clear it). Leaving it pointed at a
    // keyless provider puts the app in a "configured but unusable" state where
    // every generator fails with "No API key" despite other keys being saved.
    if (getActiveProviderId() === p.id) {
      // Persisted keys, not typed-but-unsaved ones — handing the active slot to
      // a provider whose key was never saved just recreates the dead state.
      const replacement = PROVIDERS.find((q) => q.id !== p.id && hasProviderKey(q.id));
      if (replacement) {
        setActiveProviderId(replacement.id);
        setActiveId(replacement.id);
      } else {
        clearActiveProviderId();
        setActiveId("");
      }
      window.dispatchEvent(new Event("ados:provider-changed"));
    }
  }

  async function doExport() {
    const json = await exportAll();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `openadkit-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    // Deferred revoke — revoking in the same task can cancel the download in
    // Firefox/Safari before the browser has read the blob.
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 0);
  }
  async function doImport(file: File) {
    try {
      const text = await file.text();
      const res = await importAll(text);
      alert(`Imported ${res.brains} brain(s) and ${res.ads} ad(s).`);
      window.dispatchEvent(new Event("ados:brains-changed"));
    } catch (e: any) {
      alert(`Import failed: ${e?.message ?? "unknown"}`);
    }
  }
  async function doWipe() {
    if (!confirm("This will erase ALL local data: keys, brains, history, settings. Continue?")) return;
    await wipeAll();
    localStorage.clear();
    window.location.assign(new URL("/setup", window.location.origin).toString());
  }

  function persistLang(v: string) { setLang(v); setLanguage(v); }
  function persistTone(v: string) { setTone(v); setToneOverride(v); }
  function persistCharWarn(v: boolean) { setCharWarnState(v); setCharWarn(v); }
  function persistAutoSave(v: boolean) { setAutoSaveState(v); setAutoSave(v); }
  function persistUpdateCheck(v: boolean) { setUpdateCheckState(v); setUpdateChecksEnabled(v); }
  async function checkUpdatesNow() {
    setUpdateMsg("Checking…");
    try {
      const r = await checkForUpdate();
      if (!r) setUpdateMsg("The OpenAdKit background service isn't running, so updates can't be checked from here.");
      else if (r.status === "network_error") setUpdateMsg("Couldn't reach GitHub. Check your internet connection.");
      else if (r.update_available) {
        setUpdateMsg(`Version ${r.latest} is available (you have ${r.current}).`);
        window.dispatchEvent(new Event("ados:update-check"));
      } else setUpdateMsg(`You're on the latest version (${r.current}).`);
    } catch {
      setUpdateMsg("Update check failed.");
    }
  }

  return (
    <div>
      <PageHeader scope="settings" title="Settings" subtitle="Providers, keys, model selection, preferences, data. All local." />

      <div className="space-y-4 stagger">
        <section className="border border-base-600 bg-base-900/40 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-muted">
              ai providers
              <a href="/providers" className="ml-2 text-info hover:underline normal-case tracking-normal font-sans text-[11px]">
                which one should I use? →
              </a>
            </h2>
            {/* Counts PERSISTED keys. Counting the input values meant a key you
                typed but never saved (or that failed verification) inflated the
                total. */}
            <span className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-faint">{savedIds.length} configured</span>
          </div>

          {error ? (
            <div className="border border-neg/40 bg-neg/5 text-neg text-[11px] px-3 py-2 font-mono uppercase tracking-ui-wide mb-3">
              {error}
            </div>
          ) : null}

          <div className="space-y-3">
            {PROVIDERS.map((p) => {
              const active = activeId === p.id;
              // Reflects what is actually STORED, not what's typed in the box.
              // Deriving this from the input meant typing a key that then failed
              // verification still flipped the card to "configured" and offered
              // "forget key" — for a key that was never saved.
              const hasKey = savedIds.includes(p.id);
              return (
                <div key={p.id} className={`border ${active ? "border-live bg-live/5" : "border-base-700 bg-base-900/30"} p-4`}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-start gap-2">
                      {p.category === "free" ? <Zap size={12} className="text-pos mt-1" /> : p.category === "freemium" ? <Zap size={12} className="text-live mt-1" /> : <Lock size={12} className="text-ink-faint mt-1" />}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-ink text-sm">{p.name}</span>
                          {active ? <span className="text-[9px] font-mono uppercase tracking-ui-mega text-live border border-live/40 px-1.5 py-0.5">active</span> : null}
                          {hasKey && !active ? <span className="text-[9px] font-mono uppercase tracking-ui-mega text-pos">configured</span> : null}
                        </div>
                        <p className="text-[11px] text-ink-muted mt-1 leading-relaxed">{p.description}</p>
                        {p.free_note ? <p className="text-[10px] font-mono uppercase tracking-ui-wide text-pos mt-1">{p.free_note}</p> : null}
                        {(() => {
                          const lim = getProviderLimits(p.id);
                          if (!lim) return null;
                          return (
                            <details className="mt-1">
                              <summary className={`cursor-pointer list-none text-[10px] font-mono uppercase tracking-ui-wide ${lim.has_free_tier ? "text-pos" : "text-ink-faint"} hover:text-ink transition`}>
                                ▸ rate limits · {lim.has_free_tier ? "free" : "paid"}
                              </summary>
                              <ul className="mt-2 ml-2 space-y-0.5 text-[11px] text-ink-muted leading-relaxed">
                                {lim.details.map((d, i) => (
                                  <li key={i} className="flex gap-1.5">
                                    <span className="text-ink-faint">·</span>
                                    <span>{d}</span>
                                  </li>
                                ))}
                                <li className="mt-1">
                                  <a href={lim.docs_url} target="_blank" rel="noreferrer" className="text-info hover:underline inline-flex items-center gap-0.5">
                                    official docs <ExternalLink size={9} />
                                  </a>
                                </li>
                              </ul>
                            </details>
                          );
                        })()}
                        <a href={p.get_key_url} target="_blank" rel="noreferrer" className="text-[10px] font-mono uppercase tracking-ui-wide text-info hover:underline inline-flex items-center gap-0.5 mt-1 ml-2">
                          get key <ExternalLink size={9} />
                        </a>
                      </div>
                    </div>
                    {hasKey && !active ? (
                      <button onClick={() => makeActive(p)} className="btn-ghost shrink-0">
                        make active
                      </button>
                    ) : null}
                  </div>

                  <div className="grid md:grid-cols-2 gap-2">
                    <div>
                      <label htmlFor={`apikey-${p.id}`} className="label flex items-center gap-1.5"><KeyRound size={10} /> api key</label>
                      <div className="relative">
                        <input
                          id={`apikey-${p.id}`}
                          type={showKey[p.id] ? "text" : "password"}
                          value={keys[p.id] ?? ""}
                          onChange={(e) => setKeys({ ...keys, [p.id]: e.target.value.trim() })}
                          placeholder={p.id === "anthropic" ? "sk-ant-…" : p.id === "google" ? "AIza…" : "sk-…"}
                          className="input-base pr-10 font-mono text-xs"
                          autoComplete="off"
                          spellCheck={false}
                        />
                        <button
                          type="button"
                          onClick={() => setShowKey({ ...showKey, [p.id]: !showKey[p.id] })}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-subtle hover:text-ink"
                          aria-label="Toggle key visibility"
                        >
                          {showKey[p.id] ? <EyeOff size={12} /> : <Eye size={12} />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label htmlFor={`model-${p.id}`} className="label flex items-center gap-2">
                        <span>model</span>
                        {p.supports_vision ? (
                          <span className="text-[9px] font-mono uppercase tracking-ui-wide text-live border border-live/40 px-1.5 py-0.5">
                            👁 vision-capable
                          </span>
                        ) : (
                          <span className="text-[9px] font-mono uppercase tracking-ui-wide text-ink-faint border border-base-700 px-1.5 py-0.5">
                            text-only
                          </span>
                        )}
                      </label>
                      <select
                        id={`model-${p.id}`}
                        value={modelsByProvider[p.id] ?? p.default_model}
                        onChange={(e) => setModelsByProvider({ ...modelsByProvider, [p.id]: e.target.value })}
                        className="input-base"
                      >
                        {p.models.map((m) => {
                          const vision = m.supports_vision ?? p.supports_vision;
                          return (
                            <option key={m.id} value={m.id}>
                              {vision ? "👁 " : ""}{m.label}
                            </option>
                          );
                        })}
                      </select>
                      {!p.supports_vision ? (
                        <p className="text-[10px] text-ink-subtle mt-1 font-mono uppercase tracking-ui-wide">
                          image upload disabled on this provider — switch to Anthropic, OpenAI 4.1+, Gemini, or OpenRouter
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {/* Verification result — inline, on the card it belongs to,
                      and it stays put until the next attempt. */}
                  {testing === p.id ? (
                    <div
                      role="status"
                      aria-live="polite"
                      className="mt-3 flex items-center gap-2 border border-base-600 bg-base-900/60 px-3 py-2 text-[12px] text-ink-muted"
                    >
                      <Loader2 size={12} className="animate-spin shrink-0 text-live" />
                      Checking the key against {p.name}…
                    </div>
                  ) : verify[p.id] ? (
                    <div
                      role="status"
                      aria-live="polite"
                      className={`mt-3 flex items-start gap-2 border px-3 py-2 text-[12px] leading-relaxed ${
                        verify[p.id]!.ok
                          ? "border-pos/40 bg-pos/6 text-pos"
                          : verify[p.id]!.authenticated
                            ? "border-live/40 bg-live/6 text-live"
                            : "border-neg/40 bg-neg/5 text-neg"
                      }`}
                    >
                      {verify[p.id]!.ok ? (
                        <CheckCircle2 size={13} className="shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                      )}
                      <span>
                        {verify[p.id]!.message}
                        {verify[p.id]!.ok && verify[p.id]!.modelId ? (
                          <span className="text-ink-muted"> (tested with {verify[p.id]!.modelId})</span>
                        ) : null}
                      </span>
                    </div>
                  ) : null}

                  <div className="flex items-center gap-2 mt-3 pt-2 border-t border-base-700">
                    <button onClick={() => saveProvider(p)} disabled={testing === p.id} className="btn-primary">
                      {testing === p.id ? <Loader2 size={11} className="animate-spin" /> : savedFlash === p.id ? <CheckCircle2 size={11} /> : <Save size={11} />}
                      {testing === p.id ? "verifying" : savedFlash === p.id ? "saved" : "save + verify"}
                    </button>
                    {hasKey ? (
                      <button onClick={() => removeProviderKey(p)} className="btn-ghost hover:text-neg">
                        <Trash2 size={11} /> forget key
                      </button>
                    ) : null}
                    {hasKey && !active ? (
                      <button onClick={() => makeActive(p)} className="btn-ghost">
                        set as active
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-2">
          <section className="border border-base-600 bg-base-900/40 p-5 space-y-4">
            <h2 className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-muted">preferences</h2>
            <div>
              <label className="label">default language for generated copy</label>
              <input className="input-base" value={lang} onChange={(e) => persistLang(e.target.value)} placeholder="English / Spanish / Hindi / Arabic …" />
            </div>
            <div>
              <label className="label">currency (budgets + cost displays)</label>
              <select
                className="input-base"
                value={currency}
                onChange={(e) => { setCurrencyState(e.target.value); setCurrencyCode(e.target.value); }}
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.symbol} {c.code} — {c.label}</option>
                ))}
              </select>
              <p className="text-[11px] text-ink-muted mt-1.5">
                Applied to budget inputs in optimizers + launch wizard, and to AI cost previews. Exchange rates are coarse approximations — accurate enough for previews, not accounting.
              </p>
            </div>
            <div>
              <label className="label">tone override (optional)</label>
              <input className="input-base" value={tone} onChange={(e) => persistTone(e.target.value)} placeholder="punchy, irreverent — overrides brand brain tone" />
            </div>
            <ToggleRow label="character-count warnings" desc="badges when output exceeds platform limits" v={charWarn} on={persistCharWarn} />
            <ToggleRow label="auto-save to history" desc="every generation goes into /history automatically" v={autoSave} on={persistAutoSave} />
            {!isHostedMode() ? (
              <div>
                <ToggleRow label="check for updates" desc="once a day, asks GitHub whether a newer OpenAdKit release exists (nothing else is sent)" v={updateCheck} on={persistUpdateCheck} />
                <div className="flex items-center gap-3 mt-1">
                  <button type="button" className="btn-ghost" onClick={checkUpdatesNow}>check now</button>
                  {updateMsg ? <span className="text-[11px] text-ink-muted" role="status">{updateMsg}</span> : null}
                </div>
              </div>
            ) : null}
            {/* Folder-sync only exists when the local sidecar is running.
                In hosted mode this toggle has nothing to act on. */}
            {!isHostedMode() ? (
              <p className="text-[11px] text-ink-muted">
                Folder sync saves clients, history and settings. API keys are never written to the sync file —
                re-enter them on a new machine (or use an encrypted backup).
              </p>
            ) : null}
            <div className="pt-3 border-t border-base-700">
              <label className="label">jina reader api key (optional)</label>
              <input
                className="input-base font-mono text-xs"
                value={jina}
                onChange={(e) => persistJina(e.target.value)}
                placeholder="jina_... — leave blank to use the free tier"
                spellCheck={false}
                autoComplete="off"
              />
              <p className="text-[11px] text-ink-muted mt-1.5">
                OpenAdKit uses Jina Reader to pull a website's content when you add a brand by URL. The free tier hits ~20 req/min limits and may 401 on bursts; paid keys lift that. Get one at <a href="https://jina.ai/reader" target="_blank" rel="noreferrer" className="text-info hover:underline">jina.ai/reader</a>. AllOrigins is used as a free fallback automatically.
              </p>
            </div>
          </section>

          <section className="border border-base-600 bg-base-900/40 p-5 space-y-4">
            <h2 className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-muted">monthly budget</h2>
            <div>
              <label className="label" htmlFor="budget-limit">spend ceiling (USD / calendar month)</label>
              <input
                id="budget-limit"
                type="number"
                min={0}
                step="1"
                className="input-base tabular"
                value={budget}
                onChange={(e) => persistBudget(e.target.value)}
                placeholder="0 = no limit"
              />
              <p className="text-[11px] text-ink-muted mt-1.5">
                Calculated from your saved history, so it reflects real generation cost — not the
                lifetime counters below. You&apos;ll see a warning at {Math.round(BUDGET_WARN_AT * 100)}%.
              </p>
            </div>
            {budgetStatus && budgetStatus.limitUsd > 0 ? (
              <div className="space-y-1.5">
                <div className="h-1.5 w-full bg-base-800 overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      budgetStatus.exceeded ? "bg-neg" : budgetStatus.warning ? "bg-live" : "bg-pos"
                    }`}
                    style={{ width: `${Math.min(100, Math.round(budgetStatus.ratio * 100))}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] tabular">
                  <span className={budgetStatus.exceeded ? "text-neg" : "text-ink-muted"}>
                    {formatCost(budgetStatus.spentUsd)} used
                  </span>
                  <span className="text-ink-faint">
                    {budgetStatus.exceeded
                      ? "over budget"
                      : `${formatCost(budgetStatus.remainingUsd)} left`}
                  </span>
                </div>
              </div>
            ) : null}
            <ToggleRow
              label="hard stop at 100%"
              desc="off = warn only · on = refuse new generations once the ceiling is hit"
              v={hardStop}
              on={persistHardStop}
            />
          </section>

          <section className="border border-base-600 bg-base-900/40 p-5 space-y-4">
            <h2 className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-muted">usage</h2>
            <div className="grid grid-cols-3 gap-2">
              <Stat label="cost" value={formatCost(usage.cost)} accent />
              <Stat label="tok in" value={formatTokens(usage.input)} />
              <Stat label="tok out" value={formatTokens(usage.output)} />
            </div>
            <button onClick={() => { resetUsage(); setUsage(getUsage()); window.dispatchEvent(new Event("ados:usage")); }} className="btn-ghost">
              reset counters
            </button>
            <p className="text-[10px] font-mono uppercase tracking-ui-wide text-ink-subtle leading-relaxed">
              counters live in this browser only. real billing on your provider's console.
            </p>
          </section>

          <section className="border border-base-600 bg-base-900/40 p-5 space-y-3">
            <h2 className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-muted">data</h2>
            {isHostedMode() ? (
              <div className="border border-info/40 bg-info/6 px-3 py-2 text-[11px] text-info leading-relaxed">
                <strong>Hosted mode:</strong> brand brains + history live only in this browser's
                IndexedDB. Clearing site data wipes everything. Export below and re-import on
                a new browser / device to move your work. Want auto-backup to disk?{" "}
                <a href="https://github.com/IamRamgarhia/OpenAdKit-Open-Source-AI-Marketing-Tool#install-in-60-seconds" target="_blank" rel="noreferrer" className="underline">
                  install locally
                </a>.
              </div>
            ) : null}
            <p className="text-[11px] font-mono uppercase tracking-ui-wide text-ink-subtle">
              backups include brand brains + history. api keys NOT included.
            </p>
            <div className="flex flex-wrap gap-2">
              <button onClick={doExport} className="btn-ghost"><Download size={11} /> export</button>
              <input ref={importRef} type="file" accept="application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) doImport(f); e.target.value = ""; }} />
              <button onClick={() => importRef.current?.click()} className="btn-ghost"><Upload size={11} /> import</button>
            </div>
          </section>

          <section className="border border-base-600 bg-base-900/40 p-5 space-y-3">
            <h2 className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-muted">key encryption</h2>
            {!vaultSupported ? (
              <p className="text-[11px] text-ink-muted leading-relaxed">
                Unavailable in this browser — WebCrypto needs a secure context (https, or localhost).
              </p>
            ) : vaultEnabled ? (
              <>
                <p className="text-[11px] text-ink-muted leading-relaxed">
                  Your provider keys are encrypted at rest with AES-GCM, unlocked once per session.
                  This protects keys sitting on disk from other software on this machine — it can&apos;t
                  protect a key while the app is unlocked and using it.
                </p>
                <div className="flex flex-wrap gap-2">
                  {vaultUnlocked ? (
                    <button onClick={() => { lockVault(); clearPlaintextCache(); refreshVault(); }} className="btn-ghost">
                      <Lock size={11} /> lock now
                    </button>
                  ) : (
                    <span className="text-[11px] font-mono uppercase tracking-ui-wide text-live">locked · unlock from the banner</span>
                  )}
                  <button onClick={turnOffVault} className="btn-ghost hover:text-neg" disabled={!vaultUnlocked}>
                    <Unlock size={11} /> turn off + decrypt
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-[11px] text-ink-muted leading-relaxed">
                  Off by default: keys live in plain localStorage, readable by any browser extension
                  or anyone with access to this profile. Turning this on encrypts them with a
                  passphrase you enter once per session.{" "}
                  <strong className="text-ink">There is no recovery</strong> — forget the passphrase and
                  you re-enter your keys.
                </p>
                <div className="flex flex-wrap gap-2 items-end">
                  <div className="flex-1 min-w-[180px]">
                    <label className="label" htmlFor="vault-pass">passphrase (8+ characters)</label>
                    <input
                      id="vault-pass"
                      type="password"
                      className="input-base"
                      value={vaultPass}
                      onChange={(e) => setVaultPass(e.target.value)}
                      autoComplete="new-password"
                    />
                  </div>
                  <button onClick={turnOnVault} className="btn-primary" disabled={vaultPass.length < 8}>
                    <Lock size={11} /> encrypt my keys
                  </button>
                </div>
              </>
            )}
            {vaultError ? (
              <div className="border border-neg/40 bg-neg/5 text-neg text-[11px] px-3 py-2 font-mono uppercase tracking-ui-wide">
                {vaultError}
              </div>
            ) : null}
          </section>

          {!isHostedMode() ? <McpConnectPanel /> : null}

          <section className="border border-neg/40 bg-neg/5 p-5 space-y-3">
            <h2 className="text-[10px] font-mono uppercase tracking-ui-mega text-neg">danger zone</h2>
            <p className="text-[11px] font-mono uppercase tracking-ui-wide text-ink-muted">
              wipe everything: keys, brains, history, usage counters.
            </p>
            <button onClick={doWipe} className="btn-ghost hover:text-neg hover:border-neg">
              <Trash2 size={11} /> wipe local data
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({ label, desc, v, on }: { label: string; desc: string; v: boolean; on: (next: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={v}
      aria-label={label}
      onClick={() => on(!v)}
      className="w-full flex items-center gap-3 text-left border border-base-700 px-3 py-2 hover:bg-base-800/40 transition"
    >
      <div className="flex-1">
        <div className="text-[12px] text-ink">{label}</div>
        <div className="text-[10px] font-mono uppercase tracking-ui-wide text-ink-subtle mt-0.5">{desc}</div>
      </div>
      <span className={`h-5 w-9 border relative ${v ? "border-live bg-live/20" : "border-base-500 bg-base-900"}`} aria-hidden="true">
        <span className={`absolute top-0.5 h-3.5 w-3.5 transition ${v ? "left-[18px] bg-live" : "left-0.5 bg-base-500"}`} />
      </span>
    </button>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="border border-base-600 bg-base-900/30 p-3">
      <div className="text-[9px] font-mono uppercase tracking-ui-mega text-ink-faint">{label}</div>
      <div className={`mt-1 font-display italic text-2xl tabular ${accent ? "text-live" : "text-ink"}`}>{value}</div>
    </div>
  );
}
