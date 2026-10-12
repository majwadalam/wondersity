import type { Metadata } from "next";
import Link from "next/link";
import { Check, Clock, Plus } from "lucide-react";
import { MarketingFooter } from "@/components/app/AppShell";
import { CheckoutButton } from "@/components/billing/CheckoutButton";
import { HoverArrow } from "@/components/landing/HoverArrow";
import {
  FREE_COURSES_PER_WINDOW,
  FREE_LESSONS_PER_COURSE,
  PAID_LESSONS_PER_WINDOW,
  PAINTED_LESSONS_PER_WINDOW,
  PRICES,
  WINDOW_DAYS,
  billingEnabled,
} from "@/lib/plans";

export const metadata: Metadata = {
  title: "Pricing — Wondersity",
  description: "Wondersity's plans: a free plan, and Pro at $19.99 a month or $119.99 a year.",
};

const FREE_FEATURES = [
  `The first ${FREE_LESSONS_PER_COURSE} lessons of any course`,
  `${FREE_COURSES_PER_WINDOW} new courses every ${WINDOW_DAYS} days`,
  "Interactive lessons, checked for facts before you see them",
  "A guide who speaks each step aloud",
  "Progress and streaks",
];

const PRO_FEATURES = [
  "Every lesson of every course",
  "Start as many courses as you like",
  `Up to ${PAID_LESSONS_PER_WINDOW} new lessons every ${WINDOW_DAYS} days (about 2 a day)`,
  `Painted scenes for ${PAINTED_LESSONS_PER_WINDOW} lessons every ${WINDOW_DAYS} days`,
  "Lessons that adapt to what you got wrong",
  "Cancel any time in Settings",
];

// Shown while billing isn't switched on yet (the beta).
const BETA_FREE_FEATURES = [
  "Unlimited courses on any topic during the beta",
  "Short interactive lessons with painted scenes",
  "A guide who speaks each step aloud",
  "Progress and streaks",
  "Sign in with email or Google",
];

const FAQ = (live: boolean): [string, string][] => [
  live
    ? [
        "What does the free plan include?",
        `Plan a course on any topic and take its first ${FREE_LESSONS_PER_COURSE} lessons, for up to ${FREE_COURSES_PER_WINDOW} new courses every ${WINDOW_DAYS} days. No card needed.`,
      ]
    : [
        "Is it really free?",
        "Yes. Everything costs nothing while Wondersity is in beta. Paid plans will cost $19.99 a month or $119.99 a year; we'll say so well before they start, and nothing is charged unless you choose a plan.",
      ],
  [
    "What counts as a course?",
    "A course is one topic you name, like “the French Revolution” or “how compilers work”. Wondersity plans it as a few levels of short lessons and writes each one as you reach it.",
  ],
  [
    "Who handles payment?",
    "Paddle, our reseller and merchant of record, handles checkout, card details, receipts and sales tax. Wondersity never sees your card.",
  ],
  [
    "Is Pro unlimited?",
    `Almost. Pro opens every lesson of every course, up to ${PAID_LESSONS_PER_WINDOW} new lessons every ${WINDOW_DAYS} days, about two a day, which is more than most people take. Going back to a lesson you've already started is always free.`,
  ],
  [
    "Can I cancel?",
    "Yes, any time from Settings → Manage billing. Your plan keeps working until the end of the period you paid for.",
  ],
  [
    "Can I delete my data?",
    "Yes. In Settings, “Delete your data” removes every course, lesson, answer and setting at once. It can't be undone.",
  ],
];

