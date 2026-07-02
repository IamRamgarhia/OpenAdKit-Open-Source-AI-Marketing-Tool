import type { Metadata, Viewport } from "next";
import { Manrope, JetBrains_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";
import { StatusBar } from "@/components/StatusBar";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { CommandPalette } from "@/components/CommandPalette";
import { UndoToast } from "@/components/UndoToast";
import { LocalSyncBoot } from "@/components/LocalSyncBoot";

const sans = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});
const display = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
  display: "swap",
});

// OG description tuned for click-through: leads with the competitor anchor
// ($49–499/mo replaces what?) + the BYOK promise + the license. Keeps under
// 160 chars for safe Twitter/Facebook truncation.
const SEO_DESCRIPTION =
  "Free open-source alternative to Jasper, AdCreative & Anyword. 18 AI ad generators, 9 providers (BYOK), browser-only, zero subscriptions. MIT-licensed.";

export const metadata: Metadata = {
  metadataBase: new URL("https://openadkit.dicecodes.com"),
  title: {
    default: "OpenAdKit — Open Source AI Marketing Tool · BYOK · Free Forever",
    template: "%s · OpenAdKit",
  },
  description: SEO_DESCRIPTION,
  applicationName: "OpenAdKit",
  manifest: "/manifest.webmanifest",
  keywords: [
    "open source AI marketing tool",
    "free AI ad generator",
    "Jasper alternative",
    "AdCreative alternative",
    "Anyword alternative",
    "Copy.ai alternative",
    "BYOK AI marketing",
    "AI ad copy generator",
    "Google Ads AI",
    "Meta Ads AI",
    "TikTok Ads AI",
    "free AI copywriting",
  ],
  authors: [{ name: "Dicecodes", url: "https://dicecodes.com" }],
  creator: "Dicecodes",
  publisher: "Dicecodes",
  category: "marketing",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
    apple: "/icon.svg",
  },
  openGraph: {
    title: "OpenAdKit — Open Source AI Marketing Tool",
    description: SEO_DESCRIPTION,
    url: "/",
    siteName: "OpenAdKit",
    type: "website",
    // 1200×630 PNG works on every OG consumer including Facebook (which
    // rejects SVG). public/og-image.svg is the source; CI step should
    // export to og-image.png at build time. We list both so SVG-capable
    // clients (Twitter, LinkedIn, Slack) get the crisp version.
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "OpenAdKit — free open-source alternative to Jasper, AdCreative, Anyword. 18 AI ad generators across every platform. BYOK, browser-only.",
        type: "image/png",
      },
      {
        url: "/og-image.svg",
        width: 1200,
        height: 630,
        alt: "OpenAdKit — free open-source AI marketing tool",
        type: "image/svg+xml",
      },
    ],
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "OpenAdKit — Open Source AI Marketing Tool",
    description: SEO_DESCRIPTION,
    images: ["/og-image.png"],
    creator: "@dicecodes",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  // NOTE: no blanket `alternates.canonical` here. App Router inherits root
  // metadata onto every sub-page, so a fixed canonical:"/" would make every
  // route declare itself a duplicate of the homepage (defeating app/sitemap.ts).
  // Each route self-canonicalizes against `metadataBase` instead; per-page
  // canonicals can still be set in that page's own `metadata.alternates`.
};

