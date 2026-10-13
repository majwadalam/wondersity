"use client";

import { Check, Download, Link2, Printer } from "lucide-react";
import { useState } from "react";
import { copyText } from "../copyText";
import type { CertificateView } from "./CertificateCard";

/**
 * Sharing a certificate: straight onto a LinkedIn profile (Licenses &
 * certifications), as a post on LinkedIn, X, Facebook or WhatsApp, by link, as
 * an image or as a PDF (the browser's print dialog).
 */
export function ShareCertificate({ c, url, imageUrl }: { c: CertificateView; url: string; imageUrl: string }) {
  const [copied, setCopied] = useState(false);
  const done = new Date(c.completedAt);
  const text = `I completed "${c.courseTitle}" on Wondersity: ${c.lessons} interactive lessons.`;
  const enc = encodeURIComponent;
  const addToProfile =
    "https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME" +
    `&name=${enc(c.courseTitle)}&organizationName=Wondersity&issueYear=${done.getUTCFullYear()}&issueMonth=${done.getUTCMonth() + 1}` +
    `&certUrl=${enc(url)}&certId=${enc(c.id)}`;
  const links = [
    { label: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}` },
    { label: "X", href: `https://x.com/intent/post?text=${enc(text)}&url=${enc(url)}` },
    { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}` },
    { label: "WhatsApp", href: `https://wa.me/?text=${enc(`${text} ${url}`)}` },
  ];

  return (
    <section className="certificate-share shadow-card h-full rounded-3xl bg-white p-5 sm:p-6" aria-label="Share this certificate">
      <h2 className="text-[15px] font-semibold text-fg">Share it</h2>
      <a href={addToProfile} target="_blank" rel="noopener noreferrer" className="btn-pill btn-pill-accent mt-4 w-full justify-center">
        Add to your LinkedIn profile
      </a>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {links.map((l) => (
          <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" className="rounded-xl px-3 py-2.5 text-center text-sm font-medium text-fg ring-1 ring-line transition-colors hover:bg-canvas">
            {l.label}
          </a>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={async () => {
            if (await copyText(url)) {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }
          }}
          className="flex items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-sm font-medium whitespace-nowrap text-fg ring-1 ring-line hover:bg-canvas"
        >
          {copied ? <Check size={15} className="flex-shrink-0 text-good" /> : <Link2 size={15} className="flex-shrink-0" />} {copied ? "Copied" : "Copy link"}
        </button>
        <a href={imageUrl} download={`wondersity-certificate-${c.id}.png`} className="flex items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-sm font-medium whitespace-nowrap text-fg ring-1 ring-line hover:bg-canvas">
          <Download size={15} className="flex-shrink-0" /> Image
        </a>
        <button type="button" onClick={() => window.print()} className="flex items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-sm font-medium whitespace-nowrap text-fg ring-1 ring-line hover:bg-canvas">
          <Printer size={15} className="flex-shrink-0" /> PDF
        </button>
      </div>
    </section>
  );
}
