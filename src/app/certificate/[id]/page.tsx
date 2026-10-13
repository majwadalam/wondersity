import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CertificateCard, type CertificateView } from "@/components/certificate/CertificateCard";
import { LearnThisToo } from "@/components/certificate/LearnThisToo";
import { ShareCertificate } from "@/components/certificate/ShareCertificate";
import { certificateUrl, qrSvg } from "@/lib/certificateLink";
import { getPublicCertificate } from "@/lib/db";

// A certificate's public page. Anyone with the link can open it (the id is
// unguessable and certificates can't be listed); search engines are asked not
// to index it, since it carries a person's name.

type Props = { params: Promise<{ id: string }> };

async function load(id: string): Promise<CertificateView | null> {
  const row = await getPublicCertificate(id).catch(() => null);
  if (!row) return null;
  return {
    id: row.id,
    learnerName: row.learner_name,
    courseTitle: row.course_title,
    topic: row.topic,
    levels: row.levels ?? [],
    lessons: row.lessons,
    minutes: row.minutes,
    accuracy: row.accuracy,
    completedAt: row.completed_at,
  };
}


export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = await load((await params).id);
  if (!c) return { title: "Certificate not found · Wondersity", robots: { index: false } };
  const title = `${c.learnerName} completed ${c.courseTitle}`;
  const description = `A Wondersity certificate: ${c.lessons} interactive lessons${c.levels.length ? ` across ${c.levels.length} levels` : ""}.`;
  return { title: `${title} · Wondersity`, description, robots: { index: false, follow: false }, openGraph: { title, description, type: "article" }, twitter: { card: "summary_large_image", title, description } };
}

export default async function CertificatePage({ params }: Props) {
  const { id } = await params;
  const c = await load(id);
  if (!c) notFound();
  const url = await certificateUrl(c.id);
  const qr = await qrSvg(url);
  return (
    <main className="mx-auto max-w-5xl px-4 pt-10 pb-24 sm:px-6">
      {/* "PDF" prints the certificate alone, on one A4 landscape sheet. */}
      <style>{`@media print { @page { size: A4 landscape; margin: 0; } }`}</style>
      {/* The certificate first, full width; what to do with it underneath. */}
      <CertificateCard c={c} verifyUrl={url.replace(/^https?:\/\//, "")} qr={qr} />
      <div className="certificate-extras mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3 lg:items-stretch">
        <ShareCertificate c={c} url={url} imageUrl={`/certificate/${c.id}/opengraph-image`} />
        <Details c={c} />
        <div className="md:col-span-2 lg:col-span-1 [&>section]:h-full">
          <LearnThisToo topic={c.topic} />
        </div>
      </div>
    </main>
  );
}

/** What the certificate stands for, from saved completions and answers. */
function Details({ c }: { c: CertificateView }) {
  return (
    <section className="shadow-card h-full rounded-3xl bg-white p-5 sm:p-6" aria-label="About this certificate">
      <h2 className="text-[15px] font-semibold text-fg">About this certificate</h2>
      <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
        <div className="rounded-xl bg-canvas px-2 py-3">
          <dt className="text-[11px] text-muted">Lessons</dt>
          <dd className="mt-0.5 text-base font-semibold whitespace-nowrap text-fg tabular-nums">{c.lessons}</dd>
        </div>
        <div className="rounded-xl bg-canvas px-2 py-3">
          <dt className="text-[11px] text-muted">Learning time</dt>
          <dd className="mt-0.5 text-base font-semibold whitespace-nowrap text-fg tabular-nums">{c.minutes >= 90 ? `${Math.round(c.minutes / 60)} h` : `${c.minutes} min`}</dd>
        </div>
        <div className="rounded-xl bg-canvas px-2 py-3">
          <dt className="text-[11px] text-muted">First-try right</dt>
          <dd className="mt-0.5 text-base font-semibold whitespace-nowrap text-fg tabular-nums">{c.accuracy === null ? "–" : `${c.accuracy}%`}</dd>
        </div>
      </dl>
      {c.levels.length > 0 && (
        <ol className="mt-4 space-y-1.5 text-sm text-fg">
          {c.levels.map((l, i) => (
            <li key={l} className="flex gap-2">
              <span className="text-muted tabular-nums">{i + 1}.</span>
              {l}
            </li>
          ))}
        </ol>
      )}
      <p className="mt-4 text-xs leading-relaxed text-muted">
        Issued by Wondersity when every lesson of the course was finished. Each lesson passed an automated quality and fact check before it was shown.
      </p>
    </section>
  );
}
