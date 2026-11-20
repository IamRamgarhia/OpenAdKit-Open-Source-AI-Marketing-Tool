"use client";

import { useEffect, useState } from "react";
import { FolderPlus } from "lucide-react";
import { listCampaigns, saveCampaign, updateAd, type Campaign } from "@/lib/storage";

const NEW = "__new__";

/**
 * "Add to campaign" control for a saved ad. Writes ad.campaign_id via
 * updateAd(). Lists the ad's brand's campaigns, and offers inline creation so
 * a user with zero campaigns isn't sent elsewhere first.
 *
 * Campaigns used to be fillable ONLY by the Launch Wizard — nothing else ever
 * set campaign_id, so the "Save to a campaign" next-step was a dead end.
 */
export function CampaignPicker({
  adId,
  brandId,
  value,
  onChange,
  compact,
}: {
  adId: string;
  brandId: string;
  value?: string;
  onChange?: (campaignId: string | undefined) => void;
  compact?: boolean;
}) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [current, setCurrent] = useState(value ?? "");
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listCampaigns(brandId || undefined).then((c) => {
      if (!cancelled) setCampaigns(c);
    });
    return () => {
      cancelled = true;
    };
  }, [brandId]);

  async function pick(next: string) {
    let campaignId = next;
    if (next === NEW) {
      const name = window.prompt("Name the new campaign", "");
      if (!name || !name.trim()) return;
      const c: Campaign = {
        id: crypto.randomUUID(),
        brand_id: brandId,
        name: name.trim(),
        goal: "",
        status: "planning",
        created_at: Date.now(),
      };
      await saveCampaign(c);
      setCampaigns((cur) => [c, ...cur]);
      campaignId = c.id;
    }
    await updateAd(adId, { campaign_id: campaignId || undefined });
    setCurrent(campaignId);
    const name = campaigns.find((c) => c.id === campaignId)?.name;
    setStatus(campaignId ? `Added${name ? ` to ${name}` : ""}` : "Removed from campaign");
    onChange?.(campaignId || undefined);
  }

  return (
    <div className={`flex items-center gap-2 ${compact ? "" : "flex-wrap"}`}>
      <label className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-ui-mega text-ink-faint">
        <FolderPlus size={11} />
        <span>campaign</span>
        <select
          aria-label="Add to campaign"
          data-testid="campaign-picker"
          className="input-base w-auto py-1 text-[11px] normal-case tracking-normal"
          value={current}
          onChange={(e) => pick(e.target.value)}
        >
          <option value="">— none —</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          <option value={NEW}>+ New campaign…</option>
        </select>
      </label>
      {status ? (
        <span role="status" className="text-[10px] font-mono uppercase tracking-ui-wide text-pos">
          ✓ {status}
        </span>
      ) : null}
    </div>
  );
}
