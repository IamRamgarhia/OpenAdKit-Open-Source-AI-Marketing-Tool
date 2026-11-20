"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { Section, Pill } from "@/components/OutputBlocks";
import { BENCHMARKS, INDUSTRIES, compareToBenchmark, type Verdict } from "@/lib/benchmarks";

const PLATFORMS = Array.from(new Set(BENCHMARKS.map((b) => b.platform)));
const METRICS = [
  { v: "ctr", label: "CTR (%)" },
  { v: "cpc_usd", label: "CPC ($)" },
  { v: "cvr", label: "CVR (%)" },
  { v: "roas", label: "ROAS (×)" },
] as const;

export default function Client() {
  return <Inner />;
}

function Inner() {
  const [platform, setPlatform] = useState(PLATFORMS[0]);
  const [industry, setIndustry] = useState("");
  const [metric, setMetric] = useState<typeof METRICS[number]["v"]>("ctr");
  const [yourValue, setYourValue] = useState("");

  const yv = parseFloat(yourValue);
  const result = !isNaN(yv) ? compareToBenchmark(yv, platform, metric, industry || undefined) : null;

  const tone: Record<Verdict, "pos" | "live" | "neg" | "default"> = {
    above: "pos",
    within: "live",
    below: "neg",
    no_data: "default",
  };

  const filteredBenchmarks = BENCHMARKS.filter((b) => b.metric === metric);

  return (
    <div>
      <PageHeader
        scope="benchmarks"
        title="Performance Benchmarks"
        subtitle="Where do your numbers actually land vs the industry? Directional — verify against your own attribution."
      />

      <Section title="Compare your numbers">
        <div className="grid md:grid-cols-4 gap-3 mb-4">
          <div>
            <label className="label">platform</label>
            <select className="input-base" value={platform} onChange={(e) => setPlatform(e.target.value)}>
              {PLATFORMS.map((p) => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="label">industry</label>
            <select className="input-base" value={industry} onChange={(e) => setIndustry(e.target.value)}>
              <option value="">(general)</option>
              {INDUSTRIES.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">metric</label>
            <select className="input-base" value={metric} onChange={(e) => setMetric(e.target.value as any)}>
              {METRICS.map((m) => <option key={m.v} value={m.v}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">your number</label>
            <input
              type="number"
              step="0.01"
              className="input-base tabular"
              value={yourValue}
              onChange={(e) => setYourValue(e.target.value)}
              placeholder={metric === "ctr" || metric === "cvr" ? "1.8" : metric === "cpc_usd" ? "2.40" : "4.2"}
            />
          </div>
        </div>

        {result ? (
          <div className={`border p-4 ${
            result.verdict === "above" ? "border-pos/40 bg-pos/5" :
            result.verdict === "within" ? "border-live/40 bg-live/5" :
            result.verdict === "below" ? "border-neg/40 bg-neg/5" :
            "border-base-600 bg-base-900/30"
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <Pill text={result.verdict.replace("_", " ")} tone={tone[result.verdict]} />
              {result.benchmark ? <span className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-faint">benchmark · {result.benchmark.low}–{result.benchmark.high}{result.benchmark.unit === "pct" ? "%" : result.benchmark.unit === "usd" ? " USD" : "×"}</span> : null}
            </div>
            <p className="text-sm text-ink leading-relaxed">{result.readout}</p>
            {result.benchmark?.note ? <p className="text-[11px] text-ink-muted mt-2">{result.benchmark.note}</p> : null}
            {result.verdict === "below" ? (
              <div className="mt-3 pt-3 border-t border-base-700 text-[11px]">
                <span className="text-ink-faint">next move: </span>
                {metric === "ctr" ? (
                  <Link href="/optimize/ctr" className="text-live hover:underline">/optimize/ctr →</Link>
                ) : metric === "cpc_usd" ? (
                  <Link href="/optimize/quality-score" className="text-live hover:underline">/optimize/quality-score →</Link>
                ) : metric === "cvr" ? (
                  <Link href="/optimize/landing-page" className="text-live hover:underline">/optimize/landing-page →</Link>
                ) : (
                  <Link href="/optimize/bid-strategy" className="text-live hover:underline">/optimize/bid-strategy →</Link>
                )}
              </div>
            ) : null}
          </div>
        ) : null}
      </Section>

      <Section title={`All ${metric.toUpperCase()} benchmarks · ${filteredBenchmarks.length}`}>
        <ul className="space-y-1 text-xs">
          {filteredBenchmarks.map((b, i) => (
            <li key={i} className="flex items-center gap-2 border border-base-700 px-2 py-1.5">
              <span className="font-mono text-[10px] uppercase tracking-ui-mega text-live w-40">{b.platform}</span>
              {b.industry ? <Pill text={b.industry.replace(/_/g, " ")} /> : <span className="w-16 text-ink-faint text-[10px]">(general)</span>}
              <span className="flex-1" />
              <span className="text-pos font-mono tabular">
                {b.low}–{b.high}{b.unit === "pct" ? "%" : b.unit === "usd" ? " USD" : "×"}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-[10px] font-mono uppercase tracking-ui-wide text-ink-subtle mt-3">
          source: compiled from public 2024-25 ads-platform reports · directional ranges, not guarantees · verify against your own attribution
        </p>
      </Section>
    </div>
  );
}
