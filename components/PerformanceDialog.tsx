"use client";

import { useEffect, useState } from "react";
import { X, TrendingUp } from "lucide-react";
import { logPerformance, type GeneratedAd } from "@/lib/storage";

export function PerformanceDialog({ ad, onClose }: { ad: GeneratedAd; onClose: () => void }) {
  const p = ad.performance ?? ({} as any);
  const [impressions, setImpressions] = useState(String(p.impressions ?? ""));
  const [clicks, setClicks] = useState(String(p.clicks ?? ""));
  const [conversions, setConversions] = useState(String(p.conversions ?? ""));
  const [spend, setSpend] = useState(String(p.spend_usd ?? ""));
  const [revenue, setRevenue] = useState(String(p.revenue_usd ?? ""));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Escape-to-close — ARIA dialog pattern. (Audit finding #34.)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // logPerformance can throw on IndexedDB quota / schema errors. Without a finally
  // block the Save button stays stuck on "Saving…" forever with no error surface.
  // (Audit finding #11.)
  async function save() {
    setSaving(true);
    setSaveError(null);
    try {
      await logPerformance(ad.id, {
        impressions: Number(impressions) || undefined,
        clicks: Number(clicks) || undefined,
        conversions: Number(conversions) || undefined,
        spend_usd: Number(spend) || undefined,
        revenue_usd: Number(revenue) || undefined,
      });
      onClose();
    } catch (e: any) {
      setSaveError(e?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const i = Number(impressions) || 0;
  const c = Number(clicks) || 0;
  const cv = Number(conversions) || 0;
  const sp = Number(spend) || 0;
  const rv = Number(revenue) || 0;
  const ctr = i > 0 ? (c / i) * 100 : 0;
  const cvr = c > 0 ? (cv / c) * 100 : 0;
  const cpa = cv > 0 ? sp / cv : 0;
  const roas = sp > 0 ? rv / sp : 0;

  return (
    <div className="fixed inset-0 z-55 bg-base-950/80 backdrop-blur-sm grid place-items-center p-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-base-900 border border-base-600" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-base-600">
          <div className="flex items-center gap-2 text-ink">
            <TrendingUp size={14} className="text-live" />
            <span className="text-sm font-semibold">Log performance</span>
          </div>
          <button onClick={onClose} className="text-ink-faint hover:text-ink" aria-label="Close"><X size={14} /></button>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-[12px] text-ink-muted">For: <span className="text-ink font-medium">{ad.title}</span></p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Impressions" value={impressions} onChange={setImpressions} placeholder="120000" />
            <Field label="Clicks" value={clicks} onChange={setClicks} placeholder="1500" />
            <Field label="Conversions" value={conversions} onChange={setConversions} placeholder="42" />
            <Field label="Spend ($)" value={spend} onChange={setSpend} placeholder="500" />
            <Field label="Revenue ($)" value={revenue} onChange={setRevenue} placeholder="2100" />
          </div>
          <div className="grid grid-cols-4 gap-2 border-t border-base-700 pt-3 text-xs">
            <Computed k="CTR" v={ctr ? `${ctr.toFixed(2)}%` : "—"} />
            <Computed k="CVR" v={cvr ? `${cvr.toFixed(2)}%` : "—"} />
            <Computed k="CPA" v={cpa ? `$${cpa.toFixed(2)}` : "—"} />
            <Computed k="ROAS" v={roas ? `${roas.toFixed(2)}×` : "—"} pos={roas >= 2} />
          </div>
          {saveError ? (
            <div className="border border-neg/40 bg-neg/5 text-neg text-[11px] px-3 py-2 font-mono uppercase tracking-ui-wide">
              {saveError}
            </div>
          ) : null}
          <div className="flex justify-end gap-2 pt-3 border-t border-base-700">
            <button onClick={onClose} className="btn-ghost">Cancel</button>
            <button onClick={save} disabled={saving} className="btn-primary">{saving ? "Saving…" : "Save"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input type="number" className="input-base tabular" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}
function Computed({ k, v, pos }: { k: string; v: string; pos?: boolean }) {
  return (
    <div className="border border-base-700 p-2">
      <div className="text-[10px] uppercase tracking-wider text-ink-faint">{k}</div>
      <div className={`font-mono tabular mt-1 ${pos ? "text-pos" : "text-ink"}`}>{v}</div>
    </div>
  );
}
