/**
 * URL ingest with multi-reader fallback.
 *
 * Strategy:
 *   1. Jina Reader (https://r.jina.ai) — best quality, returns clean markdown. Has free-tier rate
 *      limits; users can add a paid Jina key in Settings for higher quotas.
 *   2. AllOrigins (https://api.allorigins.win) — free CORS proxy returning raw HTML; we strip it
 *      down in-browser. No key, no rate limit, but messier output.
 *   3. If both fail, we return a clear error and the UI offers a manual paste box.
 *
 * Runs 100% in the user's browser. No backend.
 */
export interface IngestResult {
  ok: true;
  url: string;
  content: string;
  truncated: boolean;
  source: "jina" | "allorigins" | "sidecar";
}
export interface IngestError {
  ok: false;
  message: string;
  recoverable: boolean; // true → UI should offer manual-paste fallback
}
export type IngestOutcome = IngestResult | IngestError;

const MAX_CHARS = 40_000;

function normalize(u: string): string {
  let url = u.trim();
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  return url;
}

function getJinaKey(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem("ados.jina_key") ?? "";
  } catch {
    return "";
  }
}

function sidecarOrigin(): string {
  // The local-sync sidecar runs on the configured ADFORGE_SYNC_PORT (default
  // 3006). The browser app is on a different port (3005), so we hit
  // http://127.0.0.1:3006 directly. CORS is allowed by the sidecar.
  // We can't read env vars in the browser; default to 3006 and trust the
  // sidecar to be where AdForge launcher put it.
  return "http://127.0.0.1:3006";
}

/**
 * Server-side fetch via the local sidecar — bypasses Jina quotas + browser
 * CORS sandbox. Most reliable path when external readers are rate-limited
 * or the user's network blocks them.
 */
async function trySidecar(target: string, signal?: AbortSignal): Promise<IngestOutcome> {
  try {
    const res = await fetch(
      `${sidecarOrigin()}/ingest?url=${encodeURIComponent(target)}`,
      { method: "GET", signal }
    );
    // Specific case: sidecar is running but doesn't have /ingest (old version).
    // Tell the user to restart the launcher so it picks up the new code.
    if (res.status === 404) {
      const body = await res.json().catch(() => ({}));
      if (body?.error === "not found") {
        return {
          ok: false,
          recoverable: true,
          message:
            "Sidecar is outdated (missing /ingest endpoint). Click 🧹 Clean rebuild in the launcher, OR close & relaunch via AdForge.bat / AdForge.command, to pick up new code.",
        };
      }
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return {
        ok: false,
        recoverable: true,
        message: `Sidecar HTTP ${res.status}: ${body?.error ?? res.statusText ?? "unknown"}`,
      };
    }
    const j = await res.json();
    if (!j.ok || !j.content || j.content.length < 50) {
      return { ok: false, recoverable: true, message: "Sidecar returned almost no content" };
    }
    return {
      ok: true,
      url: j.url ?? target,
      content: j.content,
      truncated: !!j.truncated,
      source: "sidecar",
    };
  } catch (e: any) {
    if (e?.name === "AbortError") return { ok: false, recoverable: false, message: "Cancelled." };
    return {
      ok: false,
      recoverable: true,
      message: "Sidecar unreachable on 127.0.0.1:3006 — is the launcher running?",
    };
  }
}

async function tryJina(target: string, signal?: AbortSignal): Promise<IngestOutcome> {
  const headers: Record<string, string> = {
    Accept: "text/plain",
    "X-With-Generated-Alt": "true",
  };
  const key = getJinaKey();
  if (key) headers["Authorization"] = `Bearer ${key}`;
  try {
    const res = await fetch(`https://r.jina.ai/${target}`, { method: "GET", headers, signal });
    if (!res.ok) {
      return {
        ok: false,
        recoverable: true,
        message: `Jina Reader returned ${res.status}.${res.status === 401 || res.status === 429 ? " Free-tier rate limit. Trying fallback…" : ""}`,
      };
    }
    const text = await res.text();
    if (!text || text.length < 50) {
      return { ok: false, recoverable: true, message: "Jina returned almost no content. Trying fallback…" };
    }
    const trimmed = text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) : text;
    return { ok: true, url: target, content: trimmed, truncated: text.length > MAX_CHARS, source: "jina" };
  } catch (e: any) {
    if (e?.name === "AbortError") return { ok: false, recoverable: false, message: "Cancelled." };
    return { ok: false, recoverable: true, message: `Jina network error. Trying fallback…` };
  }
}

