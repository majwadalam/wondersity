import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MarketingFooter } from "@/components/app/AppShell";
import { StartCompanion } from "@/components/companion/StartCompanion";
import { YouTubeFacade } from "@/components/lesson/GoDeeper";
import { getCompanion } from "@/lib/db";
import { youtubeId } from "@/lib/enrichment";
import { FREE_LESSONS_PER_COURSE, billingEnabled } from "@/lib/plans";

// A creator's companion course: a public, shareable page that goes with one
// of their videos or episodes and starts a Wondersity course on it. Visiting it
// credits the creator if the learner later subscribes (docs/CREATORS.md).

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const companion = await getCompanion(slug).catch(() => null);
  if (!companion) return { title: "Course not found — Wondersity" };
  const description = companion.blurb || `A hands-on course on ${companion.topic}, a companion to ${companion.partner.name}.`;
  return {
    title: `${companion.title} — a companion course with ${companion.partner.name} · Wondersity`,
    description,
    openGraph: { title: companion.title, description },
  };
}

const STEPS = [
  ["Practise, don't just watch", "Short lessons where you predict, sort, simulate and work things out, with checks right after each idea."],
  ["At your level", "The course is planned for you and adapts the next lesson to what you got wrong."],
  ["Checked before you see it", "Arithmetic is recomputed in code and factual claims are checked against web sources."],
] as const;

export default async function CompanionPage({ params }: Props) {
  const { slug } = await params;
  const companion = await getCompanion(slug);
  if (!companion) notFound();
  const { partner } = companion;
  const videoId = companion.video_url ? youtubeId(companion.video_url) : null;

  return (
    <>
      <main className="bg-white">
        <section className="mx-auto max-w-5xl px-4 pt-14 pb-16 sm:px-6 sm:pt-20">
          <p className="text-sm font-semibold text-accent">
            A companion course with{" "}
            {partner.url ? (
              <a href={partner.url} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
                {partner.name}
              </a>
            ) : (
              partner.name
            )}
          </p>
          <div className="mt-4 grid items-start gap-10 md:grid-cols-[1.1fr_1fr]">
            <div className="min-w-0">
              <h1 className="display-xl text-[38px] leading-[1.1] text-fg sm:text-[52px]">{companion.title}</h1>
              {companion.blurb && <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-muted">{companion.blurb}</p>}
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <StartCompanion topic={companion.topic} partnerCode={partner.code} />
                <span className="text-sm text-muted">
                  {billingEnabled() ? `The first ${FREE_LESSONS_PER_COURSE} lessons are free.` : "Free while Wondersity is in beta."}
                  {partner.discount_code && billingEnabled() ? ` ${partner.name}'s viewers get a discount on Pro.` : ""}
                </span>
              </div>
            </div>
            {videoId && (
              <div className="min-w-0">
                <YouTubeFacade videoId={videoId} title={`${partner.name}: ${companion.title}`} />
                <p className="mt-2 text-sm text-muted">Watch the episode, then practise it.</p>
              </div>
            )}
          </div>
        </section>

        <section className="border-t border-line bg-canvas">
          <div className="mx-auto grid max-w-5xl gap-6 px-4 py-14 sm:px-6 md:grid-cols-3">
            {STEPS.map(([title, body]) => (
              <div key={title} className="rounded-2xl bg-white p-6 ring-1 ring-line">
                <h2 className="text-[15px] font-semibold text-fg">{title}</h2>
                <p className="mt-2 text-[15px] leading-relaxed text-muted">{body}</p>
              </div>
            ))}
          </div>
          <p className="mx-auto max-w-5xl px-4 pb-10 text-xs text-muted sm:px-6">
            {partner.name} is a Wondersity partner and earns a share if you subscribe through this page. The course itself is written by Wondersity.
          </p>
        </section>
      </main>
      <MarketingFooter />
    </>
  );
}
