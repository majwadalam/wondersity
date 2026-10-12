"use client";

import { AnimatePresence, motion, useInView, useTransform } from "motion/react";
import {
  Check,
  CircleCheck,
  History,
  Plus,
  Zap,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { CATALOG, CatalogTile } from "../app/CourseCards";
import { EASE_OUT } from "../motion/presets";
import { Reveal } from "../Reveal";
import { ReplyForm } from "./Hero";
import { ProductWindow } from "./HeroDemo";
import {
  CodeDemo,
  CurveDemo,
  DebateDemo,
  OrderDemo,
  VoiceDemo,
} from "./Playground";
import { Em, SectionHead, useScrub } from "./Primitives";

// The landing page below the hero: each section a number, a heading and the
// real product doing what the heading says.

/** A white piece of the app, lifted off whatever it sits on. */
function Float({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl bg-white shadow-[0_1px_2px_rgba(10,37,64,0.06),0_16px_36px_-12px_rgba(10,37,64,0.45)] ${className}`}
    >
      {children}
    </div>
  );
}

// ---------- 01 · not a chat ----------

export function NotAChat() {
  const stage = useRef<HTMLDivElement>(null);
  // The lesson player lies back a little and stands up as it scrolls in.
  const p = useScrub(stage, ["start end", "center center"]);
  const rotateX = useTransform(p, [0, 1], [14, 0]);
  const scale = useTransform(p, [0, 1], [0.94, 1]);
  const opacity = useTransform(p, [0, 0.6, 1], [0.35, 1, 1]);
  return (
    <section className="bg-canvas">
      <div className="mx-auto max-w-[1160px] px-5 py-24 sm:px-8 lg:py-32">
        <SectionHead
          index="01"
          eyebrow="Why not just ask a chatbot?"
          lines={[
            <>
              A course, <Em>not a chat.</Em>
            </>,
          ]}
          body="A chat answers and moves on. Wondersity keeps a plan, gives you something to do with every idea, and checks what stuck. This is a real step from a lesson; try the question."
        />
        <div ref={stage} className="mt-14" style={{ perspective: 1400 }}>
          <motion.div
            style={{ rotateX, scale, opacity, transformOrigin: "50% 100%" }}
          >
            <ProductWindow />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ---------- 02 · how it works: three steps beside one picture that changes ----------

const STEPS: { title: string; body: string; visual: ReactNode }[] = [
  {
    title: "You name a topic",
    body: "Anything: a war, a philosopher, a theorem, a chord. No syllabus needed.",
    visual: (
      <Float className="flex w-full max-w-[420px] items-center justify-between gap-3 rounded-full py-2 pr-2 pl-6">
        <span className="truncate text-[17px] text-fg">
          Stoicism
          <span className="caret" aria-hidden />
        </span>
        <span className="flex-shrink-0 rounded-full bg-accent px-5 py-2.5 text-[14px] font-semibold text-white">
          Start course
        </span>
      </Float>
    ),
  },
  {
    title: "Wondersity plans the course",
    body: "In under a minute: levels of short lessons, each with one objective, in an order that builds.",
    visual: (
      <Float className="w-full max-w-[420px] p-5">
        <p className="text-[14px] font-semibold text-fg">
          Stoicism: From Ideas to Daily Practice
        </p>
        <div className="mt-3.5 space-y-2">
          {[
            ["The Stoic Worldview", "3 lessons", true],
            ["The Stoic Toolkit", "3 lessons", false],
            ["Living It", "3 lessons", false],
          ].map(([t, n, first], k) => (
            <div
              key={t as string}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 ${first ? "bg-accent-soft" : "bg-canvas"}`}
            >
              <span
                className={`text-[12px] font-semibold tabular-nums ${first ? "text-accent" : "text-muted"}`}
              >
                L{k + 1}
              </span>
              <span className="truncate text-[14px] font-medium text-fg">
                {t}
              </span>
              <span className="ml-auto flex-shrink-0 text-[12px] text-muted">
                {n}
              </span>
            </div>
          ))}
        </div>
      </Float>
    ),
  },
  {
    title: "You learn by doing",
    body: "Sort, predict, argue, answer. Each lesson has things to do, and your mistakes shape the next one.",
    visual: (
      <Float className="w-full max-w-[420px] p-5">
        <p className="text-[14px] font-semibold text-fg">
          Philosophy, or personality label?
        </p>
        <div className="mt-3.5 grid grid-cols-2 gap-2.5">
          {[
            ["Stoic", ["Judging better"]],
            ["stoic", ["Feeling nothing"]],
          ].map(([h, items]) => (
            <div key={h as string} className="rounded-lg bg-canvas p-2.5">
              <p className="text-[12px] font-semibold text-muted">
                {h as string}
              </p>
              {(items as string[]).map((x) => (
                <span
                  key={x}
                  className="mt-2 flex items-center gap-1.5 rounded-md bg-white px-2.5 py-2 text-[13px] text-fg shadow-sm ring-1 ring-line"
                >
                  <Check size={12} strokeWidth={3} className="text-good" /> {x}
                </span>
              ))}
            </div>
          ))}
        </div>
        <span className="mt-3 inline-flex -rotate-2 items-center rounded-md bg-white px-2.5 py-2 text-[13px] text-fg shadow-[var(--shadow-md)] ring-2 ring-accent">
          Practised in Rome
        </span>
      </Float>
    ),
  },
];

