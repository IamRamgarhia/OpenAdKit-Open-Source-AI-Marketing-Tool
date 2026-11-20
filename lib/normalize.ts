/**
 * Defensive readers for every persisted table.
 *
 * IndexedDB enforces nothing about record shape, and importAll() accepts
 * arbitrary user-supplied JSON. Before these existed, only brains were
 * normalized — so a backup whose ads lacked `cost_usd` / `usage_*` (an older
 * export, a hand-edited file, a partial restore) would white-screen /history
 * and the dashboard on `a.cost_usd.toFixed(4)`, with no recovery path short of
 * wiping IndexedDB.
 *
 * Rule: anything that leaves the DB goes through a normalizer, and anything
 * that enters via import does too.
 *
 * Deliberately free of any Dexie import so it stays unit-testable in a plain
 * Node environment. Types are `import type` (erased at runtime).
 */
import type {
  AdPerformance,
  Campaign,
  ChecklistState,
  CustomChecklistItem,
  GeneratedAd,
  GeneratorTemplate,
  Platform,
} from "./storage";

/** Coerce to a finite number, else `fallback`. Guards against NaN/Infinity
 *  poisoning downstream totals as well as against missing fields. */
export function finiteNum(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

const AD_STATUSES: GeneratedAd["status"][] = ["draft", "testing", "live", "paused", "winner", "loser"];
const PLATFORMS: Platform[] = ["google", "meta", "tiktok", "youtube", "linkedin", "twitter", "display", "email"];
const CAMPAIGN_STATUSES: Campaign["status"][] = ["planning", "live", "paused", "done"];
const SCOPES: ChecklistState["scope"][] = ["daily", "weekly", "monthly"];

function newId(): string {
  // crypto.randomUUID exists in browsers and Node 19+; fall back for older Node
  // so the normalizers stay usable in any test runner.
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `id-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

export function normalizeAd(a: any): GeneratedAd {
  const perf = a?.performance && typeof a.performance === "object" ? a.performance : undefined;
  return {
    id: typeof a?.id === "string" && a.id ? a.id : newId(),
    brand_id: typeof a?.brand_id === "string" ? a.brand_id : "",
    platform: PLATFORMS.includes(a?.platform) ? a.platform : "meta",
    campaign_type: typeof a?.campaign_type === "string" ? a.campaign_type : "",
    title: typeof a?.title === "string" && a.title ? a.title : "(untitled)",
    input: a?.input && typeof a.input === "object" ? a.input : {},
    output_json: a?.output_json ?? null,
    output_text: typeof a?.output_text === "string" ? a.output_text : "",
    model_id: typeof a?.model_id === "string" && a.model_id ? a.model_id : "unknown",
    usage_input_tokens: finiteNum(a?.usage_input_tokens),
    usage_output_tokens: finiteNum(a?.usage_output_tokens),
    cost_usd: finiteNum(a?.cost_usd),
    starred: Boolean(a?.starred),
    status: AD_STATUSES.includes(a?.status) ? a.status : "draft",
    notes: typeof a?.notes === "string" ? a.notes : "",
    created_at: finiteNum(a?.created_at, Date.now()),
    ...(typeof a?.campaign_id === "string" ? { campaign_id: a.campaign_id } : {}),
    ...(typeof a?.prompt === "string" && a.prompt ? { prompt: a.prompt } : {}),
    ...(typeof a?.provider_id === "string" && a.provider_id ? { provider_id: a.provider_id } : {}),
    ...(Number.isFinite(a?.max_tokens) && a.max_tokens > 0 ? { max_tokens: Number(a.max_tokens) } : {}),
    ...(a?.has_image === true ? { has_image: true } : {}),
    ...(perf
      ? {
          performance: {
            ...perf,
            updated_at: finiteNum(perf.updated_at, Date.now()),
          } as AdPerformance,
        }
      : {}),
    ...(a?.deleted_at != null ? { deleted_at: finiteNum(a.deleted_at) } : {}),
  };
}

export function normalizeCampaign(c: any): Campaign {
  return {
    id: typeof c?.id === "string" && c.id ? c.id : newId(),
    brand_id: typeof c?.brand_id === "string" ? c.brand_id : "",
    name: typeof c?.name === "string" && c.name ? c.name : "(untitled campaign)",
    goal: typeof c?.goal === "string" ? c.goal : "",
    status: CAMPAIGN_STATUSES.includes(c?.status) ? c.status : "planning",
    created_at: finiteNum(c?.created_at, Date.now()),
    ...(typeof c?.notes === "string" ? { notes: c.notes } : {}),
    ...(c?.deleted_at != null ? { deleted_at: finiteNum(c.deleted_at) } : {}),
  };
}

export function normalizeTemplate(t: any): GeneratorTemplate {
  return {
    id: typeof t?.id === "string" && t.id ? t.id : newId(),
    name: typeof t?.name === "string" && t.name ? t.name : "(untitled template)",
    scope: typeof t?.scope === "string" ? t.scope : "",
    input: t?.input && typeof t.input === "object" && !Array.isArray(t.input) ? t.input : {},
    created_at: finiteNum(t?.created_at, Date.now()),
  };
}

export function normalizeChecklistState(c: any): ChecklistState {
  return {
    id: typeof c?.id === "string" && c.id ? c.id : newId(),
    scope: SCOPES.includes(c?.scope) ? c.scope : "daily",
    item_key: typeof c?.item_key === "string" ? c.item_key : "",
    checked: Boolean(c?.checked),
    // Deliberately null, not 0 — 0 reads as "completed at the epoch", which
    // makes the streak logic treat a never-started item as merely stale.
    last_completed: c?.last_completed == null ? null : finiteNum(c.last_completed),
    streak: Math.max(0, Math.floor(finiteNum(c?.streak))),
  };
}

export function normalizeCustomItem(c: any): CustomChecklistItem {
  return {
    id: typeof c?.id === "string" && c.id ? c.id : newId(),
    scope: SCOPES.includes(c?.scope) ? c.scope : "daily",
    text: typeof c?.text === "string" ? c.text : "",
    section: typeof c?.section === "string" ? c.section : "",
    created_at: finiteNum(c?.created_at, Date.now()),
  };
}
