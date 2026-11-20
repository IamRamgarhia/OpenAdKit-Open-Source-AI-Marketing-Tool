"use client";

import {
  Heart,
  Star,
  Share2,
  Bug,
  Globe,
  Mail,
  ExternalLink,
  Code2,
  Wrench,
  Bot,
  Workflow,
  Smartphone,
  LifeBuoy,
  CreditCard,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { UpiPanel } from "@/components/support/UpiPanel";
import { MAINTAINER, enquiryMailto, whatsappShareUrl } from "@/lib/maintainer";
import { REPO_URL, REPO_NEW_ISSUE_URL } from "@/lib/repo";

const SERVICES = [
  { icon: Code2, title: "Custom software & web apps", body: "Dashboards, portals and SaaS products, built end to end." },
  { icon: Wrench, title: "Customising OpenAdKit", body: "Your own fork: private integrations, agency white-label, new generators." },
  { icon: Bot, title: "AI integration", body: "Put Claude, GPT or Gemini to work inside the tools your team already uses." },
  { icon: Workflow, title: "AI automation", body: "Reporting, content and ad-ops workflows that run themselves." },
  { icon: Smartphone, title: "Mobile apps", body: "iOS and Android from one codebase." },
  { icon: LifeBuoy, title: "Setup & support plans", body: "Installation, training and a direct line when something breaks." },
];

export function SupportClient() {
  return (
    <div>
      <PageHeader
        scope="support"
        title="Support & about"
        subtitle="Who builds OpenAdKit, what it stands for, and how to help."
      />

      <div className="space-y-8 stagger">
        <section className="border border-live/40 bg-live/5 p-6">
          <div className="flex items-start gap-3">
            <Heart size={20} className="text-live shrink-0 mt-1" />
            <div>
              <h2 className="font-display italic text-3xl text-ink leading-tight">Free, and it stays free</h2>
              <p className="text-sm text-ink mt-3 leading-relaxed max-w-2xl">
                OpenAdKit is built and maintained by{" "}
                <a href={MAINTAINER.website} target="_blank" rel="noreferrer" className="text-live hover:underline">
                  {MAINTAINER.name}
                </a>{" "}
                in India. No ads, no account, no locked features, and your keys and client data never leave your
                computer. If it saves you a subscription or two, you can help keep the fixes and new features coming.
              </p>
            </div>
          </div>
        </section>

        {MAINTAINER.upi ? (
          <section className="border border-base-600 bg-base-900/40 p-6">
            <h3 className="font-display italic text-2xl text-ink mb-1">Support with UPI</h3>
            <p className="text-xs text-ink-muted mb-5">Scan with any UPI app, or open it directly on your phone.</p>
            <UpiPanel />
          </section>
        ) : null}

        {MAINTAINER.paypal ? (
          <section className="border border-base-600 bg-base-900/40 p-6">
            <h3 className="font-display italic text-2xl text-ink mb-1">Outside India?</h3>
            <p className="text-sm text-ink-muted mb-4 max-w-2xl">
              Cards, PayPal balance or bank. Nothing here is a licence fee — the software is yours either way.
            </p>
            <a href={MAINTAINER.paypal} target="_blank" rel="noreferrer" className="btn-primary">
              <CreditCard size={12} /> Donate via PayPal <ExternalLink size={10} />
            </a>
          </section>
        ) : null}

        <section>
          <h3 className="font-display italic text-2xl text-ink mb-4">Help without paying</h3>
          <div className="grid md:grid-cols-3 gap-3">
            <a href={REPO_URL} target="_blank" rel="noreferrer" className="border border-base-600 bg-base-900/40 p-4 hover:border-live/50 transition block">
              <div className="flex items-center gap-2 mb-2 text-sm font-medium text-ink">
                <Star size={14} className="text-live" /> Star it on GitHub
              </div>
              <p className="text-xs text-ink-muted">One click. It is how other marketers find free tools.</p>
            </a>
            <a href={whatsappShareUrl()} target="_blank" rel="noreferrer" className="border border-base-600 bg-base-900/40 p-4 hover:border-live/50 transition block">
              <div className="flex items-center gap-2 mb-2 text-sm font-medium text-ink">
                <Share2 size={14} className="text-live" /> Tell another marketer
              </div>
              <p className="text-xs text-ink-muted">Share it on WhatsApp with someone paying for Jasper or AdCreative.</p>
            </a>
            <a href={REPO_NEW_ISSUE_URL} target="_blank" rel="noreferrer" className="border border-base-600 bg-base-900/40 p-4 hover:border-live/50 transition block">
              <div className="flex items-center gap-2 mb-2 text-sm font-medium text-ink">
                <Bug size={14} className="text-live" /> Report a bug or ask for a feature
              </div>
              <p className="text-xs text-ink-muted">Every report gets read. Screenshots help.</p>
            </a>
          </div>
        </section>

        <section>
          <h3 className="font-display italic text-3xl text-ink leading-tight">Work with {MAINTAINER.name}</h3>
          <p className="text-sm text-ink-muted mt-2 max-w-2xl leading-relaxed">
            The team behind OpenAdKit builds software for businesses too.
          </p>
          <div className="grid md:grid-cols-3 gap-3 mt-5">
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
          <div className="mt-6 flex flex-wrap gap-2">
            <a href={enquiryMailto()} className="btn-primary">
              <Mail size={12} /> {MAINTAINER.contactEmail}
            </a>
            <a href={MAINTAINER.website} target="_blank" rel="noreferrer" className="btn-ghost">
              <Globe size={12} /> dicecodes.com <ExternalLink size={10} />
            </a>
          </div>
        </section>

        <section className="text-center py-8 text-[10px] font-mono uppercase tracking-ui-mega text-ink-faint">
          OpenAdKit · MIT-licensed · Built by {MAINTAINER.name} · Made in India
        </section>
      </div>
    </div>
  );
}