function stripHtml(html: string): string {
  if (typeof window === "undefined") return html;
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    // Remove non-content elements
    doc.querySelectorAll("script, style, noscript, iframe, svg, link, meta").forEach((el) => el.remove());
    // Convert headings + links to a more useful form
    doc.querySelectorAll("h1, h2, h3, h4").forEach((el) => {
      el.textContent = "\n\n# " + (el.textContent ?? "").trim() + "\n";
    });
    doc.querySelectorAll("li").forEach((el) => {
      el.textContent = "- " + (el.textContent ?? "").trim();
    });
    doc.querySelectorAll("p, div, section").forEach((el) => {
      el.appendChild(document.createTextNode("\n"));
    });
    const text = (doc.body?.innerText || doc.body?.textContent || "").trim();
    // Collapse 3+ blank lines down to 2
    return text.replace(/\n{3,}/g, "\n\n");
  } catch {
    // Fallback: very crude tag strip
    return html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }
}

async function tryAllOrigins(target: string, signal?: AbortSignal): Promise<IngestOutcome> {
  try {
    const proxy = `https://api.allorigins.win/raw?url=${encodeURIComponent(target)}`;
    const res = await fetch(proxy, { method: "GET", signal });
    if (!res.ok) {
      return { ok: false, recoverable: true, message: `AllOrigins returned ${res.status}.` };
    }
    const html = await res.text();
    if (!html || html.length < 100) {
      return { ok: false, recoverable: true, message: "AllOrigins returned almost no content." };
    }
    const text = stripHtml(html);
    if (!text || text.length < 200) {
      return { ok: false, recoverable: true, message: "Page content too thin to extract — paste manually instead." };
    }
    const trimmed = text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) : text;
    return { ok: true, url: target, content: trimmed, truncated: text.length > MAX_CHARS, source: "allorigins" };
  } catch (e: any) {
    if (e?.name === "AbortError") return { ok: false, recoverable: false, message: "Cancelled." };
    return { ok: false, recoverable: true, message: "AllOrigins unreachable from this browser." };
  }
}

/** Debug helper — every reader attempt logs to the browser console with a
 *  consistent prefix. Open DevTools (F12) → Console tab to watch the ingest
 *  pipeline live. Easy to grep, easy to disable later if it gets noisy. */
function dbg(stage: string, payload?: unknown): void {
  if (typeof window === "undefined") return;
  // eslint-disable-next-line no-console
  console.debug("[adforge:url-ingest]", stage, payload ?? "");
}

