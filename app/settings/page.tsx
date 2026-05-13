"use client";

import { useEffect, useRef, useState } from "react";
import {
  KeyRound, Eye, EyeOff, Save, CheckCircle2, Loader2, Download, Upload, Trash2, ExternalLink, Zap, Lock,
} from "lucide-react";
import { ApiKeyGate } from "@/components/ApiKeyGate";
import { PageHeader } from "@/components/PageHeader";
import {
  getActiveProviderId, setActiveProviderId, getProviderKey, setProviderKey, clearProviderKey,
  getActiveModelId, setActiveModelId, getUsage, resetUsage,
  getLanguage, setLanguage, getToneOverride, setToneOverride,
  getCharWarn, setCharWarn, getAutoSave, setAutoSave,
  getJinaKey, setJinaKey,
} from "@/lib/settings";
import { PROVIDERS, type Provider } from "@/lib/providers";
import { testApiKey } from "@/lib/llm";
import { exportAll, importAll, wipeAll } from "@/lib/storage";
import { formatCost, formatTokens } from "@/lib/utils";

export default function SettingsPage() {
  return (
    <ApiKeyGate>
      <SettingsInner />
    </ApiKeyGate>
  );
}

function SettingsInner() {
  const [activeId, setActiveId] = useState<string>("");
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [modelsByProvider, setModelsByProvider] = useState<Record<string, string>>({});
  const [testing, setTesting] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState({ cost: 0, input: 0, output: 0 });
  const [lang, setLang] = useState("English");
  const [tone, setTone] = useState("");
  const [charWarn, setCharWarnState] = useState(true);
  const [autoSave, setAutoSaveState] = useState(true);
  const [jina, setJinaState] = useState("");
  const [syncKeys, setSyncKeysState] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setActiveId(getActiveProviderId() ?? "");
    const ks: Record<string, string> = {};
    const ms: Record<string, string> = {};
    for (const p of PROVIDERS) {
      ks[p.id] = getProviderKey(p.id);
      ms[p.id] = getActiveModelId(p.id) ?? p.default_model;
    }
    setKeys(ks);
    setModelsByProvider(ms);
    setUsage(getUsage());
    setLang(getLanguage());
    setTone(getToneOverride());
    setCharWarnState(getCharWarn());
    setAutoSaveState(getAutoSave());
    setJinaState(getJinaKey());
    if (typeof window !== "undefined") {
      setSyncKeysState(window.localStorage.getItem("ados.sync_include_keys") === "1");
    }
  }, []);

  function persistJina(v: string) { setJinaState(v.trim()); setJinaKey(v.trim()); }
  function persistSyncKeys(v: boolean) {
    setSyncKeysState(v);
    if (typeof window !== "undefined") {
      if (v) window.localStorage.setItem("ados.sync_include_keys", "1");
      else window.localStorage.removeItem("ados.sync_include_keys");
    }
  }

  async function saveProvider(p: Provider) {
    setError(null);
    const k = keys[p.id] ?? "";
    if (!k.trim()) {
      setError(`Paste a ${p.name} key first.`);
      return;
    }
    setTesting(p.id);
    const ok = await testApiKey(k, p.id);
    setTesting(null);
    if (!ok) {
      setError(`${p.name} rejected that key.`);
      return;
    }
    setProviderKey(p.id, k);
    setActiveModelId(p.id, modelsByProvider[p.id] ?? p.default_model);
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
    setKeys({ ...keys, [p.id]: "" });
  }

  async function doExport() {
    const json = await exportAll();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ados-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
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
    location.href = "/setup";
  }

  function persistLang(v: string) { setLang(v); setLanguage(v); }
  function persistTone(v: string) { setTone(v); setToneOverride(v); }
  function persistCharWarn(v: boolean) { setCharWarnState(v); setCharWarn(v); }
  function persistAutoSave(v: boolean) { setAutoSaveState(v); setAutoSave(v); }

  return (
    <div>
      <PageHeader scope="settings" title="Settings" subtitle="Providers, keys, model selection, preferences, data. All local." />

      <div className="space-y-4 stagger">
        <section className="border border-base-600 bg-base-900/40 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-muted">ai providers</h2>
            <span className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-faint">{Object.values(keys).filter(Boolean).length} configured</span>
          </div>

          {error ? (
            <div className="border border-neg/40 bg-neg/5 text-neg text-[11px] px-3 py-2 font-mono uppercase tracking-ui-wide mb-3">
              {error}
            </div>
          ) : null}

          <div className="space-y-3">
            {PROVIDERS.map((p) => {
              const active = activeId === p.id;
              const hasKey = Boolean(keys[p.id]);
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
                        <a href={p.get_key_url} target="_blank" rel="noreferrer" className="text-[10px] font-mono uppercase tracking-ui-wide text-info hover:underline inline-flex items-center gap-0.5 mt-1">
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
                      <label className="label flex items-center gap-1.5"><KeyRound size={10} /> api key</label>
                      <div className="relative">
                        <input
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
                      <label className="label flex items-center gap-2">
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
              <label className="label">tone override (optional)</label>
              <input className="input-base" value={tone} onChange={(e) => persistTone(e.target.value)} placeholder="punchy, irreverent — overrides brand brain tone" />
            </div>
            <ToggleRow label="character-count warnings" desc="badges when output exceeds platform limits" v={charWarn} on={persistCharWarn} />
            <ToggleRow label="auto-save to history" desc="every generation goes into /history automatically" v={autoSave} on={persistAutoSave} />
            <ToggleRow
              label="include API keys in folder sync"
              desc="off by default · turn ON to make the data/ folder fully portable across machines (security tradeoff)"
              v={syncKeys}
              on={persistSyncKeys}
            />
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
                AdForge uses Jina Reader to pull a website's content when you add a brand by URL. The free tier hits ~20 req/min limits and may 401 on bursts; paid keys lift that. Get one at <a href="https://jina.ai/reader" target="_blank" rel="noreferrer" className="text-info hover:underline">jina.ai/reader</a>. AllOrigins is used as a free fallback automatically.
              </p>
            </div>
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
            <p className="text-[11px] font-mono uppercase tracking-ui-wide text-ink-subtle">
              backups include brand brains + history. api keys NOT included.
            </p>
            <div className="flex flex-wrap gap-2">
              <button onClick={doExport} className="btn-ghost"><Download size={11} /> export</button>
              <input ref={importRef} type="file" accept="application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) doImport(f); e.target.value = ""; }} />
              <button onClick={() => importRef.current?.click()} className="btn-ghost"><Upload size={11} /> import</button>
            </div>
          </section>

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
    <button onClick={() => on(!v)} className="w-full flex items-center gap-3 text-left border border-base-700 px-3 py-2 hover:bg-base-800/40 transition">
      <div className="flex-1">
        <div className="text-[12px] text-ink">{label}</div>
        <div className="text-[10px] font-mono uppercase tracking-ui-wide text-ink-subtle mt-0.5">{desc}</div>
      </div>
      <span className={`h-5 w-9 border relative ${v ? "border-live bg-live/20" : "border-base-500 bg-base-900"}`}>
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
