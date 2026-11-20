import { db, type GeneratedAd } from "./storage";

/**
 * Generation metadata stored alongside a saved ad.
 *
 * GeneratedAd (lib/storage.ts) doesn't declare these yet and normalizeAd()
 * drops unknown keys on read, so they're written as extra columns on the
 * Dexie row and read back from the raw row here. Optional everywhere: ads
 * saved before this existed simply lack them.
 */
export interface AdGenMeta {
  /** maxTokens the original generation ran with — Regenerate reuses it. */
  max_tokens?: number;
  /** True when the original prompt included an image (vision run). The
   *  image itself is never persisted, so a regenerate is text-only. */
  has_image?: boolean;
}

export type GeneratedAdWithMeta = GeneratedAd & AdGenMeta;

export function withGenMeta(ad: GeneratedAd, meta: AdGenMeta): GeneratedAdWithMeta {
  const out: GeneratedAdWithMeta = { ...ad };
  if (meta.max_tokens && Number.isFinite(meta.max_tokens)) out.max_tokens = Math.round(meta.max_tokens);
  if (meta.has_image) out.has_image = true;
  return out;
}

export async function readAdGenMeta(id: string): Promise<AdGenMeta> {
  try {
    const row = (await db().ads.get(id)) as (GeneratedAd & AdGenMeta) | undefined;
    if (!row) return {};
    const out: AdGenMeta = {};
    const n = Number(row.max_tokens);
    if (Number.isFinite(n) && n > 0) out.max_tokens = n;
    if (row.has_image === true) out.has_image = true;
    return out;
  } catch {
    return {};
  }
}
