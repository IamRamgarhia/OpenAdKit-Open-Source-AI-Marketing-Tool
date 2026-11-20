"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, X, Zap, Lock, ExternalLink, Eye } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { PROVIDERS } from "@/lib/providers";
import { getProviderLimits } from "@/lib/provider-limits";
import { getProvidersWithKeys, getActiveProviderId } from "@/lib/settings";
import { listAds, type GeneratedAd } from "@/lib/storage";
import { formatCost } from "@/lib/utils";

/**
 * "Which AI should I use?"
 *
 * DESIGN RULE: no invented quality scores.
 *
 * It would be easy to ship a "quality: 9/10" column, and it would be fiction —
 * there is no ground truth for ad copy, and the app's own honesty constraints
 * forbid exactly that kind of unsupported claim. So every column here is
 * either:
 *
 *   FACT      — published price, free-tier cap, vision support, context window.
 *   MEASURED  — computed from THIS user's own generation history: what they
 *               actually spent, and how often the model's first reply failed
 *               schema validation and needed a correction pass.
 *
 * The measured half is the honest answer to "which one gives better results":
 * a provider whose output needs re-asking is objectively worse at the job this
 * app does, and that's something we can observe rather than assert.
 */

interface Measured {
  runs: number;
  totalCost: number;
  avgCost: number;
  avgTokens: number;
  retryRate: number | null;
}

/** A generation that had to be re-asked is recorded by GeneratorShell as a
 *  correction pass; we infer it from a saved ad with no parsed JSON, which is
 *  the observable failure signal on the record itself. */
function measure(ads: GeneratedAd[]): Map<string, Measured> {
  const out = new Map<string, Measured>();
  const byProvider = new Map<string, GeneratedAd[]>();
  for (const a of ads) {
    const pid = a.provider_id;
    if (!pid) continue; // pre-dates provider capture
    if (!byProvider.has(pid)) byProvider.set(pid, []);
    byProvider.get(pid)!.push(a);
  }
  for (const [pid, rows] of byProvider) {
    const totalCost = rows.reduce((s, r) => s + (Number(r.cost_usd) || 0), 0);
    const totalTokens = rows.reduce(
      (s, r) => s + (Number(r.usage_input_tokens) || 0) + (Number(r.usage_output_tokens) || 0),
      0
    );
    const failed = rows.filter((r) => r.output_json === null).length;
    out.set(pid, {
      runs: rows.length,
      totalCost,
      avgCost: totalCost / rows.length,
      avgTokens: Math.round(totalTokens / rows.length),
      retryRate: rows.length >= 3 ? failed / rows.length : null,
    });
  }
  return out;
}

/** Cost of one typical generation, using this user's own measured token usage
 *  where available and a conservative default otherwise. */
function costPerRun(providerId: string, modelId: string, avgTokens: number): number | null {
  const p = PROVIDERS.find((x) => x.id === providerId);
  const m = p?.models.find((x) => x.id === modelId) ?? p?.models[0];
  if (!m) return null;
  // Generators run roughly 70/30 input:output.
  const inTok = avgTokens * 0.7;
  const outTok = avgTokens * 0.3;
  return (inTok * m.pricing.input_per_million_usd + outTok * m.pricing.output_per_million_usd) / 1_000_000;
}

