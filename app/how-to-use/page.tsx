/**
 * /how-to-use — step-by-step usage guide.
 *
 * High-intent SEO target. Captures search queries like:
 *   "how to use openadkit", "openadkit tutorial", "openadkit getting started",
 *   "how to use AI ad generator", "open source ai marketing tool tutorial"
 *
 * Server-rendered, no client-side JS, no ApiKeyGate. Indexable by Google.
 * Mirrors the README "How to use OpenAdKit — step-by-step" section but with
 * hyperlinked internal navigation and HowTo schema for rich results.
 */
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "How to Use OpenAdKit — Step-by-Step Guide (10 Minutes Start to First Ad)",
  description:
    "Complete step-by-step guide to OpenAdKit, the free open-source AI marketing tool. Install, add your first brand from a URL, generate Meta/Google/TikTok ads, score and optimize before launch. Your first 10 minutes covered.",
  alternates: { canonical: "/how-to-use" },
  openGraph: {
    title: "How to Use OpenAdKit — Step-by-Step Guide",
    description:
      "Install, add your first brand, generate AI ad copy across Meta/Google/TikTok/LinkedIn, score and optimize before launch — all in your first 10 minutes.",
    type: "article",
  },
};

// HowTo structured data for Google rich results.
const HOW_TO_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "How to use OpenAdKit — open source AI marketing tool",
  description:
    "Install OpenAdKit, set up an AI provider, auto-extract a brand profile from a URL, generate platform-specific ad copy, and score it before launch — all in about 10 minutes.",
  totalTime: "PT10M",
  estimatedCost: {
    "@type": "MonetaryAmount",
    currency: "USD",
    value: "0",
  },
  supply: [
    { "@type": "HowToSupply", name: "A computer with a modern browser (Chrome, Firefox, Safari, Edge)" },
    { "@type": "HowToSupply", name: "An AI provider API key — free tier on Groq, Gemini, Cerebras, or OpenRouter, or paid key for Claude / GPT / Mistral / DeepSeek" },
    { "@type": "HowToSupply", name: "Optional: a website URL to auto-extract a brand profile from" },
  ],
  step: [
    {
      "@type": "HowToStep",
      name: "Get OpenAdKit running",
      text: "Pick one of two install paths: (A) Hosted — click Deploy with Vercel or Cloudflare in the GitHub README for your own URL in 30 seconds; or (B) Local — download the repo ZIP and double-click OpenAdKit.bat (Windows) or OpenAdKit.command (Mac/Linux). First local run installs dependencies in about 2 minutes; subsequent runs are one click.",
      url: "https://openadkit.dicecodes.com/how-to-use#step-1",
    },
    {
      "@type": "HowToStep",
      name: "Pick an AI provider and paste a key",
      text: "OpenAdKit supports 9 AI providers: free tier on Groq, Gemini, Cerebras, OpenRouter; paid on Anthropic Claude, OpenAI GPT, DeepSeek, Mistral, Together AI. Sign up on the provider's site, copy your API key, paste in the OpenAdKit setup wizard, click Verify, pick a model.",
      url: "https://openadkit.dicecodes.com/how-to-use#step-2",
    },
    {
      "@type": "HowToStep",
      name: "Add your first brand",
      text: "Paste any brand website URL. OpenAdKit reads the homepage plus 2-3 subpages, pulls Open Graph and JSON-LD data, and uses the AI to populate 30+ brand fields including business name, industry, USP, tone, audience pain points and desires, key benefits, brand voice, words to use and avoid, and competitors. Review, edit, save.",
      url: "https://openadkit.dicecodes.com/how-to-use#step-3",
    },
    {
      "@type": "HowToStep",
      name: "Generate your first ad",
      text: "From the dashboard pick a generator (Meta Ads recommended for first-timers). Fill the form (objective, format, product, promotion — pre-filled from your brand brain). Click Generate. You get 3 angle-distinct variants with character count validation for every platform field.",
      url: "https://openadkit.dicecodes.com/how-to-use#step-4",
    },
    {
      "@type": "HowToStep",
      name: "Score and optimize before launch",
      text: "Open Optimize > Creative Score. Paste your ad copy, pick the platform, click Score. You get a 5-lever scoring rubric (hook strength, specificity, urgency, brand fit, conversion potential), a tier verdict (scale / iterate / rewrite / kill), a predicted CTR band, and 3 named fixes. Apply fixes, re-score, repeat until your tier reads scale or iterate. Run additional optimizers (CTR, Budget Waste, Audience Targeting, Quality Score) as needed.",
      url: "https://openadkit.dicecodes.com/how-to-use#step-5",
    },
  ],
};

