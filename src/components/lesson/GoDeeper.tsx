"use client";

import { BookOpen, ExternalLink, Image as ImageIcon, Newspaper, Play } from "lucide-react";
import { useState } from "react";
import type { Resources } from "@/lib/enrichment";

// "Go deeper" at the end of a lesson: videos, articles, books and images, each
// confirmed to exist and shown with where it comes from (lib/enrichment.ts).
// Videos load only when played, from YouTube's privacy-enhanced domain.

export function GoDeeper({ resources }: { resources: Resources }) {
  const { videos, articles, books, images } = resources;
  if (!videos.length && !articles.length && !books.length && !images.length) return null;
  return (
    <section aria-label="Go deeper" className="mt-6 rounded-2xl border border-line p-6">
      <p className="text-sm font-semibold text-fg">Go deeper</p>
      <p className="mt-1 text-sm text-muted">Picked for this lesson. Each one was looked up to make sure it&rsquo;s real.</p>

      {videos.length > 0 && (
        <Group icon={<Play size={14} aria-hidden />} title="Watch">
          <div className="grid gap-4 sm:grid-cols-2">
            {videos.map((v) => (
              <Video key={v.videoId} video={v} />
            ))}
          </div>
        </Group>
      )}

      {articles.length > 0 && (
        <Group icon={<Newspaper size={14} aria-hidden />} title="Read">
          <ul className="space-y-3">
            {articles.map((a) => (
              <li key={a.url}>
                <a href={a.url} target="_blank" rel="noopener noreferrer" className="group block min-w-0">
                  <span className="flex items-center gap-1.5 font-medium text-fg group-hover:text-accent">
                    <span className="min-w-0 truncate">{a.title}</span>
                    <ExternalLink size={12} className="flex-shrink-0 text-muted" aria-hidden />
                  </span>
                  <span className="text-xs text-muted">{a.site}</span>
                  <span className="mt-0.5 block text-sm text-muted">{a.why}</span>
                </a>
              </li>
            ))}
          </ul>
        </Group>
      )}

      {books.length > 0 && (
        <Group icon={<BookOpen size={14} aria-hidden />} title="Books">
          <ul className="space-y-4">
            {books.map((b) => (
              <li key={b.url} className="flex gap-4">
                {b.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element -- Open Library cover, remote
                  <img src={b.cover} alt="" loading="lazy" className="h-24 w-16 flex-shrink-0 rounded-md object-cover ring-1 ring-line" />
                ) : (
                  <span aria-hidden className="flex h-24 w-16 flex-shrink-0 items-center justify-center rounded-md bg-canvas ring-1 ring-line">
                    <BookOpen size={18} className="text-muted" />
                  </span>
                )}
                <div className="min-w-0">
                  <a href={b.url} target="_blank" rel="noopener noreferrer" className="font-medium text-fg hover:text-accent">
                    {b.title}
                  </a>
                  <p className="text-sm text-muted">
                    {b.author}
                    {b.year ? `, ${b.year}` : ""}
                  </p>
                  <p className="mt-1 text-sm text-muted">{b.why}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">Book details from Open Library.</p>
        </Group>
      )}

      {images.length > 0 && (
        <Group icon={<ImageIcon size={14} aria-hidden />} title="See it">
          <div className="grid gap-4 sm:grid-cols-3">
            {images.map((img) => (
              <figure key={img.url} className="min-w-0">
                <a href={img.url} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element -- Wikimedia Commons thumbnail, remote */}
                  <img src={img.thumb} alt={img.caption} title={img.title} loading="lazy" className="aspect-[4/3] w-full rounded-xl bg-canvas object-cover ring-1 ring-line" />
                </a>
                <figcaption className="mt-2 text-sm text-fg">{img.caption}</figcaption>
                <p className="mt-1 truncate text-xs text-muted" title={`${img.credit} · ${img.license}`}>
                  {img.credit} ·{" "}
                  <a href={img.url} target="_blank" rel="noopener noreferrer" className="hover:text-accent">
                    {img.license}
                  </a>
                  , via Wikimedia Commons
                </p>
              </figure>
            ))}
          </div>
        </Group>
      )}
    </section>
  );
}

function Group({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6 border-t border-line pt-5">
      <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
        {icon}
        {title}
      </p>
      {children}
    </div>
  );
}

function Video({ video }: { video: Resources["videos"][number] }) {
  return (
    <div className="min-w-0">
      <YouTubeFacade videoId={video.videoId} title={video.title} />
      <a href={video.url} target="_blank" rel="noopener noreferrer" className="mt-2 block text-sm font-medium text-fg hover:text-accent">
        {video.title}
      </a>
      <p className="text-xs text-muted">{video.channel}</p>
      <p className="mt-1 text-sm text-muted">{video.why}</p>
    </div>
  );
}

/** A YouTube video's thumbnail that becomes the privacy-enhanced player when pressed. */
export function YouTubeFacade({ videoId, title }: { videoId: string; title: string }) {
  const [playing, setPlaying] = useState(false);
  return (
    <div className="relative aspect-video overflow-hidden rounded-xl bg-navy ring-1 ring-line">
      {playing ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1`}
          title={title}
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 h-full w-full"
        />
      ) : (
        <button type="button" onClick={() => setPlaying(true)} aria-label={`Play ${title}`} className="group absolute inset-0">
          {/* eslint-disable-next-line @next/next/no-img-element -- YouTube thumbnail, remote */}
          <img src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`} alt="" loading="lazy" className="h-full w-full object-cover" />
          <span className="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors group-hover:bg-black/30">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/95 text-fg shadow-lg">
              <Play size={20} className="ml-0.5" aria-hidden />
            </span>
          </span>
        </button>
      )}
    </div>
  );
}
