"use client";

import Link from "next/link";
import { Globe, Mail, MessageCircle, Phone, ExternalLink, Sparkles, Code2, Palette, Search as SearchIcon, ShoppingCart, Smartphone, Megaphone } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

const SERVICES = [
  { icon: Code2, title: "Website Development", body: "WordPress, Shopify, fully custom. SEO-ready, fast, secure, optimized for conversion + UX." },
  { icon: Smartphone, title: "Mobile App Development", body: "Flutter for iOS + Android — one codebase, native-feel apps." },
  { icon: Palette, title: "UI/UX Design", body: "Distinctive design systems that don't look like every other AI-generated dashboard." },
  { icon: SearchIcon, title: "SEO Services", body: "Technical + content SEO that actually moves rankings + organic traffic." },
  { icon: Megaphone, title: "Digital Marketing", body: "Social, PPC, paid acquisition — backed by the same playbooks baked into OpenAdKit." },
  { icon: ShoppingCart, title: "E-commerce Solutions", body: "Shopify + custom storefronts engineered for conversion." },
];

export default function AboutPage() {
  return (
    <div>
      <PageHeader scope="about" title="About OpenAdKit" subtitle="Built by Dicecodes. Open source. Browser-only. BYOK." />

      <div className="space-y-8 stagger">
        <section className="border border-live/40 bg-live/5 p-6">
          <div className="text-[10px] font-mono uppercase tracking-ui-mega text-live mb-2">made by</div>
          <h2 className="font-display italic text-5xl text-ink leading-tight">Dicecodes</h2>
          <p className="font-display italic text-lg text-ink-muted mt-2">Transforming Vision into Virtual Reality — Your Digital Dream Team.</p>
          <p className="text-sm text-ink mt-5 leading-relaxed max-w-2xl">
            Dicecodes is a digital studio that combines creative design with advanced technology to deliver measurable
            business growth. OpenAdKit is one of our open-source releases — the same ad-strategy + creative engine we use
            internally for client work, packaged so anyone with a Claude / Gemini / Groq key can use it for free.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <a href="https://dicecodes.com" target="_blank" rel="noreferrer" className="btn-primary">
              <Globe size={11} /> dicecodes.com <ExternalLink size={10} />
            </a>
            <a href="mailto:Contact@dicecodes.com" className="btn-ghost">
              <Mail size={11} /> Contact@dicecodes.com
            </a>
            <a href="tel:+919888404991" className="btn-ghost">
              <Phone size={11} /> +91 98884 04991
            </a>
            <a href="https://wa.me/919888404991" target="_blank" rel="noreferrer" className="btn-ghost">
              <MessageCircle size={11} /> WhatsApp
            </a>
          </div>
        </section>

        <section>
          <h3 className="font-display italic text-3xl text-ink leading-tight">Need custom SaaS or web work?</h3>
          <p className="text-sm text-ink-muted mt-2 max-w-2xl leading-relaxed">
            OpenAdKit is free + MIT-licensed. But if you need a tailored version — a private fork with your data integrations,
            a white-labeled agency edition, or something we haven&apos;t built yet — Dicecodes builds that.
          </p>
          <div className="grid md:grid-cols-3 gap-3 mt-6">
            {SERVICES.map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.title} className="border border-base-600 bg-base-900/40 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon size={14} className="text-live" />
                    <span className="text-sm font-medium text-ink">{s.title}</span>
                  </div>
                  <p className="text-xs text-ink-muted leading-relaxed">{s.body}</p>
                </div>
              );
            })}
          </div>
          <div className="mt-6">
            <a href="https://dicecodes.com" target="_blank" rel="noreferrer" className="btn-primary">
              <Sparkles size={11} /> Get your SaaS built by Dicecodes <ExternalLink size={10} />
            </a>
          </div>
        </section>

        <section className="border border-base-600 bg-base-900/40 p-6">
          <h3 className="font-display italic text-2xl text-ink mb-3">Why we open-sourced OpenAdKit</h3>
          <p className="text-sm text-ink leading-relaxed">
            We were tired of watching small teams burn $500-2,000/month on stacks of AI marketing tools — Jasper +
            AdCreative + Anyword + Pencil — when one good Claude prompt does the same job. So we built the prompts,
            wrapped them in an interface our own agency uses, and shipped it as MIT so anyone can self-host.
          </p>
          <p className="text-sm text-ink leading-relaxed mt-3">
            We make money from custom builds, not from the tool itself. OpenAdKit will always be free.
          </p>
        </section>

        <section className="border border-base-600 bg-base-900/40 p-6">
          <h3 className="font-display italic text-2xl text-ink mb-3">What&apos;s in OpenAdKit today</h3>
          <ul className="grid md:grid-cols-2 gap-x-6 gap-y-1 text-sm text-ink-muted">
            <li>○ 18 AI generators (Google, Meta, TikTok, YouTube, LinkedIn, X, Display, hashtags, lead forms, email subjects, AI image/video prompts, social content calendar)</li>
            <li>○ 11 optimization tools (CTR, Quality Score, Budget Waste, Bid Strategy, Ad Fatigue, more)</li>
            <li>○ Competitor research (Meta Ads Library + Google Transparency + TikTok Top Ads)</li>
            <li>○ Brand Brain — auto-extracted from a website URL via Jina Reader</li>
            <li>○ 9 AI providers supported (Claude, OpenAI, Gemini, Groq, Cerebras, OpenRouter, Together, DeepSeek, Mistral)</li>
            <li>○ Daily / weekly / monthly routines with streak counters</li>
            <li>○ 28 mini-course lessons + concept library + interactive framework trainer</li>
            <li>○ Industry benchmarks, cost-saver references, decision trees</li>
            <li>○ Browser-only, BYOK, zero backend, zero telemetry</li>
          </ul>
        </section>

        <section className="border border-base-600 bg-base-900/40 p-6">
          <h3 className="font-display italic text-2xl text-ink mb-3">Built on the shoulders of open source</h3>
          <p className="text-sm text-ink-muted leading-relaxed">
            OpenAdKit prompts borrow patterns (with attribution) from:
            <Link href="https://github.com/coreyhaines31/marketingskills" className="text-live hover:underline ml-1">marketingskills</Link>,
            <Link href="https://github.com/AgriciDaniel/claude-ads" className="text-live hover:underline ml-1">claude-ads</Link>,
            <Link href="https://github.com/google-marketing-solutions/copycat" className="text-live hover:underline ml-1">Copycat</Link>,
            <Link href="https://github.com/nowork-studio/toprank" className="text-live hover:underline ml-1">toprank</Link>.
            See <a href="https://github.com/IamRamgarhia/OpenAdKit-Open-Source-AI-Marketing-Tool/blob/main/NOTICE.md" target="_blank" rel="noreferrer" className="text-live hover:underline">NOTICE.md</a> in the repo for full attribution.
          </p>
        </section>

        <section className="text-center py-8 text-[10px] font-mono uppercase tracking-ui-mega text-ink-faint">
          OpenAdKit · MIT-licensed · Built by Dicecodes · {new Date().getFullYear()}
        </section>
      </div>
    </div>
  );
}