interface Step {
  id: string;
  num: number;
  title: string;
  duration: string;
  body: React.ReactNode;
}

const STEPS: Step[] = [
  {
    id: "step-1",
    num: 1,
    title: "Get OpenAdKit running",
    duration: "30 seconds – 5 minutes",
    body: (
      <>
        <p>
          Pick one of the two install paths. Both are completely free.
        </p>
        <h3 className="text-base font-medium text-ink mt-4 mb-1">Path A — Hosted (recommended for non-developers)</h3>
        <p>
          Open the GitHub repo and click the <strong>Deploy with Vercel</strong> or{" "}
          <strong>Deploy to Cloudflare</strong> button. Sign in with GitHub, confirm, get
          your own URL in 30 seconds. Works on any device with a browser including mobile.
        </p>
        <h3 className="text-base font-medium text-ink mt-4 mb-1">Path B — Local install (works offline)</h3>
        <ol className="list-decimal list-inside space-y-1 text-sm text-ink-muted leading-relaxed">
          <li>Download the repo as a ZIP (green "Code" button → "Download ZIP") and extract it.</li>
          <li>
            On Windows double-click <code className="text-[12px] bg-base-900 px-1 py-0.5">OpenAdKit.bat</code>; on
            Mac/Linux double-click <code className="text-[12px] bg-base-900 px-1 py-0.5">OpenAdKit.command</code>.
          </li>
          <li>First run installs dependencies (~2 minutes) and drops a desktop shortcut.</li>
          <li>From the second launch onwards it's a single double-click → browser opens to the app.</li>
        </ol>
        <p className="mt-3 text-[13px] text-ink-muted">
          <strong className="text-live">You'll know it worked</strong> when the OpenAdKit setup wizard
          loads in your browser.
        </p>
      </>
    ),
  },
  {
    id: "step-2",
    num: 2,
    title: "Pick an AI provider and paste a key",
    duration: "2 minutes",
    body: (
      <>
        <p>
          This is the <strong>only paid thing in OpenAdKit, and it can be $0</strong> if you pick a
          free tier. The setup wizard shows all 9 supported providers grouped by{" "}
          <strong className="text-pos">Free</strong> (Groq, Gemini, Cerebras, OpenRouter) and{" "}
          <strong>Paid</strong> (Anthropic Claude, OpenAI GPT, DeepSeek, Mistral, Together AI).
        </p>
        <h3 className="text-base font-medium text-ink mt-4 mb-2">Recommended for first-timers</h3>
        <ul className="list-disc list-inside space-y-2 text-sm text-ink-muted leading-relaxed">
          <li>
            <strong className="text-ink">Groq</strong> (free, fastest) — sign up at{" "}
            <a href="https://console.groq.com" target="_blank" rel="noreferrer" className="text-live underline">console.groq.com</a>,
            copy your API key (starts with <code className="text-[11px]">gsk_…</code>), paste in
            OpenAdKit.
          </li>
          <li>
            <strong className="text-ink">Gemini</strong> (free, great quality) — get a key at{" "}
            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-live underline">aistudio.google.com</a>.
          </li>
          <li>
            <strong className="text-ink">Claude</strong> (best quality, paid) — get a key at{" "}
            <a href="https://console.anthropic.com" target="_blank" rel="noreferrer" className="text-live underline">console.anthropic.com</a>,
            starts with <code className="text-[11px]">sk-ant-…</code>.
          </li>
        </ul>
        <p className="mt-4">
          Click <strong>Verify</strong> — OpenAdKit makes one tiny test call to confirm the key
          works. Pick a model from the dropdown (defaults are sensible). Click{" "}
          <strong>Continue</strong>.
        </p>
        <div className="border border-info/30 bg-info/[0.06] p-3 mt-4 text-[13px] text-info leading-relaxed">
          You can add multiple provider keys and switch between them anytime in{" "}
          <Link href="/settings" className="underline">Settings</Link> — useful when you hit a
          free-tier rate limit. One-click swap to another provider.
        </div>
      </>
    ),
  },
  {
    id: "step-3",
    num: 3,
    title: "Add your first brand",
    duration: "3 minutes",
    body: (
      <>
        <p>
          This is OpenAdKit's killer feature.{" "}
          <strong>You paste one URL, the AI extracts a complete brand profile in 30 seconds.</strong>
        </p>
        <ol className="list-decimal list-inside space-y-2 text-sm text-ink-muted leading-relaxed mt-3">
          <li>
            The setup wizard's last step asks for a website URL. Paste the URL of any brand you want
            to generate ads for — your own brand, a client's, or a competitor's you're studying.
          </li>
          <li>
            Click <strong>Extract</strong>. OpenAdKit reads the homepage plus 2–3 key subpages
            (/about, /pricing, /services), pulls Open Graph data and JSON-LD schema, and asks the AI
            to fill 30+ brand fields:
            <ul className="list-disc list-inside ml-6 mt-1 space-y-0.5 text-[13px]">
              <li>Business name, industry, niche, USP</li>
              <li>Tone, brand voice, words to use / avoid</li>
              <li>Audience: pain points, desires, demographics, service area</li>
              <li>Key benefits, key messages, objection handling</li>
              <li>Competitors, differentiators, price positioning</li>
              <li>VOC quotes, best-performing angles, failed angles</li>
            </ul>
          </li>
          <li>Review the populated Brand Brain. Edit anything that looks off. Hit <strong>Save</strong>.</li>
        </ol>
        <div className="border border-live/30 bg-live/[0.04] p-3 mt-4 text-[13px] text-ink leading-relaxed">
          <strong className="text-live">For agencies:</strong> repeat Step 3 for each client. Switch
          the "active client" from the top-bar dropdown anytime; every generator and optimizer
          automatically uses the active client's Brand Brain to keep voice consistent.
        </div>
      </>
    ),
  },
  {
    id: "step-4",
    num: 4,
    title: "Generate your first ad",
    duration: "1 minute",
    body: (
      <>
        <ol className="list-decimal list-inside space-y-2 text-sm text-ink-muted leading-relaxed">
          <li>
            From the dashboard (cockpit), pick a generator. For your first time, try{" "}
            <strong className="text-ink">Meta · Facebook + Instagram Ads</strong> — fast, visual,
            three angle-distinct variants per click.
          </li>
          <li>
            Fill the form:
            <ul className="list-disc list-inside ml-6 mt-1 space-y-0.5 text-[13px]">
              <li>Objective — sales, leads, awareness</li>
              <li>Format — Feed / Reels / Stories / Carousel</li>
              <li>Product / offer — pre-filled from your Brand Brain</li>
              <li>Promotion — any offer like "20% off" or "free trial"</li>
            </ul>
          </li>
          <li>Click <strong>Generate</strong>. Watch the AI stream the output in real time.</li>
          <li>
            You get <strong>3 variants</strong> anchored to different psychological angles (pain,
            desire, social proof), each with:
            <ul className="list-disc list-inside ml-6 mt-1 space-y-0.5 text-[13px]">
              <li>Primary text (front-loaded for Meta's 125-char mobile preview)</li>
              <li>Headline (≤ 27 chars mobile / ≤ 40 desktop)</li>
              <li>Description</li>
              <li>CTA button suggestion</li>
              <li>Character count validation per field — the schema retry layer catches AI mistakes</li>
              <li>For video formats: hook 0–3s, value 3–15s, CTA 5s with b-roll and on-screen text</li>
            </ul>
          </li>
        </ol>
        <div className="border border-info/30 bg-info/[0.06] p-3 mt-4 text-[13px] text-info leading-relaxed">
          Hit <kbd className="border border-info/40 px-1 py-0.5 text-[11px]">⌘+↵</kbd> (Mac) or{" "}
          <kbd className="border border-info/40 px-1 py-0.5 text-[11px]">Ctrl+↵</kbd> (Windows)
          anywhere in the generator to regenerate without touching the mouse.
        </div>
      </>
    ),
  },
  {
    id: "step-5",
    num: 5,
    title: "Score, optimize, and ship",
    duration: "3–5 minutes",
    body: (
      <>
        <p>You've generated copy. Now use the optimizers to make sure it's actually good.</p>
        <ol className="list-decimal list-inside space-y-2 text-sm text-ink-muted leading-relaxed mt-3">
          <li>
            Copy one of your variants. Open{" "}
            <Link href="/optimize/creative-score" className="text-live underline">
              Optimize → Creative Score
            </Link>{" "}
            from the sidebar.
          </li>
          <li>Paste the ad copy. Pick the platform you wrote it for. Click <strong>Score</strong>.</li>
          <li>
            You get:
            <ul className="list-disc list-inside ml-6 mt-1 space-y-0.5 text-[13px]">
              <li><strong>5-lever score</strong> — hook strength, specificity, urgency, brand fit, conversion potential</li>
              <li><strong>Tier verdict</strong> — scale / iterate / rewrite / kill</li>
              <li><strong>Predicted CTR band</strong> for the platform you chose</li>
              <li><strong>3 named fixes</strong> — each fix names the exact phrase to change and the replacement</li>
            </ul>
          </li>
          <li>
            Apply the fixes. Re-score. Repeat until your tier reads "scale" or "iterate".
          </li>
          <li>
            Optionally run other optimizers before launch:
            <ul className="list-disc list-inside ml-6 mt-1 space-y-0.5 text-[13px]">
              <li><strong>CTR Optimizer</strong> — lever-by-lever rewrites to lift click-through</li>
              <li><strong>Budget Waste</strong> — audit where ad spend is leaking before it does</li>
              <li><strong>Audience Targeting</strong> — turn brand brain + budget into a cold/warm/hot tier plan</li>
              <li><strong>Quality Score</strong> (Google) — surface relevance issues before they tank QS</li>
            </ul>
          </li>
          <li>
            Export the campaign as Markdown or JSON for client handoff via the{" "}
            <Link href="/history" className="text-live underline">History</Link> page.
          </li>
        </ol>
        <div className="border border-live/30 bg-live/[0.04] p-3 mt-4 text-[13px] text-ink leading-relaxed">
          Use <Link href="/launch-guide" className="text-live underline">Launch Guide</Link> in the
          sidebar for step-by-step screenshots walking you through Facebook Ads Manager or Google
          Ads from campaign creation to publish — useful if you're new to paid media.
        </div>
      </>
    ),
  },
];

export default function HowToUsePage() {
  return (
    <article className="max-w-3xl mx-auto py-8 space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(HOW_TO_SCHEMA) }}
      />

      <header className="space-y-3">
        <p className="text-[11px] font-mono uppercase tracking-ui-mega text-live">
          Getting started · ~10 minutes
        </p>
        <h1 className="font-display italic text-5xl text-ink leading-tight">
          How to use OpenAdKit
        </h1>
        <p className="text-lg text-ink-muted leading-relaxed">
          From install to your first AI-generated ad in about 10 minutes. Follow the five steps in
          order — total time is ~10 minutes including the AI provider signup.
        </p>
      </header>

      <nav className="border border-base-700 bg-base-900/30 p-4" aria-label="Step-by-step navigation">
        <p className="text-[11px] font-mono uppercase tracking-ui-mega text-ink-muted mb-2">
          5 steps · jump to one
        </p>
        <ol className="space-y-1.5 text-sm">
          {STEPS.map((s) => (
            <li key={s.id} className="flex items-baseline gap-2">
              <span className="text-live font-mono text-[12px] tabular w-6">{s.num}.</span>
              <a href={`#${s.id}`} className="text-ink hover:text-live transition flex-1">
                {s.title}
              </a>
              <span className="text-[11px] font-mono text-ink-faint">{s.duration}</span>
            </li>
          ))}
        </ol>
      </nav>

      {STEPS.map((s) => (
        <section key={s.id} id={s.id} className="space-y-3 scroll-mt-16">
          <header className="space-y-1 border-b border-base-700 pb-3">
            <p className="text-[11px] font-mono uppercase tracking-ui-mega text-ink-faint">
              Step {s.num} · {s.duration}
            </p>
            <h2 className="font-display italic text-3xl text-ink">{s.title}</h2>
          </header>
          <div className="space-y-3 text-sm text-ink-muted leading-relaxed prose-openadkit">
            {s.body}
          </div>
        </section>
      ))}

      <section className="border-t border-base-700 pt-6 space-y-4">
        <h2 className="font-display italic text-3xl text-ink">What to try next</h2>
        <ul className="space-y-3 text-sm text-ink-muted leading-relaxed">
          <li>
            <strong className="text-ink">
              <Link href="/research/competitors" className="text-live underline hover:no-underline">
                Research → Steal &amp; Beat
              </Link>
            </strong>{" "}
            — paste competitor ads from the Meta Ads Library / Google Transparency Center, get a
            teardown plus 3 beat-their-ad variants.
          </li>
          <li>
            <strong className="text-ink">
              <Link href="/generate/content-calendar" className="text-live underline hover:no-underline">
                Generate → Content Calendar
              </Link>
            </strong>{" "}
            — one click for a per-day social calendar with captions, hashtags, and visual briefs
            across multiple platforms.
          </li>
          <li>
            <strong className="text-ink">
              <Link href="/generate/campaign-kit" className="text-live underline hover:no-underline">
                Generate → Campaign Kit
              </Link>
            </strong>{" "}
            — one brief becomes message-matched copy across Google + Meta + TikTok + LinkedIn +
            YouTube + X + email in a single generation.
          </li>
          <li>
            <strong className="text-ink">
              <Link href="/learn/frameworks" className="text-live underline hover:no-underline">
                Learn → Frameworks Trainer
              </Link>
            </strong>{" "}
            — interactive lessons in PAS, AIDA, BAB, the 4 U's, and the Schwartz awareness ladder.
            Free, ad-free, no signup.
          </li>
          <li>
            <strong className="text-ink">
              <Link href="/launch/wizard" className="text-live underline hover:no-underline">
                Launch Wizard
              </Link>
            </strong>{" "}
            — answer 6 questions about your campaign and get a complete launch kit (copy, audience,
            budget, KPIs) generated in one parallel run.
          </li>
        </ul>
      </section>

      <footer className="border-t border-base-700 pt-6 space-y-2">
        <p className="text-sm text-ink-muted">
          Ready?{" "}
          <Link href="/setup" className="text-live underline">
            Start the setup wizard
          </Link>{" "}
          or read the{" "}
          <Link href="/alternatives" className="text-live underline">
            comparison vs Jasper, AdCreative, Anyword
          </Link>
          .
        </p>
        <p className="text-[11px] font-mono uppercase tracking-ui-wide text-ink-faint">
          Last updated: May 2026 · Built by{" "}
          <a href="https://dicecodes.com" target="_blank" rel="noreferrer" className="hover:text-live">
            Dicecodes
          </a>
        </p>
      </footer>
    </article>
  );
}