export async function ingestUrl(rawUrl: string, signal?: AbortSignal): Promise<IngestOutcome> {
  dbg("ingest:start", { rawUrl });
  let target: string;
  try {
    target = normalize(rawUrl);
    new URL(target);
  } catch {
    dbg("ingest:invalid-url");
    return { ok: false, recoverable: false, message: "That doesn't look like a valid URL." };
  }

  // Special case: Jina search URLs (s.jina.ai/<query>) — those have to go
  // through Jina, the sidecar can't replicate Google search.
  const isJinaSearch = /^https?:\/\/s\.jina\.ai\//i.test(target);
  dbg("ingest:target-normalized", { target, isJinaSearch });

  // Strategy (most-reliable first):
  //   1. Local sidecar — no CORS, no quota, no third-party dependency
  //   2. Jina Reader — best HTML→markdown extraction, occasional rate limits
  //   3. AllOrigins — last-resort CORS proxy when both above fail
  // Skip the sidecar for Jina-search URLs since we want Jina to do the search.
  const errors: string[] = [];

  if (!isJinaSearch) {
    dbg("ingest:try-sidecar");
    const sidecar = await trySidecar(target, signal);
    dbg("ingest:sidecar-result", sidecar);
    if (sidecar.ok) return sidecar;
    errors.push(`Sidecar — ${sidecar.message}`);
  } else {
    dbg("ingest:skip-sidecar-jina-search");
  }

  dbg("ingest:try-jina");
  const jina = await tryJina(target, signal);
  dbg("ingest:jina-result", jina);
  if (jina.ok) return jina;
  errors.push(`Jina — ${jina.message}`);

  dbg("ingest:try-allorigins");
  const ao = await tryAllOrigins(target, signal);
  dbg("ingest:allorigins-result", ao);
  if (ao.ok) return ao;
  errors.push(`AllOrigins — ${ao.message}`);

  dbg("ingest:all-failed", { errors });

  // Build a diagnostic failure message that names what each reader actually
  // returned, so the user can self-diagnose (stale sidecar, Jina rate limit,
  // network offline) instead of guessing.
  return {
    ok: false,
    recoverable: true,
    message:
      `Couldn't reach the URL via any reader. Each one returned:\n\n` +
      errors.map((e) => `  • ${e}`).join("\n") +
      `\n\nFix: open ${target} in a new tab, select all (Ctrl+A / ⌘A), copy (Ctrl+C / ⌘C), and paste into the box below.`,
  };
}

/**
 * Manual ingest helper — given user-pasted page content, returns it in the same shape as a successful URL ingest.
 */
export function ingestPasted(rawUrl: string, content: string): IngestOutcome {
  if (!content || content.trim().length < 50) {
    return { ok: false, recoverable: false, message: "Paste at least a couple paragraphs of content." };
  }
  const target = rawUrl ? normalize(rawUrl) : "manual-paste";
  const trimmed = content.length > MAX_CHARS ? content.slice(0, MAX_CHARS) : content;
  return { ok: true, url: target, content: trimmed, truncated: content.length > MAX_CHARS, source: "jina" };
}

export interface SocialProbe {
  platform: "facebook" | "instagram" | "linkedin" | "twitter" | "tiktok" | "youtube" | "other";
  openUrl: string;
  paste_hint: string;
}

const SOCIAL_HOSTS: Record<string, SocialProbe["platform"]> = {
  "facebook.com": "facebook",
  "m.facebook.com": "facebook",
  "fb.com": "facebook",
  "instagram.com": "instagram",
  "linkedin.com": "linkedin",
  "twitter.com": "twitter",
  "x.com": "twitter",
  "tiktok.com": "tiktok",
  "youtube.com": "youtube",
  "youtu.be": "youtube",
};

export function detectSocial(url: string): SocialProbe | null {
  try {
    const u = new URL(normalize(url));
    const host = u.hostname.replace(/^www\./, "");
    const platform = SOCIAL_HOSTS[host];
    if (!platform) return null;
    const hints: Record<SocialProbe["platform"], string> = {
      facebook: "Open this Facebook page → copy the bio + 5 recent posts + any About section text → paste below.",
      instagram: "Open this Instagram profile → copy bio + the captions from 5 recent posts → paste below.",
      linkedin: "Open this LinkedIn page → copy the About section + recent posts → paste below.",
      twitter: "Open this profile → copy bio + 10 pinned/recent tweets → paste below.",
      tiktok: "Open this TikTok profile → copy bio + captions from recent videos → paste below.",
      youtube: "Open the About tab → copy channel description + any recent video titles → paste below.",
      other: "Open and copy what you find.",
    };
    return { platform, openUrl: u.toString(), paste_hint: hints[platform] };
  } catch {
    return null;
  }
}