// JSON-LD structured data. Three blocks emitted inline in the <head>:
//   1. SoftwareApplication — surfaces in Google rich-results + AI Overviews
//      when users search "free AI marketing tools" or "Jasper alternative"
//   2. Organization — establishes Dicecodes as the publisher (E-E-A-T)
//   3. FAQPage — mirrors the README FAQ so AI Overviews / Perplexity /
//      ChatGPT browse can cite passage-level answers directly
//
// Kept in app/layout.tsx (not a separate <Script>) so the JSON-LD lives in
// the initial server-rendered HTML and is visible to crawlers that don't
// execute JavaScript.
const STRUCTURED_DATA = {
  software: {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "OpenAdKit",
    applicationCategory: "BusinessApplication",
    applicationSubCategory: "Marketing",
    operatingSystem: "Web Browser, Windows, macOS, Linux",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
    },
    url: "https://openadkit.dicecodes.com",
    sameAs: ["https://github.com/IamRamgarhia/AdForge"],
    license: "https://opensource.org/licenses/MIT",
    softwareVersion: "0.1.0",
    description: SEO_DESCRIPTION,
    featureList: [
      "18 AI ad copy generators across Google, Meta, TikTok, LinkedIn, YouTube, X",
      "11 ad optimizers — creative score, CTR optimizer, budget waste audit, ad fatigue, quality score",
      "9 AI providers supported (BYOK): Claude, GPT, Gemini, Groq, Cerebras, OpenRouter, Together, DeepSeek, Mistral",
      "Multi-client brand brain auto-extracted from any URL",
      "Batch mode for agencies (same asset across many clients)",
      "Browser-only — no backend, no accounts, no telemetry",
      "Self-hostable or deploy to Vercel/Cloudflare in one click",
    ],
    author: {
      "@type": "Organization",
      name: "Dicecodes",
      url: "https://dicecodes.com",
    },
  },
  organization: {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Dicecodes",
    url: "https://dicecodes.com",
    logo: "https://openadkit.dicecodes.com/icon.svg",
    sameAs: ["https://github.com/IamRamgarhia"],
  },
  faq: {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Is OpenAdKit really free?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes — $0/month, forever. MIT-licensed. The only cost is your own AI provider API key, and that can be a free tier (Groq, Gemini, Cerebras, OpenRouter) or paid (Claude, GPT, Mistral, DeepSeek). OpenAdKit itself bills you nothing.",
        },
      },
      {
        "@type": "Question",
        name: "Do I need to install anything?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "No. Deploy to Vercel or Cloudflare in 30 seconds with a one-click button — you get your own URL, no install required, works on any device including mobile. Or install locally for offline use via the bundled .bat / .command launcher (Node.js 20+ required for local install).",
        },
      },
      {
        "@type": "Question",
        name: "Where does my data live?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "100% in your own browser (IndexedDB) and, when running locally, in a data/snapshot.json file inside the OpenAdKit folder. No accounts, no cloud sync, no telemetry. Your AI API keys never leave the browser — every LLM call goes from your browser directly to the provider.",
        },
      },
      {
        "@type": "Question",
        name: "Which AI providers does OpenAdKit support?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "9 providers: Anthropic Claude, OpenAI GPT, Google Gemini, Groq, Cerebras, OpenRouter, Together AI, DeepSeek, and Mistral. Free tiers are available on Groq, Gemini, Cerebras, and OpenRouter — you can run the entire tool at $0 cost using only free-tier LLM keys.",
        },
      },
      {
        "@type": "Question",
        name: "How is OpenAdKit different from Jasper, AdCreative, or Anyword?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "OpenAdKit replaces a $49–$499/month stack with one MIT-licensed app that runs entirely in your browser. Bring your own AI key (free or paid), get every paid-tool feature — 18 ad generators, 11 optimizers, multi-client brand brains, batch mode, competitor research — for $0/month. No accounts, no per-seat upcharges, no vendor lock-in.",
        },
      },
      {
        "@type": "Question",
        name: "Does OpenAdKit generate AI images or videos?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Not in-app. OpenAdKit generates the creative briefs and prompts (ready to paste into Midjourney, DALL-E, Runway, Pika, or other AI image/video tools) plus a directory of recommended free + paid AI tools per use case. The text generators cover ad copy, hooks, hashtags, scripts, captions, email subjects, and landing-page copy across every major platform.",
        },
      },
      {
        "@type": "Question",
        name: "Can agencies use OpenAdKit for multiple clients?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes — the multi-client Brand Brain system stores a separate brand profile per client (auto-extracted from each client's website URL), and Batch Mode generates the same asset across multiple clients in one parallel run. Markdown/PDF campaign export is built in for client handoff. No per-seat or per-client fees.",
        },
      },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#08080a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${sans.variable} ${mono.variable} ${display.variable}`}>
      <head>
        {/* Three JSON-LD blocks for AI Overviews + Perplexity + ChatGPT
            browse + Google rich results. Server-rendered so crawlers that
            don't execute JS still see them. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA.software) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA.organization) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA.faq) }}
        />
      </head>
      <body className="font-sans antialiased">
        {/* Skip-to-content for keyboard + screen-reader users — visually
            hidden until focused, then jumps past the sidebar / mobile nav. */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:bg-base-900 focus:text-ink focus:px-3 focus:py-2 focus:border focus:border-live"
        >
          Skip to main content
        </a>
        <div className="flex min-h-screen">
          <Sidebar />
          <MobileNav />
          <ServiceWorkerRegister />
          <LocalSyncBoot />
          <CommandPalette />
          <UndoToast />
          <main id="main-content" className="flex-1 min-w-0 flex flex-col">
            <div className="flex-1 px-4 md:px-10 pt-14 md:pt-6 pb-14">{children}</div>
            <StatusBar />
          </main>
        </div>
      </body>
    </html>
  );
}