export default function PricingPage() {
  const live = billingEnabled();
  return (
    <>
      <main className="relative overflow-hidden bg-canvas">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-48 left-1/2 h-[520px] w-[1000px] max-w-[200vw] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(99,91,255,0.14),transparent)]"
        />

        <section className="relative mx-auto max-w-6xl px-4 pt-16 pb-12 text-center sm:px-6 sm:pt-24">
          <p className="text-sm font-semibold text-accent">Pricing</p>
          <h1 className="display-xl mx-auto mt-3 max-w-2xl text-[40px] text-fg sm:text-[56px]">
            {live ? "Start free. Go further with Pro." : "Free while we\u2019re in beta"}
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-[17px] leading-relaxed text-muted">
            {live
              ? "Try the first lessons of any course for free. Pro opens every lesson of every course, for less than one course on most sites."
              : "Learn anything, at your own pace, without paying a thing. A paid plan is on the way, and we\u2019ll be clear about it before it arrives."}
          </p>
        </section>

        <section className="relative mx-auto grid max-w-4xl gap-6 px-4 pb-20 sm:px-6 md:grid-cols-2">
          {/* Free */}
          <div className={`relative flex flex-col rounded-2xl bg-white p-7 ring-1 ring-line sm:p-8 ${live ? "" : "shadow-[var(--shadow-lg)]"}`}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-fg">Free</h2>
              {!live && <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent-strong">Beta · available now</span>}
            </div>
            <p className="mt-6 flex items-baseline gap-1.5">
              <span className="display-xl text-[52px] text-fg">$0</span>
              <span className="text-[15px] text-muted">{live ? "no card needed" : "during the beta"}</span>
            </p>
            <p className="mt-2 text-[15px] text-muted">{live ? "See how Wondersity teaches before you pay." : "Everything Wondersity does today, with no limits on courses."}</p>
            <Link href="/login?mode=signup" className={`btn-pill mt-7 justify-center py-3 ${live ? "btn-secondary" : "btn-pill-accent"}`}>
              Start free <HoverArrow />
            </Link>
            <FeatureList items={live ? FREE_FEATURES : BETA_FREE_FEATURES} />
          </div>

          {/* Pro */}
          {live ? (
            <div className="relative flex flex-col rounded-2xl bg-white p-7 shadow-[var(--shadow-lg)] ring-2 ring-accent sm:p-8">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-fg">Pro</h2>
                <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent-strong">Best value yearly</span>
              </div>
              <p className="mt-6 flex items-baseline gap-1.5">
                <span className="display-xl text-[52px] text-fg">{PRICES.yearly.monthly}</span>
                <span className="text-[15px] text-muted">a month, billed {PRICES.yearly.label} yearly</span>
              </p>
              <p className="mt-2 text-[15px] text-muted">
                Or {PRICES.monthly.label} billed monthly. Prices in US dollars; tax added where it applies.
              </p>
              <CheckoutButton
                priceId={process.env.NEXT_PUBLIC_PADDLE_PRICE_YEARLY ?? ""}
                label={`Get Pro yearly · ${PRICES.yearly.label}`}
                className="btn-pill btn-pill-accent mt-7 w-full justify-center py-3"
              />
              <CheckoutButton
                priceId={process.env.NEXT_PUBLIC_PADDLE_PRICE_MONTHLY ?? ""}
                label={`Monthly · ${PRICES.monthly.label}`}
                className="btn-pill btn-secondary mt-3 w-full justify-center py-3"
              />
              <FeatureList items={PRO_FEATURES} />
            </div>
          ) : (
            <div className="flex flex-col rounded-2xl bg-white/70 p-7 ring-1 ring-line sm:p-8">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-fg">Pro</h2>
                <span className="rounded-full bg-canvas px-2.5 py-1 text-xs font-semibold text-muted ring-1 ring-line">Planned</span>
              </div>
              <p className="mt-6 flex items-baseline gap-1.5">
                <span className="display-xl text-[52px] text-fg">{PRICES.monthly.label}</span>
                <span className="text-[15px] text-muted">a month, planned</span>
              </p>
              <p className="mt-2 text-[15px] text-muted">
                Or {PRICES.yearly.label} a year ({PRICES.yearly.monthly} a month). Nothing is charged during the beta.
              </p>
              <span aria-disabled="true" className="btn-pill mt-7 cursor-not-allowed justify-center bg-canvas py-3 text-muted ring-1 ring-line">
                <Clock className="h-4 w-4" aria-hidden /> Coming soon
              </span>
              <FeatureList items={PRO_FEATURES} muted />
            </div>
          )}
        </section>
      </main>

      <section className="border-t border-line bg-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 md:grid-cols-[1fr_1.6fr]">
          <div>
            <h2 className="display-xl text-[32px] text-fg">Questions</h2>
            <p className="mt-3 max-w-xs text-[15px] leading-relaxed text-muted">
              Something else on your mind? Write to{" "}
              <a href="mailto:techpotionshq@gmail.com" className="font-medium text-accent hover:text-accent-strong">
                techpotionshq@gmail.com
              </a>
              .
            </p>
          </div>
          <div className="divide-y divide-line border-y border-line">
            {FAQ(live).map(([q, a]) => (
              <details key={q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[16px] font-medium text-fg [&::-webkit-details-marker]:hidden">
                  {q}
                  <Plus className="h-4 w-4 flex-shrink-0 text-muted transition-transform duration-200 group-open:rotate-45" aria-hidden />
                </summary>
                <p className="mt-3 pr-8 text-[15px] leading-relaxed text-muted">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <MarketingFooter />
    </>
  );
}

function FeatureList({ items, muted = false }: { items: string[]; muted?: boolean }) {
  return (
    <ul className="mt-8 space-y-3 border-t border-line pt-7">
      {items.map((f) => (
        <li key={f} className="flex gap-3 text-[15px] text-fg">
          <span className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full ${muted ? "bg-canvas ring-1 ring-line" : "bg-accent-soft"}`}>
            {muted ? (
              <Plus className="h-3.5 w-3.5 text-muted" strokeWidth={2.5} aria-hidden />
            ) : (
              <Check className="h-3.5 w-3.5 text-accent" strokeWidth={2.5} aria-hidden />
            )}
          </span>
          {f}
        </li>
      ))}
    </ul>
  );
}