/** One step of the flow; tells its parent when it's in the middle of the screen. */
function Step({
  i,
  title,
  body,
  visual,
  current,
  onActive,
}: {
  i: number;
  title: string;
  body: string;
  visual: ReactNode;
  /** The step the picture beside the list is showing; the others are dimmed on wide screens. */
  current: boolean;
  onActive: (i: number) => void;
}) {
  const ref = useRef<HTMLLIElement>(null);
  const inView = useInView(ref, { margin: "-45% 0px -45% 0px" });
  useEffect(() => {
    if (inView) onActive(i);
  }, [inView, i, onActive]);
  return (
    <li
      ref={ref}
      aria-current={current ? "step" : undefined}
      className={`flex flex-col justify-center py-10 transition-opacity duration-500 lg:min-h-[48vh] lg:py-0 ${current ? "" : "lg:opacity-30"}`}
    >
      <p className="font-mono text-[12px] tracking-[0.18em] text-accent-on-dark uppercase tabular-nums">
        Step {i + 1}
      </p>
      <h3 className="display-xl mt-3 text-[30px] text-white sm:text-[36px]">
        {title}
      </h3>
      <p className="mt-3 max-w-md text-[16px] leading-relaxed text-white/60 sm:text-[17px]">
        {body}
      </p>
      <div className="mt-8 flex justify-start lg:hidden">{visual}</div>
    </li>
  );
}

