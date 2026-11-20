"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Check, Copy, IndianRupee } from "lucide-react";
import { MAINTAINER, UPI_AMOUNTS, upiDeepLink, upiNote } from "@/lib/maintainer";

/**
 * Pick an amount, scan the QR (or tap "Open in UPI app" on a phone), pay.
 * The QR is drawn locally — the deep link contains the payee and amount, and
 * sending that to a third-party QR service would be odd for a privacy-first
 * tool.
 */
export function UpiPanel() {
  const [amount, setAmount] = useState<number | null>(250);
  const [custom, setCustom] = useState("");
  const [name, setName] = useState("");
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState(false);

  const effective = custom.trim() ? Number(custom.replace(/[^\d]/g, "")) || null : amount;
  const link = upiDeepLink({ amount: effective, note: upiNote(name) });

  useEffect(() => {
    if (!link) return;
    let cancelled = false;
    QRCode.toDataURL(link, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 240,
      color: { dark: "#0a0a0a", light: "#ffffff" },
    })
      .then((url) => {
        if (!cancelled) setQr(url);
      })
      .catch(() => {
        if (!cancelled) setQr("");
      });
    return () => {
      cancelled = true;
    };
  }, [link]);

  if (!MAINTAINER.upi) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(MAINTAINER.upi);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked — the ID is visible to copy by hand */
    }
  };

  return (
    <div className="grid gap-5 md:grid-cols-[240px_1fr] items-start">
      <div className="bg-white p-2 w-[240px] h-[240px] grid place-items-center">
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} width={224} height={224} alt={`UPI QR code to pay ${MAINTAINER.name}`} />
        ) : (
          <span className="text-xs text-neutral-500">Drawing QR…</span>
        )}
      </div>
      <div className="space-y-4">
        <div>
          <div className="label">Amount (₹)</div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Amount">
            {UPI_AMOUNTS.map((a) => (
              <button
                key={a}
                type="button"
                aria-pressed={!custom && amount === a}
                onClick={() => {
                  setAmount(a);
                  setCustom("");
                }}
                className={!custom && amount === a ? "btn-primary" : "btn-ghost"}
              >
                ₹{a}
              </button>
            ))}
            <button
              type="button"
              aria-pressed={!custom && amount === null}
              onClick={() => {
                setAmount(null);
                setCustom("");
              }}
              className={!custom && amount === null ? "btn-primary" : "btn-ghost"}
            >
              Any amount
            </button>
          </div>
          <input
            className="input-base mt-2 max-w-[200px]"
            inputMode="numeric"
            placeholder="Other amount"
            aria-label="Other amount in rupees"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="upi-name">
            Your name or business (optional)
          </label>
          <input
            id="upi-name"
            className="input-base max-w-sm"
            placeholder="So DiceCodes can say thanks"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a href={link} className="btn-primary">
            <IndianRupee size={12} /> Open in UPI app
          </a>
          <button type="button" onClick={copy} className="btn-ghost normal-case tracking-normal" aria-label={`Copy UPI ID ${MAINTAINER.upi}`}>
            {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? "Copied" : MAINTAINER.upi}
          </button>
        </div>
        <p className="text-xs text-ink-subtle">
          Works with GPay, PhonePe, Paytm and BHIM. Zero fees, instant. Nothing is unlocked by paying — the
          software is the same for everyone.
        </p>
      </div>
    </div>
  );
}
