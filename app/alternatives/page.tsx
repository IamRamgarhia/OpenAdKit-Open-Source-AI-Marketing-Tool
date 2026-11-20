/**
 * /alternatives — the SEO-targeted comparison hub.
 *
 * Captures search intent for: "Jasper alternative", "AdCreative alternative",
 * "Anyword alternative", "Copy.ai alternative", "free AI marketing tool".
 * Each H2 is a named-competitor anchor so per-competitor queries land
 * directly on the relevant comparison section.
 *
 * Server-rendered, no client-side JS, no ApiKeyGate. Indexed by Google.
 * Pure content page — the heavy lifting for ranking is the H2 structure +
 * comparison tables + FAQ at the bottom.
 */
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "OpenAdKit vs Jasper, AdCreative, Anyword, Copy.ai — Free Alternatives Compared",
  description:
    "Side-by-side comparison: OpenAdKit is the free MIT-licensed open-source alternative to Jasper ($39–59/mo), AdCreative ($39–249/mo), Anyword ($49–499/mo), Copy.ai ($49/mo). 18 AI ad generators, 9 LLM providers (BYOK), browser-only.",
  alternates: { canonical: "/alternatives" },
  openGraph: {
    title: "OpenAdKit vs Jasper, AdCreative, Anyword, Copy.ai — Free Alternatives",
    description:
      "Free open-source alternative to the $49–499/mo AI marketing stack. 18 ad generators across every platform. BYOK, browser-only, MIT-licensed.",
    type: "article",
  },
};

interface Competitor {
  slug: string;
  name: string;
  tagline: string;
  pricing: string;
  whatTheyDoWell: string[];
  whatTheyLack: string[];
  whyOpenAdKit: string;
}

const COMPETITORS: Competitor[] = [
  {
    slug: "jasper",
    name: "Jasper",
    tagline: "Long-form + ad-copy generation with brand-voice training.",
    pricing: "$39–$59 per seat per month. 7-day trial. No free tier.",
    whatTheyDoWell: [
      "Polished brand-voice consistency across long-form content",
      "Templates for common marketing surfaces (blog, email, social)",
      "Team collaboration features on higher tiers",
    ],
    whatTheyLack: [
      "No platform-specific format awareness — generic copy that ignores Meta's 27-char mobile headline cap or Google PMax asset groups",
      "Per-seat pricing that scales painfully for agencies",
      "Closed-source — no self-hosting, no audit, no modification",
      "Word/credit caps that surprise users at month-end",
    ],
    whyOpenAdKit:
      "OpenAdKit covers the same ad-copy surfaces plus 11 dedicated optimizers (creative score, CTR, ad fatigue, quality score) that Jasper doesn't have. BYOK across 9 providers means you can match Jasper's output quality (Claude / GPT-4) at $0 marginal cost beyond your own API spend.",
  },
  {
    slug: "adcreative",
    name: "AdCreative.ai",
    tagline: "AI-generated ad creatives with 'conversion probability' scoring.",
    pricing: "$39–$249+/month. Trial only.",
    whatTheyDoWell: [
      "Visual ad-creative generation (banners, video) — OpenAdKit does NOT do this in-app",
      "Conversion-score predictions tied to historic ad-platform data",
      "Built-in Meta + Google Ads connections for direct push",
    ],
    whatTheyLack: [
      "Opaque scoring — no way to understand or audit how the 'conversion score' is computed",
      "Limited copy variety per credit allocation",
      "Closed-source, no BYOK — locked to their LLM choices and pricing",
    ],
    whyOpenAdKit:
      "OpenAdKit beats AdCreative on copy generation breadth (18 generators vs ~6 in their copy module) and on optimizer count. For images/video, OpenAdKit returns ready-to-paste prompts for Midjourney / DALL-E / Runway / Pika plus a directory of free + paid tools per use case — you keep choice and don't get locked into their model.",
  },
  {
    slug: "anyword",
    name: "Anyword",
    tagline: "Predictive copy scoring + audience-targeted variants.",
    pricing: "$49–$499/month per seat.",
    whatTheyDoWell: [
      "Per-variant predictive scoring that correlates with historical performance",
      "Brand-voice training from past high-performers",
      "Industry-specific copy templates",
    ],
    whatTheyLack: [
      "Steep price gap between tiers — enterprise features paywalled at $499/mo",
      "No platform-specific format generators (PMax, Spark Ads, Branded Hashtag Challenge)",
      "Single-LLM lock-in, no BYOK",
    ],
    whyOpenAdKit:
      "OpenAdKit's Creative Score optimizer covers similar scoring ground (5-lever score + named fixes + predicted CTR band) without the per-seat fee. Anyword's brand-voice training maps to OpenAdKit's Brand Brain (auto-extracted from any URL — no manual setup needed).",
  },
  {
    slug: "copy-ai",
    name: "Copy.ai",
    tagline: "Multi-step GTM workflows + 'agents' for sales and marketing teams.",
    pricing: "Free tier (2k words/mo), Pro $49/mo, Team $249/mo.",
    whatTheyDoWell: [
      "Workflow orchestration — chain multiple AI steps into a pipeline",
      "Sales-prospecting agents on higher tiers",
      "Free tier exists (though tiny)",
    ],
    whatTheyLack: [
      "Free tier caps you at 2,000 words/mo — burns through in a single content-calendar generation",
      "Workflow features are paywalled at $249/mo Team tier",
      "Generic ad-copy templates, no platform-specific format constraints",
    ],
    whyOpenAdKit:
      "OpenAdKit has no word/credit caps because you pay your LLM provider directly (free tiers available on Groq, Gemini, Cerebras, OpenRouter). The Launch Wizard handles the same multi-step orchestration Copy.ai charges $249/mo for, and the 18 generators each include platform-specific format enforcement Copy.ai's generic templates don't.",
  },
  {
    slug: "pencil",
    name: "Pencil (Genus.ai)",
    tagline: "AI ad creative generation with performance prediction.",
    pricing: "Custom enterprise pricing, ~$119+/month.",
    whatTheyDoWell: [
      "Visual creative generation tied to performance prediction",
      "Performance feedback loops from actual ad-platform data",
    ],
    whatTheyLack: [
      "Pivoted to enterprise — out of reach for solo / SMB marketers",
      "Closed-source, vendor lock-in on brand assets and historical performance data",
    ],
    whyOpenAdKit:
      "OpenAdKit is the right tool for the solo and SMB segment Pencil left behind when it pivoted. Same copy + optimizer breadth, $0 instead of $119+/mo, MIT-licensed so your work and brand data stay yours forever.",
  },
];