export default function ProvidersPage() {
  const [ads, setAds] = useState<GeneratedAd[]>([]);
  const [configured, setConfigured] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setAds(await listAds());
      } catch {
        setAds([]);
      }
      setConfigured(getProvidersWithKeys());
      setActiveId(getActiveProviderId());
      setLoaded(true);
    })();
  }, []);

  const measured = useMemo(() => measure(ads), [ads]);
  /** Median observed tokens per generation — the basis for cost-per-run. */
  const typicalTokens = useMemo(() => {
    const all = [...measured.values()].map((m) => m.avgTokens).filter((n) => n > 0);
    if (!all.length) return 8000; // conservative default before any history
    return Math.round(all.reduce((a, b) => a + b, 0) / all.length);
  }, [measured]);

  // Free tiers first, then by cheapest run.
  const ordered = useMemo(() => {
    return [...PROVIDERS].sort((a, b) => {
      const la = getProviderLimits(a.id);
      const lb = getProviderLimits(b.id);
      if (la?.has_free_tier !== lb?.has_free_tier) return la?.has_free_tier ? -1 : 1;
      const ca = costPerRun(a.id, a.default_model, typicalTokens) ?? Infinity;
      const cb = costPerRun(b.id, b.default_model, typicalTokens) ?? Infinity;
      return ca - cb;
    });
  }, [typicalTokens]);

  return (
    <div>
      <PageHeader
        scope="providers"
        title="Which AI should I use?"
        subtitle="Free-tier limits and real per-run costs across all 9 providers — plus what your own history says about each one."
      />

      <div className="border border-info/40 bg-info/6 px-4 py-3 mb-4 text-[12px] text-ink leading-relaxed">
        <strong className="text-info">No invented scores.</strong> There is no ground truth for ad copy, so this
        page never claims one model is &ldquo;better&rdquo;. Every figure is either a published fact (price, free
        cap, vision) or measured from your own generations. The most useful signal is{" "}
        <strong>retry rate</strong>: how often a provider&rsquo;s first reply failed validation and had to be
        re-asked — that costs you double and is genuinely observable.
      </div>

      <div className="overflow-x-auto border border-base-600 bg-base-900/40">
        <table className="w-full text-[12px] min-w-[900px]">
          <thead>
            <tr className="text-[9px] font-mono uppercase tracking-ui-mega text-ink-faint border-b border-base-700">
              <th className="text-left px-3 py-2 font-normal">provider</th>
              <th className="text-left px-3 py-2 font-normal">free tier</th>
              <th className="text-right px-3 py-2 font-normal">free req/day</th>
              <th className="text-right px-3 py-2 font-normal">~cost / run</th>
              <th className="text-center px-3 py-2 font-normal">vision</th>
              <th className="text-right px-3 py-2 font-normal">your runs</th>
              <th className="text-right px-3 py-2 font-normal">your spend</th>
              <th className="text-right px-3 py-2 font-normal">retry rate</th>
            </tr>
          </thead>
          <tbody>
            {ordered.map((p) => {
              const lim = getProviderLimits(p.id);
              const ft = lim?.free_tier;
              const stats = measured.get(p.id);
              const perRun = costPerRun(p.id, p.default_model, typicalTokens);
              const isActive = activeId === p.id;
              const hasKey = configured.includes(p.id);
              return (
                <tr
                  key={p.id}
                  className={`border-b border-base-700/50 last:border-b-0 ${isActive ? "bg-live/6" : "hover:bg-base-800/30"}`}
                >
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      {lim?.has_free_tier ? (
                        <Zap size={11} className="text-pos shrink-0" />
                      ) : (
                        <Lock size={11} className="text-ink-faint shrink-0" />
                      )}
                      <span className="text-ink font-medium">{p.name}</span>
                      {isActive ? (
                        <span className="text-[9px] font-mono uppercase tracking-ui-mega text-live border border-live/40 px-1 py-0.5">
                          active
                        </span>
                      ) : hasKey ? (
                        <span className="text-[9px] font-mono uppercase tracking-ui-mega text-pos">key saved</span>
                      ) : null}
                    </div>
                    <div className="text-[10px] text-ink-subtle mt-0.5">{p.default_model}</div>
                  </td>
                  <td className="px-3 py-2">
                    {lim?.has_free_tier ? (
                      <span className="text-pos">
                        Yes{ft?.needs_card === false ? " · no card" : ""}
                      </span>
                    ) : (
                      <span className="text-ink-faint">Paid only</span>
                    )}
                    {ft?.caveat ? (
                      <div className="text-[10px] text-ink-subtle leading-snug mt-0.5 max-w-[260px]">{ft.caveat}</div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-right tabular">
                    {/* Only meaningful for providers that HAVE a free tier. The rpm on a
                        paid-only provider is its paid rate limit — printing it in a column
                        headed "free req/day" would read as free allowance. */}
                    {!lim?.has_free_tier ? (
                      <span className="text-ink-faint">—</span>
                    ) : ft?.rpd != null ? (
                      <span className={ft.rpd < 100 ? "text-live" : "text-ink"}>{ft.rpd.toLocaleString()}</span>
                    ) : ft?.rpm != null ? (
                      <span className="text-ink-subtle" title="No published daily cap; per-minute limit shown.">
                        {ft.rpm}/min
                      </span>
                    ) : (
                      <span className="text-ink-faint">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular text-ink">
                    {perRun === null ? "—" : perRun === 0 ? <span className="text-pos">free</span> : formatCost(perRun)}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {p.supports_vision ? (
                      <Eye size={12} className="text-live inline" />
                    ) : (
                      <X size={12} className="text-ink-faint inline" />
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular text-ink-muted">{stats?.runs ?? "—"}</td>
                  <td className="px-3 py-2 text-right tabular text-ink-muted">
                    {stats ? formatCost(stats.totalCost) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular">
                    {stats?.retryRate == null ? (
                      <span className="text-ink-faint" title="Needs at least 3 generations on this provider.">
                        —
                      </span>
                    ) : (
                      <span className={stats.retryRate > 0.25 ? "text-neg" : stats.retryRate > 0 ? "text-live" : "text-pos"}>
                        {Math.round(stats.retryRate * 100)}%
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-ink-subtle mt-2 leading-relaxed">
        &ldquo;~cost / run&rdquo; uses {typicalTokens.toLocaleString()} tokens per generation
        {ads.length ? " — measured from your own history" : " (default estimate; run a few generations to personalise)"} at
        a 70/30 input:output split, priced against each provider&rsquo;s default model. Free-tier caps are published
        figures and change often — verify with each provider before relying on them.
      </p>

      <div className="grid md:grid-cols-2 gap-3 mt-6">
        <section className="border border-base-600 bg-base-900/40 p-4">
          <h2 className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-muted mb-2">
            starting from zero? read this
          </h2>
          <ul className="text-[12px] text-ink-muted space-y-1.5 leading-relaxed">
            <li>
              <strong className="text-ink">Most free requests/day:</strong> Groq — 14,400/day, no card. The
              practical choice for high-volume work at $0.
            </li>
            <li>
              <strong className="text-ink">Largest free models:</strong> OpenRouter&rsquo;s{" "}
              <code className="text-[11px]">:free</code> tier and Gemini both expose frontier-class models at
              $0 — but Gemini&rsquo;s cap is <em>per model</em> and as low as ~20 requests/day, and
              OpenRouter&rsquo;s is 50/day. Fine for drafting, not for volume.
            </li>
            <li>
              <strong className="text-ink">Need image input?</strong> Only Claude, GPT, Gemini and OpenRouter
              accept screenshots. Groq and Cerebras are text-only.
            </li>
            <li>
              <strong className="text-ink">Best for strict JSON:</strong> watch the retry-rate column above once
              you have a few runs on each — that is real evidence, unlike a vendor claim.
            </li>
          </ul>
        </section>

        <section className="border border-base-600 bg-base-900/40 p-4">
          <h2 className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-muted mb-2">get a free key</h2>
          <ul className="space-y-1.5">
            {PROVIDERS.filter((p) => getProviderLimits(p.id)?.has_free_tier).map((p) => (
              <li key={p.id} className="flex items-center gap-2 text-[12px]">
                <Check size={11} className="text-pos shrink-0" />
                <span className="text-ink">{p.name}</span>
                <a
                  href={p.get_key_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-info hover:underline inline-flex items-center gap-0.5 text-[11px]"
                >
                  get key <ExternalLink size={9} />
                </a>
              </li>
            ))}
          </ul>
          <Link href="/settings" className="btn-ghost mt-3 inline-flex">
            add a key in settings →
          </Link>
        </section>
      </div>

      {loaded && !ads.length ? (
        <p className="text-[11px] font-mono uppercase tracking-ui-wide text-ink-subtle mt-4">
          no generations yet — the &ldquo;your&rdquo; columns fill in as you use the tools
        </p>
      ) : null}
    </div>
  );
}