export function HowItWorks() {
  const [active, setActive] = useState(0);
  const list = useRef<HTMLOListElement>(null);
  const line = useScrub(list, ["start center", "end center"]);
  return (
    // overflow-clip, not hidden: a hidden overflow would stop the picture sticking.
    <section id="how" className="relative scroll-mt-16 overflow-clip bg-navy">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -right-40 h-[620px] w-[720px] rounded-full opacity-40 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, rgba(99,91,255,0.5), transparent)",
        }}
      />
      <div className="relative mx-auto max-w-[1160px] px-5 py-24 sm:px-8 lg:py-32">
        <SectionHead
          dark
          index="02"
          eyebrow="How it works"
          lines={[
            "From a topic to a course",
            <>
              <Em dark>in a minute.</Em>
            </>,
          ]}
        />
        <div className="mt-10 grid gap-10 lg:mt-20 lg:grid-cols-[1fr_1.15fr] lg:gap-24">
          <div className="relative pl-7 sm:pl-9">
            {/* The way down the steps, filled as far as you've read. */}
            <span
              className="absolute top-0 bottom-0 left-0 w-px bg-white/10"
              aria-hidden
            />
            <motion.span
              style={{ scaleY: line, transformOrigin: "top" }}
              className="absolute top-0 bottom-0 left-0 w-px bg-accent-on-dark"
              aria-hidden
            />
            <ol ref={list} className="lg:py-[6vh]">
              {STEPS.map((s, i) => (
                <Step
                  key={s.title}
                  i={i}
                  title={s.title}
                  body={s.body}
                  visual={s.visual}
                  current={active === i}
                  onActive={setActive}
                />
              ))}
            </ol>
          </div>
          <div className="hidden lg:block">
            <div
              className="sticky top-[calc(4rem+8vh)] flex h-[min(62vh,560px)] items-center justify-center overflow-hidden rounded-[28px] p-10 ring-1 ring-white/10"
              style={{
                background:
                  "radial-gradient(110% 90% at 50% 0%, rgba(99,91,255,0.38), rgba(110,195,244,0.06) 70%), #0e2d4b",
              }}
            >
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={`n${active}`}
                  aria-hidden
                  className="display-xl pointer-events-none absolute -bottom-6 -left-2 text-[220px] leading-none text-white/[0.05] tabular-nums"
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -30 }}
                  transition={{ duration: 0.5, ease: EASE_OUT }}
                >
                  0{active + 1}
                </motion.span>
              </AnimatePresence>
              <AnimatePresence mode="wait">
                <motion.div
                  key={active}
                  className="relative flex w-full origin-center scale-[1.15] justify-center"
                  initial={{ opacity: 0, y: 24, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{
                    opacity: 0,
                    y: -16,
                    scale: 0.98,
                    transition: { duration: 0.18 },
                  }}
                  transition={{ duration: 0.45, ease: EASE_OUT }}
                >
                  {STEPS[active].visual}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------- 03 · subjects: a card per subject, each a live demo ----------

type Subject = {
  key: string;
  label: string;
  title: string;
  /** The course painting faded in behind the card's header (decorative). */
  art: string;
  demo: ReactNode;
};

const SUBJECTS: Subject[] = [
  {
    key: "philosophy",
    label: "Philosophy",
    title: "Argue with Socrates",
    art: "/art/socrates.webp",
    demo: <DebateDemo />,
  },
  {
    key: "maths",
    label: "Maths & science",
    title: "Drag it and watch",
    art: "/art/black-holes.webp",
    demo: <CurveDemo />,
  },
  {
    key: "history",
    label: "History",
    title: "Put the past in order",
    art: "/art/the-fall-of-rome.webp",
    demo: <OrderDemo />,
  },
  {
    key: "code",
    label: "Programming",
    title: "Predict, then run",
    art: "/art/machine-learning.webp",
    demo: <CodeDemo />,
  },
  {
    key: "guide",
    label: "Your guide",
    title: "Hear it told",
    art: "/art/scenes/agora-debate.webp",
    demo: (
      <>
        <div className="relative mb-3 h-28 overflow-hidden rounded-xl">
          <Image
            unoptimized
            src="/art/scenes/crito-prison.webp"
            alt="Socrates and Crito in a prison cell in Athens"
            fill
            sizes="400px"
            className="object-cover"
          />
        </div>
        <VoiceDemo />
      </>
    ),
  },
];

/** Each card's share of the twelve columns on wide screens. */
const SPANS: Record<string, string> = {
  philosophy: "lg:col-span-7",
  maths: "lg:col-span-5",
  history: "lg:col-span-4",
  code: "lg:col-span-4",
  guide: "lg:col-span-4",
};

/** One subject: its label and title over a faded course painting, then the live demo. */
function SubjectCard({ s }: { s: Subject }) {
  return (
    <div className="group relative isolate flex min-w-0 flex-1 flex-col overflow-hidden rounded-[28px] bg-canvas p-6 ring-1 ring-line transition-shadow duration-300 hover:shadow-[var(--shadow-lg)] sm:p-7">
      {/* The course painting as a backdrop in the top-right corner: it fades out downward (before the demo)
          and to the left (before the title), so nothing sits on top of it. */}
      <div
        className="absolute top-0 right-0 -z-10 h-40 w-52 opacity-50 [mask-composite:intersect] [mask-image:linear-gradient(to_bottom,black_30%,transparent),linear-gradient(to_left,black_45%,transparent)] transition-opacity duration-500 group-hover:opacity-70"
        aria-hidden
      >
        <Image
          unoptimized
          src={s.art}
          alt=""
          fill
          sizes="208px"
          className="object-cover"
        />
      </div>
      <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">
        {s.label}
      </p>
      <h3 className="mt-2 text-[21px] font-semibold tracking-[-0.01em] text-fg">
        {s.title}
      </h3>
      <div className="mt-6 flex flex-1 flex-col justify-center">{s.demo}</div>
    </div>
  );
}

export function Subjects() {
  return (
    <section id="subjects" className="scroll-mt-16 bg-white">
      <div className="mx-auto max-w-[1160px] px-5 pt-24 pb-16 sm:px-8 lg:pt-32 lg:pb-20">
        <SectionHead
          index="03"
          eyebrow="Every subject"
          lines={[
            "Taught by doing,",
            <>
              <Em>not by reading.</Em>
            </>,
          ]}
          body="Each lesson is built from the activities that fit the idea. These are real ones; every card works."
        />
        <div className="mt-14 grid gap-4 lg:grid-cols-12">
          {SUBJECTS.map((s, i) => (
            // The Reveal is the grid item (it carries the column span); the card fills it.
            <Reveal
              key={s.key}
              group="subjects"
              delay={i * 80}
              stagger={80}
              className={`${SPANS[s.key]} flex`}
            >
              <SubjectCard s={s} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------- 04 · quality ----------

const PROMISES: [LucideIcon, string, string][] = [
  [
    CircleCheck,
    "Graded on the server",
    "Your first answer to each question counts, and it's saved to your progress.",
  ],
  [
    History,
    "Your mistakes come back",
    "The tutor reads what you got wrong and goes over it again later.",
  ],
  [
    Zap,
    "No waiting between lessons",
    "The next lesson is written while you take this one.",
  ],
];

export function Quality() {
  const panel = useRef<HTMLDivElement>(null);
  const p = useScrub(panel, ["start end", "center center"]);
  const rotate = useTransform(p, [0, 1], [-4, -1.5]);
  const y = useTransform(p, [0, 1], [40, 0]);
  return (
    <section className="relative overflow-hidden bg-navy">
      <div className="mx-auto grid max-w-[1160px] gap-14 px-5 py-24 sm:px-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:gap-20 lg:py-32">
        <div>
          <SectionHead
            dark
            size="md"
            index="04"
            eyebrow="Quality"
            lines={[
              "Every lesson is read",
              <>
                <Em dark>before you see it.</Em>
              </>,
            ]}
          />
          <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-white/65 sm:text-[19px]">
            A second model reads each lesson like a strict teacher: are the
            facts right, does the question test the idea, does the hint give it
            away? Under 8 out of 10, it&rsquo;s rewritten and read again.
          </p>
          <ul className="mt-10 space-y-6">
            {PROMISES.map(([Icon, t, b], i) => (
              <Reveal
                key={t}
                as="li"
                group="promises"
                delay={i * 90}
                stagger={90}
                className="flex gap-4"
              >
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white/[0.07] text-accent-on-dark ring-1 ring-white/10">
                  <Icon size={19} />
                </span>
                <div>
                  <p className="text-[16px] font-semibold text-white">{t}</p>
                  <p className="mt-0.5 text-[15px] leading-relaxed text-white/60">
                    {b}
                  </p>
                </div>
              </Reveal>
            ))}
          </ul>
        </div>
        <motion.div
          ref={panel}
          style={{ rotate, y }}
          className="rounded-[28px] p-4 sm:p-10"
        >
          <div
            className="absolute inset-0 -z-10 rounded-[28px]"
            style={{
              background:
                "linear-gradient(140deg, #635bff 0%, #4b45e0 50%, #3aa0e8 100%)",
            }}
            aria-hidden
          />
          <ReviewSheet />
        </motion.div>
      </div>
    </section>
  );
}

/**
 * A real review: a test lesson on the French Revolution, its reviewer's notes
 * on the first draft (quoted, shortened), then on the rewrite.
 */
function ReviewSheet() {
  return (
    <figure>
      <Float className="overflow-hidden">
        <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-3.5">
          <p className="text-[13px] text-muted">
            <span className="font-semibold text-fg">Why 1789?</span> · Review of
            draft 1
          </p>
          <span className="flex-shrink-0 rounded-full bg-[#fff1e6] px-2.5 py-1 text-[13px] font-semibold text-[#b45309] tabular-nums">
            6.5 / 10
          </span>
        </div>
        <ul className="space-y-3 px-5 py-4 text-[14px] leading-snug text-fg">
          {[
            "A timeline titled “Six months that changed France” runs from August 1788 to July 1789: nearly a year.",
            "Both questions can be answered by elimination, so they don't test understanding.",
            "Eight minutes is too short for everything in it; closer to ten or twelve.",
          ].map((t) => (
            <li key={t} className="flex gap-2.5">
              <span className="mt-[7px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-bad" />
              {t}
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between gap-4 bg-canvas px-5 py-3.5">
          <p className="text-[13px] leading-snug text-muted">
            <span className="font-semibold text-fg">Draft 2.</span> Timeline and
            questions fixed. Still under 8, so it&rsquo;s shown with its real
            score.
          </p>
          <span className="flex-shrink-0 rounded-full bg-white px-2.5 py-1 text-[13px] font-semibold text-fg ring-1 ring-line tabular-nums">
            7.5 / 10
          </span>
        </div>
      </Float>
      <figcaption className="mt-3 text-center text-[12.5px] text-white/80">
        From a real test lesson; the reviewer&rsquo;s notes shortened.
      </figcaption>
    </figure>
  );
}

// ---------- 05 · courses ----------

export function CourseGallery() {
  return (
    <section className="bg-canvas">
      <div className="mx-auto max-w-[1160px] px-5 py-24 sm:px-8 lg:py-32">
        <SectionHead
          center
          index="05"
          eyebrow="Start anywhere"
          lines={[
            "Pick a course,",
            <>
              <Em>or name your own.</Em>
            </>,
          ]}
        />
        <div className="mt-14 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4">
          {CATALOG.slice(0, 8).map((c, i) => (
            <Reveal
              key={c.topic}
              group="gallery"
              delay={i * 40}
              stagger={40}
              className="h-full"
            >
              <CatalogTile topic={c.topic} blurb={c.blurb} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------- 06 · FAQ ----------

const FAQ = [
  {
    q: "What can I learn?",
    a: "Anything you can name, for work or for curiosity, and especially what has no good course: a tool your team just adopted, the finance behind a startup, one philosopher's method, a forgotten number system. Wondersity plans the course from scratch, at your level. The more obscure the topic, the less the AI knows about it, so treat a lesson on a very rare subject as a strong start, not the final word.",
  },
  {
    q: "How is this different from asking ChatGPT or Gemini?",
    a: "A chat is one long thread with no plan. Wondersity plans the whole course first, keeps each lesson short with one objective, grades your answers, and uses your mistakes to shape what comes next.",
  },
  {
    q: "How do I know the lessons are any good?",
    a: "Every lesson is scored by a second model before you see it, and rewritten if it falls short. A lesson that still falls short is shown with its real score.",
  },
  {
    q: "Do I need an account?",
    a: "Yes, a free one: sign up with Google or with your email and a password. Your courses, progress and streak then follow you to any device.",
  },
  {
    q: "How long until I can start?",
    a: "Your course plan opens in under a minute, and lesson 1 is written while you look at it. After that, each lesson is written while you take the one before.",
  },
];

/** One question; its answer slides open and closed. */
function FaqItem({
  q,
  a,
  open,
  onToggle,
}: {
  q: string;
  a: string;
  open: boolean;
  onToggle: () => void;
}) {
  const id = useId();
  return (
    <div className="border-b border-line">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-6 py-5 text-left text-[17px] font-medium text-fg sm:text-[19px]"
      >
        {q}
        <span
          aria-hidden
          className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full transition-all duration-300 ${
            open
              ? "rotate-45 bg-accent text-white"
              : "bg-canvas text-muted ring-1 ring-line"
          }`}
        >
          <Plus size={16} strokeWidth={2.25} />
        </span>
      </button>
      <div
        id={id}
        role="region"
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
      >
        <div className="overflow-hidden">
          <p className="max-w-xl pr-12 pb-6 text-[15.5px] leading-relaxed text-muted">
            {a}
          </p>
        </div>
      </div>
    </div>
  );
}

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="bg-white">
      <div className="mx-auto grid max-w-[1160px] gap-10 px-5 py-24 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20 lg:py-32">
        <SectionHead
          size="md"
          index="06"
          eyebrow="FAQ"
          lines={[
            <>
              Questions, <Em>answered.</Em>
            </>,
          ]}
        />
        <div className="border-t border-line">
          {FAQ.map((f, i) => (
            <FaqItem
              key={f.q}
              q={f.q}
              a={f.a}
              open={open === i}
              onToggle={() => setOpen(open === i ? null : i)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------- closing ----------

export function ClosingCta() {
  const section = useRef<HTMLElement>(null);
  const p = useScrub(section, ["start end", "end start"]);
  // The agora drifts a little slower than the page.
  const y = useTransform(p, [0, 1], ["-12%", "12%"]);
  return (
    <section ref={section} className="relative overflow-hidden bg-navy">
      <motion.div style={{ y }} className="absolute -inset-y-[12%] inset-x-0">
        <Image
          unoptimized
          src="/art/landing/world.webp"
          alt="The Athenian agora at dusk, in clay"
          fill
          sizes="100vw"
          className="object-cover object-bottom"
        />
      </motion.div>
      <div className="absolute inset-0 bg-gradient-to-b from-navy via-navy/80 to-navy/40" />
      <div className="relative mx-auto flex min-h-[640px] max-w-[1160px] flex-col items-center px-5 pt-24 pb-44 text-center sm:px-8 lg:pt-32">
        <SectionHead
          center
          dark
          index="07"
          eyebrow="Start now"
          lines={[
            "Your first course is",
            <>
              <Em dark>a minute away.</Em>
            </>,
          ]}
        />
        <div className="w-full">
          <ReplyForm
            id="cta-topic"
            light
            center
            onImage
            suggestions={["Unit economics", "Greek accents", "Writing a design doc", "Just intonation"]}
          />
        </div>
      </div>
    </section>
  );
}
