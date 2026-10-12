import type { ReactNode } from "react";
import { MarketingFooter } from "@/components/app/AppShell";

// Shared layout and typography for the privacy and terms pages.

export function LegalPage({ title, intro, children }: { title: string; intro: ReactNode; children: ReactNode }) {
  return (
    <>
      <main className="bg-white">
        <article className="mx-auto max-w-2xl px-4 pt-16 pb-24 sm:px-6 sm:pt-20">
          <p className="text-sm font-semibold text-accent">Legal</p>
          <h1 className="display-xl mt-3 text-[40px] text-fg sm:text-[48px]">{title}</h1>
          <p className="mt-4 text-sm text-muted">Last updated: October 11, 2026</p>
          <div className="mt-8 border-t border-line pt-8 text-[16px] leading-[1.75] text-muted">{intro}</div>
          <div className="mt-2">{children}</div>
        </article>
      </main>
      <MarketingFooter />
    </>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-fg">{title}</h2>
      <div className="mt-3 space-y-4 text-[16px] leading-[1.75] text-muted [&_strong]:font-medium [&_strong]:text-fg">{children}</div>
    </section>
  );
}

export function LegalList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-2 pl-5">
      {items.map((item, i) => (
        <li key={i} className="list-disc marker:text-line-strong">
          {item}
        </li>
      ))}
    </ul>
  );
}

export function Mail() {
  return (
    <a href="mailto:techpotionshq@gmail.com" className="font-medium text-accent break-all hover:text-accent-strong">
      techpotionshq@gmail.com
    </a>
  );
}
