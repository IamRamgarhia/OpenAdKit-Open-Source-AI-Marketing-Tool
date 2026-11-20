"use client";

import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal, ThumbsUp, Share2 } from "lucide-react";

interface MetaFeedProps {
  brand: string;
  brand_initial?: string;
  primary_text: string;
  headline: string;
  description?: string;
  cta?: string;
  image_caption?: string;
}

export function MetaFeedMockup({ brand, brand_initial, primary_text, headline, description, cta, image_caption }: MetaFeedProps) {
  return (
    <div className="bg-white text-gray-900 max-w-[440px] mx-auto border border-gray-300 rounded-lg overflow-hidden font-sans">
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="h-9 w-9 rounded-full bg-blue-600 grid place-items-center text-white font-semibold text-sm">
          {brand_initial ?? brand.slice(0, 1).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold text-gray-900 truncate flex items-center gap-1">
            {brand} <span className="text-blue-600">·</span>
          </div>
          <div className="text-[11px] text-gray-500">Sponsored · <span className="text-gray-700">●</span></div>
        </div>
        <MoreHorizontal size={18} className="text-gray-500" />
      </div>
      <div className="px-3 pb-2 text-[14px] leading-snug text-gray-900 whitespace-pre-line">
        {primary_text}
      </div>
      <div className="aspect-4/5 bg-linear-to-br from-zinc-200 via-zinc-300 to-zinc-100 grid place-items-center text-zinc-500 text-xs italic px-6 text-center">
        {image_caption || "[ ad image — generate via /generate/creative-prompts ]"}
      </div>
      <div className="flex items-center justify-between bg-gray-50 px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-wider text-gray-500">acme.com</div>
          <div className="text-[13px] font-semibold text-gray-900 truncate">{headline}</div>
          {description ? <div className="text-[11px] text-gray-600 truncate">{description}</div> : null}
        </div>
        <button className="ml-3 shrink-0 bg-gray-200 hover:bg-gray-300 text-gray-900 text-[12px] font-semibold px-3 py-1.5 rounded-sm">
          {cta || "Learn More"}
        </button>
      </div>
      <div className="flex items-center justify-around border-t border-gray-200 py-1.5 text-gray-600">
        <button className="flex items-center gap-1.5 text-[12px] hover:bg-gray-100 px-3 py-1 rounded-sm"><ThumbsUp size={16} /> Like</button>
        <button className="flex items-center gap-1.5 text-[12px] hover:bg-gray-100 px-3 py-1 rounded-sm"><MessageCircle size={16} /> Comment</button>
        <button className="flex items-center gap-1.5 text-[12px] hover:bg-gray-100 px-3 py-1 rounded-sm"><Share2 size={16} /> Share</button>
      </div>
    </div>
  );
}

interface ReelsProps {
  brand: string;
  primary_text: string;
  overlay_text?: string;
  cta?: string;
}

export function ReelsMockup({ brand, primary_text, overlay_text, cta }: ReelsProps) {
  return (
    <div className="relative w-[240px] h-[428px] mx-auto bg-black overflow-hidden rounded-xl">
      {/* Background video stand-in */}
      <div className="absolute inset-0 bg-linear-to-br from-purple-900 via-pink-700 to-orange-600" />
      {overlay_text ? (
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 max-w-[80%] text-center">
          <div className="inline-block px-3 py-2 bg-black/40 backdrop-blur-sm text-white text-[15px] font-bold leading-tight">
            {overlay_text}
          </div>
        </div>
      ) : null}
      {/* Side icons */}
      <div className="absolute right-2 bottom-24 flex flex-col gap-3 items-center text-white">
        <Heart size={22} />
        <MessageCircle size={22} />
        <Send size={22} />
        <Bookmark size={22} />
      </div>
      {/* Bottom caption */}
      <div className="absolute left-3 right-12 bottom-3 text-white">
        <div className="text-[11px] font-semibold">{brand} · Sponsored</div>
        <div className="text-[11px] mt-1 line-clamp-2">{primary_text}</div>
        {cta ? (
          <button className="mt-2 w-full bg-white text-black text-[11px] font-semibold py-1.5 rounded-sm">{cta}</button>
        ) : null}
      </div>
    </div>
  );
}

interface GoogleSearchProps {
  display_url: string;
  headlines: string[];
  descriptions: string[];
  sitelinks?: { title: string; desc1: string; desc2: string }[];
}

export function GoogleSearchMockup({ display_url, headlines, descriptions, sitelinks }: GoogleSearchProps) {
  const h1 = headlines[0] ?? "Headline 1";
  const h2 = headlines[1] ?? "";
  const h3 = headlines[2] ?? "";
  const d1 = descriptions[0] ?? "Description 1";
  const d2 = descriptions[1] ?? "";
  return (
    <div className="bg-white text-gray-900 max-w-[560px] mx-auto p-4 font-sans border border-gray-200 rounded-sm">
      <div className="flex items-center gap-1.5 text-[12px] mb-1">
        <span className="bg-gray-100 text-gray-700 font-bold px-1.5 py-0.5 rounded-sm text-[10px]">Sponsored</span>
        <span className="text-gray-600">{display_url}</span>
      </div>
      <h3 className="text-[18px] text-[#1a0dab] hover:underline cursor-pointer font-normal leading-snug">
        {h1}
        {h2 ? <> · {h2}</> : null}
        {h3 ? <> | {h3}</> : null}
      </h3>
      <p className="text-[13px] text-gray-700 mt-1 leading-snug">
        {d1} {d2}
      </p>
      {sitelinks?.length ? (
        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[13px]">
          {sitelinks.slice(0, 4).map((s, i) => (
            <div key={i}>
              <a className="text-[#1a0dab] hover:underline">{s.title}</a>
              <p className="text-[11px] text-gray-600 leading-tight">{s.desc1}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

interface TikTokProps {
  brand: string;
  hook: string;
  caption: string;
  hashtags?: string[];
  cta?: string;
}

export function TikTokMockup({ brand, hook, caption, hashtags, cta }: TikTokProps) {
  return (
    <div className="relative w-[240px] h-[428px] mx-auto bg-black overflow-hidden rounded-xl text-white">
      <div className="absolute inset-0 bg-linear-to-br from-zinc-800 via-zinc-700 to-zinc-900" />
      <div className="absolute top-3 left-3 right-3 flex justify-between text-[11px]">
        <span>Following</span>
        <span className="font-bold border-b-2 border-white pb-0.5">For You</span>
        <span></span>
      </div>
      <div className="absolute top-1/3 left-3 right-12 max-w-[80%]">
        <div className="inline-block px-3 py-2 bg-black/30 backdrop-blur-sm text-white text-[15px] font-bold leading-tight">
          {hook}
        </div>
      </div>
      <div className="absolute right-2 bottom-32 flex flex-col gap-4 items-center">
        <Heart size={26} />
        <MessageCircle size={26} />
        <Bookmark size={26} />
        <Send size={26} />
      </div>
      <div className="absolute left-3 right-14 bottom-3">
        <div className="text-[12px] font-semibold mb-0.5">@{brand.toLowerCase().replace(/\s+/g, "")}</div>
        <div className="text-[11px] leading-snug line-clamp-2">{caption}</div>
        {hashtags?.length ? (
          <div className="text-[11px] mt-1 text-zinc-300 truncate">{hashtags.slice(0, 3).join(" ")}</div>
        ) : null}
        {cta ? (
          <button className="mt-1.5 bg-white text-black text-[11px] font-semibold px-3 py-1 rounded-sm">{cta}</button>
        ) : null}
      </div>
    </div>
  );
}

interface YouTubeProps {
  title: string;
  description: string;
  channel: string;
}

export function YouTubeMockup({ title, description, channel }: YouTubeProps) {
  return (
    <div className="bg-white text-gray-900 max-w-[480px] mx-auto rounded-sm overflow-hidden border border-gray-200">
      <div className="aspect-video bg-linear-to-br from-red-600 via-red-700 to-red-900 relative grid place-items-center text-white">
        <div className="absolute inset-0 grid place-items-center opacity-80">
          <div className="w-16 h-16 bg-white/20 rounded-full grid place-items-center backdrop-blur-sm">
            <div className="w-0 h-0 border-y-12 border-y-transparent border-l-18 border-l-white ml-1"></div>
          </div>
        </div>
        <span className="absolute bottom-2 right-2 bg-black/80 px-1.5 py-0.5 text-[11px] rounded-sm">15s</span>
        <span className="absolute top-2 left-2 bg-black/70 text-[10px] px-1.5 py-0.5 rounded-sm">Ad</span>
      </div>
      <div className="p-3">
        <h4 className="font-semibold text-[14px] leading-snug line-clamp-2">{title}</h4>
        <div className="text-[12px] text-gray-600 mt-1">{channel}</div>
        <p className="text-[12px] text-gray-700 mt-1 line-clamp-2">{description}</p>
        <button className="mt-2 bg-blue-600 hover:bg-blue-700 text-white text-[12px] font-semibold px-3 py-1.5 rounded-sm">
          Visit site
        </button>
      </div>
    </div>
  );
}