export default function AlternativesPage() {
  return (
    <article className="max-w-4xl mx-auto py-8 space-y-8">
      <header className="space-y-3">
        <h1 className="font-display italic text-5xl text-ink leading-tight">
          OpenAdKit vs Jasper, AdCreative, Anyword, Copy.ai
        </h1>
        <p className="text-lg text-ink-muted leading-relaxed">
          A side-by-side look at how OpenAdKit — the free, open-source, BYOK AI marketing tool — compares
          to the leading paid alternatives. Skip to the comparison you care about, or read all five.
        </p>
        <nav className="flex flex-wrap gap-2 pt-2" aria-label="Jump to comparison">
          {COMPETITORS.map((c) => (
            <a
              key={c.slug}
              href={`#vs-${c.slug}`}
              className="text-[11px] font-mono uppercase tracking-ui-wide border border-base-600 text-ink-muted hover:border-live hover:text-live px-3 py-1.5 transition"
            >
              vs {c.name}
            </a>
          ))}
        </nav>
      </header>

      <section className="border border-base-700 bg-base-900/30 p-5 space-y-2">
        <h2 className="text-[10px] font-mono uppercase tracking-ui-mega text-live">
          The 30-second version
        </h2>
        <p className="text-base text-ink leading-relaxed">
          OpenAdKit replaces a <strong>$49–$499/month stack</strong> of paid AI marketing tools with
          <strong> one MIT-licensed app that runs entirely in your browser</strong>. Bring your own AI key
          (Claude, GPT, Gemini, Groq, Cerebras, OpenRouter, Together, DeepSeek, or Mistral — free tiers
          available on four of those), and get 18 ad generators, 11 optimizers, multi-client brand
          brains, batch mode, and competitor research for <strong>$0/month, forever</strong>.
        </p>
        <p className="text-sm text-ink-muted leading-relaxed">
          No accounts. No subscriptions. No telemetry. No per-seat fees. No word/credit caps. No vendor
          lock-in. <Link href="/" className="text-live underline">Try the cockpit</Link> or
          {" "}
          <a
            href="https://github.com/IamRamgarhia/OpenAdKit-Open-Source-AI-Marketing-Tool"
            className="text-live underline"
            target="_blank"
            rel="noreferrer"
          >
            view the source on GitHub
          </a>
          .
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="font-display italic text-3xl text-ink">What you actually get — screenshots</h2>
        <p className="text-sm text-ink-muted">
          Real production UI, not mockups. Same browser app whether you self-host or use the hosted
          deploy.
        </p>
        <div className="grid md:grid-cols-2 gap-4">
          <figure className="border border-base-700 bg-base-900/30 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/screenshots/08-cockpit-dashboard.png"
              alt="OpenAdKit dashboard cockpit showing 18 AI ad generators and 11 optimizers organized by ad platform"
              loading="lazy"
              width={1600}
              height={1000}
              className="w-full h-auto"
            />
            <figcaption className="text-[11px] font-mono uppercase tracking-ui-wide text-ink-faint px-3 py-2 border-t border-base-700">
              Dashboard — every tool one click away
            </figcaption>
          </figure>
          <figure className="border border-base-700 bg-base-900/30 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/screenshots/09-settings-providers.png"
              alt="OpenAdKit settings showing all 9 supported AI providers — Claude, GPT, Gemini, Groq, Cerebras, OpenRouter, Together AI, DeepSeek, Mistral — with BYOK API key fields"
              loading="lazy"
              width={1600}
              height={1000}
              className="w-full h-auto"
            />
            <figcaption className="text-[11px] font-mono uppercase tracking-ui-wide text-ink-faint px-3 py-2 border-t border-base-700">
              Settings — 9 AI providers, your keys
            </figcaption>
          </figure>
          <figure className="border border-base-700 bg-base-900/30 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/screenshots/10-generator-meta-ads.png"
              alt="OpenAdKit Meta Ads generator producing 3 angle-distinct Facebook and Instagram ad copy variants with character count validation"
              loading="lazy"
              width={1600}
              height={1000}
              className="w-full h-auto"
            />
            <figcaption className="text-[11px] font-mono uppercase tracking-ui-wide text-ink-faint px-3 py-2 border-t border-base-700">
              Meta Ads generator — 3 angles per request
            </figcaption>
          </figure>
          <figure className="border border-base-700 bg-base-900/30 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/screenshots/11-optimizer-creative-score.png"
              alt="OpenAdKit Creative Score optimizer with 5-lever scoring rubric and named-phrase fixes for paid social and search ads"
              loading="lazy"
              width={1600}
              height={1000}
              className="w-full h-auto"
            />
            <figcaption className="text-[11px] font-mono uppercase tracking-ui-wide text-ink-faint px-3 py-2 border-t border-base-700">
              Creative Score — brutal 5-lever rubric
            </figcaption>
          </figure>
          <figure className="border border-base-700 bg-base-900/30 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/screenshots/12-research-competitors.png"
              alt="OpenAdKit competitor research linking to Meta Ads Library, Google Ads Transparency, TikTok Top Ads, and LinkedIn Ad Library"
              loading="lazy"
              width={1600}
              height={1000}
              className="w-full h-auto"
            />
            <figcaption className="text-[11px] font-mono uppercase tracking-ui-wide text-ink-faint px-3 py-2 border-t border-base-700">
              Competitor research — link to public ad libraries
            </figcaption>
          </figure>
          <figure className="border border-base-700 bg-base-900/30 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/screenshots/06-learn-frameworks-trainer.png"
              alt="OpenAdKit ad copywriting framework trainer covering PAS, AIDA, BAB, 4 U's, and Schwartz awareness ladder"
              loading="lazy"
              width={1600}
              height={1000}
              className="w-full h-auto"
            />
            <figcaption className="text-[11px] font-mono uppercase tracking-ui-wide text-ink-faint px-3 py-2 border-t border-base-700">
              Learn — built-in ad copywriting trainer
            </figcaption>
          </figure>
        </div>
      </section>

      {COMPETITORS.map((c) => (
        <section key={c.slug} id={`vs-${c.slug}`} className="space-y-4 scroll-mt-16">
          <header className="space-y-1 border-b border-base-700 pb-3">
            <h2 className="font-display italic text-3xl text-ink">
              OpenAdKit vs {c.name}
            </h2>
            <p className="text-sm text-ink-muted">{c.tagline}</p>
            <p className="text-[11px] font-mono uppercase tracking-ui-wide text-ink-faint">
              {c.name} pricing: {c.pricing}
            </p>
          </header>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="border border-pos/30 bg-pos/4 p-4 space-y-2">
              <h3 className="text-[11px] font-mono uppercase tracking-ui-wide text-pos">
                Where {c.name} is strong
              </h3>
              <ul className="space-y-1.5 text-sm text-ink leading-relaxed">
                {c.whatTheyDoWell.map((item, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-pos shrink-0">+</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="border border-neg/30 bg-neg/4 p-4 space-y-2">
              <h3 className="text-[11px] font-mono uppercase tracking-ui-wide text-neg">
                Where {c.name} falls short
              </h3>
              <ul className="space-y-1.5 text-sm text-ink leading-relaxed">
                {c.whatTheyLack.map((item, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-neg shrink-0">−</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="border border-live/40 bg-live/4 p-4 space-y-2">
            <h3 className="text-[11px] font-mono uppercase tracking-ui-wide text-live">
              Why pick OpenAdKit over {c.name}
            </h3>
            <p className="text-sm text-ink leading-relaxed">{c.whyOpenAdKit}</p>
          </div>
        </section>
      ))}

      <section className="border-t border-base-700 pt-6 space-y-4">
        <h2 className="font-display italic text-3xl text-ink">Frequently asked</h2>
        <div className="space-y-4">
          <div>
            <h3 className="text-base font-medium text-ink mb-1">
              Is OpenAdKit really free, or is it freemium?
            </h3>
            <p className="text-sm text-ink-muted leading-relaxed">
              Truly free. $0/month forever. MIT-licensed. The only cost is whatever you spend with
              your chosen AI provider — and four of the nine supported providers (Groq, Gemini,
              Cerebras, OpenRouter) have generous free tiers that cover normal usage at $0.
            </p>
          </div>
          <div>
            <h3 className="text-base font-medium text-ink mb-1">
              What's the catch? How do you make money?
            </h3>
            <p className="text-sm text-ink-muted leading-relaxed">
              There's no business model. OpenAdKit is open-source under MIT, built by DiceCodes
              as a free tool for the marketing community. No upsells, no premium tier, no paid
              add-ons. The code is on GitHub — you can audit, fork, modify, self-host.
            </p>
          </div>
          <div>
            <h3 className="text-base font-medium text-ink mb-1">
              Can I switch from {COMPETITORS.map((c) => c.name).join(" / ")} to OpenAdKit easily?
            </h3>
            <p className="text-sm text-ink-muted leading-relaxed">
              Yes. There's nothing to import — OpenAdKit's Brand Brain extracts everything it needs
              from your website URL in one click. Paste your brand site, get a populated brand
              profile, start generating. Total switching time is usually 5–10 minutes.
            </p>
          </div>
          <div>
            <h3 className="text-base font-medium text-ink mb-1">
              Where does my data live?
            </h3>
            <p className="text-sm text-ink-muted leading-relaxed">
              100% in your own browser (IndexedDB) and, when running locally, in a{" "}
              <code className="text-[11px] bg-base-900 px-1 py-0.5">data/snapshot.json</code> file
              inside the OpenAdKit folder. No accounts, no cloud sync, no telemetry. Your AI API
              keys never leave the browser — every LLM call goes from your browser directly to the
              provider.
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t border-base-700 pt-6 space-y-2">
        <p className="text-sm text-ink-muted">
          Ready to try the free open-source alternative?{" "}
          <Link href="/setup" className="text-live underline">
            Set up in 60 seconds
          </Link>
          .
        </p>
        <p className="text-[11px] font-mono uppercase tracking-ui-wide text-ink-faint">
          Last updated: May 2026 · Built by{" "}
          <a href="https://dicecodes.com" target="_blank" rel="noreferrer" className="hover:text-live">
            DiceCodes
          </a>
        </p>
      </footer>
    </article>
  );
}
