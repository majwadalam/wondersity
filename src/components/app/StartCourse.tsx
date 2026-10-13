"use client";

// The start dialog for a new topic. Two ways in:
//
//   Plan it for me  one click; the tutor plans from the topic alone (and may
//                   reuse a shared plan, so it's the fastest).
//   Tailor it       one screen: what they want to be able to do (the only
//                   required field), why, where they're starting, and their
//                   own notes or files. Less common choices sit behind "More".
//
// What's asked follows research/intake-pedagogy.md: outcomes first, purpose
// and context for examples, a starting point that changes the lesson format,
// learner materials as grounding. Learning styles are deliberately not asked.

import { ArrowLeft, ClipboardPaste, FileText, LoaderCircle, Plus, SlidersHorizontal, Sparkles, Upload, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { INTAKE_LIMITS, type Intake } from "@/lib/intake";
import { spring } from "../motion/presets";
import { useAppState } from "./AppState";

type Purpose = NonNullable<Intake["purpose"]>;
type Level = NonNullable<Intake["level"]>;
type Length = NonNullable<Intake["length"]>;

const PURPOSES: { value: Purpose; label: string }[] = [
  { value: "curiosity", label: "Curiosity" },
  { value: "work", label: "For work" },
  { value: "study", label: "A class or exam" },
  { value: "project", label: "A project" },
  { value: "teaching", label: "To teach it" },
];
const LEVELS: { value: Level; label: string }[] = [
  { value: "new", label: "New to it" },
  { value: "basics", label: "Know the basics" },
  { value: "some", label: "Use it sometimes" },
  { value: "solid", label: "Know it well" },
];
const LENGTHS: { value: Length; label: string; hint: string }[] = [
  { value: "short", label: "Short", hint: "4-5 lessons" },
  { value: "standard", label: "Standard", hint: "6-9 lessons" },
  { value: "deep", label: "In depth", hint: "9-12 lessons" },
];

type Added = { id: string; name: string; text: string; pages: number | null; truncated: boolean };

export function StartCourseDialog() {
  const { starting, closeStart } = useAppState();
  return <AnimatePresence>{starting && <Dialog key={starting} topic={starting} onClose={closeStart} />}</AnimatePresence>;
}

function Dialog({ topic, onClose }: { topic: string; onClose: () => void }) {
  const { learn, busy } = useAppState();
  const [mode, setMode] = useState<"choose" | "tailor">("choose");
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);

  // Focus moves into the dialog (and to the form when tailoring), and back to where it was on close.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    return () => previous?.focus?.();
  }, []);
  useEffect(() => {
    panel.current?.querySelector<HTMLElement>(mode === "tailor" ? "textarea" : "button")?.focus();
  }, [mode]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center bg-fg/30 backdrop-blur-sm sm:items-center sm:px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        ref={panel}
        className="flex max-h-[92vh] w-full max-w-xl flex-col rounded-t-2xl border border-line bg-surface shadow-2xl sm:rounded-2xl"
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1, transition: spring.gentle }}
        exit={{ opacity: 0, y: 8, scale: 0.98 }}
      >
        <div className="flex items-start gap-3 px-6 pt-6">
          {mode === "tailor" && (
            <button
              type="button"
              onClick={() => setMode("choose")}
              aria-label="Back"
              className="-ml-2 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-muted hover:bg-canvas hover:text-fg"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium tracking-wide text-muted uppercase">New course</p>
            <h2 id={titleId} className="mt-1 text-xl font-semibold tracking-[-0.01em] text-fg">
              {topic}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-muted hover:bg-canvas hover:text-fg"
          >
            <X size={18} />
          </button>
        </div>

        {mode === "choose" ? (
          <div className="grid gap-3 px-6 pt-5 pb-6 sm:grid-cols-2">
            <Choice
              icon={<Sparkles size={18} />}
              title="Plan it for me"
              text="Your tutor plans the course from the topic alone. The fastest way in."
              disabled={!!busy}
              onClick={() => learn(topic, "course")}
            />
            <Choice
              icon={<SlidersHorizontal size={18} />}
              title="Tailor it"
              text="Say what you want to be able to do and where you're starting, and add your own notes or files."
              onClick={() => setMode("tailor")}
            />
          </div>
        ) : (
          <TailorForm disabled={!!busy} onSubmit={(intake) => learn(topic, "course", intake)} />
        )}
      </motion.div>
    </motion.div>
  );
}

function Choice({ icon, title, text, onClick, disabled }: { icon: ReactNode; title: string; text: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group flex flex-col items-start rounded-xl border border-line bg-white p-4 text-left transition-[border-color,box-shadow] hover:border-accent hover:shadow-[var(--shadow-md)] focus-visible:border-accent disabled:opacity-60"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-soft text-accent">{icon}</span>
      <span className="mt-3 text-[15px] font-semibold text-fg">{title}</span>
      <span className="mt-1 text-sm leading-relaxed text-muted">{text}</span>
    </button>
  );
}

function TailorForm({ disabled, onSubmit }: { disabled: boolean; onSubmit: (intake: Intake) => void }) {
  const [goal, setGoal] = useState("");
  const [purpose, setPurpose] = useState<Purpose | null>(null);
  const [context, setContext] = useState("");
  const [level, setLevel] = useState<Level | null>(null);
  const [known, setKnown] = useState("");
  const [cover, setCover] = useState<string[]>([]);
  const [coverDraft, setCoverDraft] = useState("");
  const [length, setLength] = useState<Length | null>(null);
  const [materials, setMaterials] = useState<Added[]>([]);
  const [pasting, setPasting] = useState(false);
  const [pasted, setPasted] = useState("");
  const [uploading, setUploading] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const ids = { goal: useId(), context: useId(), known: useId(), cover: useId(), paste: useId() };

  const totalChars = materials.reduce((n, m) => n + m.text.length, 0) + pasted.trim().length;
  const roomForFiles = materials.length + (pasted.trim() ? 1 : 0) < INTAKE_LIMITS.materials;
  const ready = goal.trim().length >= 3 && !uploading && !disabled;

  async function addFiles(files: FileList | null) {
    setUploadError(null);
    for (const file of Array.from(files ?? [])) {
      if (materials.length + uploading >= INTAKE_LIMITS.materials) {
        setUploadError(`You can add up to ${INTAKE_LIMITS.materials} materials.`);
        break;
      }
      setUploading((n) => n + 1);
      try {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/materials", { method: "POST", body: form });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) setUploadError(data.error ?? "We couldn't read that file.");
        else setMaterials((ms) => [...ms, { id: `${Date.now()}-${Math.random()}`, name: data.name, text: data.text, pages: data.pages ?? null, truncated: !!data.truncated }]);
      } catch {
        setUploadError("We couldn't upload that file. Check your connection and try again.");
      } finally {
        setUploading((n) => n - 1);
      }
    }
    if (fileInput.current) fileInput.current.value = "";
  }

  function addCover() {
    const item = coverDraft.trim();
    if (!item || cover.length >= INTAKE_LIMITS.coverItems) return;
    setCover((c) => [...c, item.slice(0, INTAKE_LIMITS.coverItem)]);
    setCoverDraft("");
  }

  function submit() {
    if (!ready) return;
    const items = coverDraft.trim() ? [...cover, coverDraft.trim()] : cover;
    const all = [...materials.map((m) => ({ name: m.name, text: m.text })), ...(pasted.trim() ? [{ name: "Pasted notes", text: pasted.trim() }] : [])];
    onSubmit({
      goal: goal.trim(),
      ...(purpose ? { purpose } : {}),
      ...(context.trim() ? { context: context.trim() } : {}),
      ...(level ? { level } : {}),
      ...(known.trim() ? { known: known.trim() } : {}),
      ...(items.length ? { cover: items.slice(0, INTAKE_LIMITS.coverItems) } : {}),
      ...(length ? { length } : {}),
      ...(all.length ? { materials: all } : {}),
    });
  }

  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 pt-5 pb-6">
        <Field label="What do you want to be able to do?" htmlFor={ids.goal} hint="Be specific. Your tutor turns this into the outcomes your course builds to.">
          <textarea
            id={ids.goal}
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            maxLength={INTAKE_LIMITS.goal}
            rows={3}
            required
            placeholder="e.g. Explain it to a friend, use it on real cases at work, pass Friday's exam, build something with it…"
            className="input-box"
          />
        </Field>

        <Field label="Why are you learning it?" hint="Examples and problems are set where you'll use it.">
          <Chips options={PURPOSES} value={purpose} onChange={setPurpose} label="Why are you learning it?" />
          {purpose && (
            <input
              id={ids.context}
              value={context}
              onChange={(e) => setContext(e.target.value)}
              maxLength={INTAKE_LIMITS.note}
              aria-label="Where will you use it?"
              placeholder={CONTEXT_PLACEHOLDER[purpose]}
              className="input-box mt-2.5"
            />
          )}
        </Field>

        <Field label="Where are you starting?" hint="It changes how lessons teach: more worked examples when it's new, harder problems when it isn't.">
          <Chips options={LEVELS} value={level} onChange={setLevel} label="Where are you starting?" />
        </Field>

        <Field label="Your materials" hint="Notes, a syllabus, slides or a chapter. Lessons follow their terms and examples; facts are still checked. Only you see them.">
          {materials.length > 0 && (
            <ul className="mb-2.5 space-y-2">
              {materials.map((m) => (
                <li key={m.id} className="flex items-center gap-3 rounded-lg border border-line bg-white px-3 py-2">
                  <FileText size={16} className="flex-shrink-0 text-muted" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-fg">{m.name}</span>
                    <span className="block text-xs text-muted">
                      {m.pages ? `${m.pages} pages · ` : ""}
                      {m.text.length.toLocaleString()} characters read{m.truncated ? " (the first part)" : ""}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setMaterials((ms) => ms.filter((x) => x.id !== m.id))}
                    aria-label={`Remove ${m.name}`}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-canvas hover:text-fg"
                  >
                    <X size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={!roomForFiles || uploading > 0}
              className="btn-secondary flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium"
            >
              {uploading ? <LoaderCircle size={16} className="animate-spin" /> : <Upload size={16} />}
              {uploading ? "Reading…" : "Add a file"}
            </button>
            {!pasting && (
              <button type="button" onClick={() => setPasting(true)} disabled={!roomForFiles} className="btn-secondary flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium">
                <ClipboardPaste size={16} /> Paste text
              </button>
            )}
            <input
              ref={fileInput}
              type="file"
              multiple
              accept=".pdf,.docx,.txt,.md,.markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
              className="hidden"
              onChange={(e) => addFiles(e.target.files)}
            />
          </div>
          <p className="mt-2 text-xs text-muted">PDF, Word, text or Markdown, up to 10 MB each, {INTAKE_LIMITS.materials} at most.</p>
          {pasting && (
            <textarea
              id={ids.paste}
              value={pasted}
              onChange={(e) => setPasted(e.target.value.slice(0, INTAKE_LIMITS.materialChars))}
              rows={5}
              aria-label="Paste your notes"
              placeholder="Paste notes, a reading list, a syllabus…"
              className="input-box mt-2.5"
            />
          )}
          {uploadError && (
            <p className="mt-2 text-sm text-bad" role="alert">
              {uploadError}
            </p>
          )}
          {totalChars > INTAKE_LIMITS.totalChars && (
            <p className="mt-2 text-xs text-muted">That&rsquo;s a lot of text: your tutor uses the first {INTAKE_LIMITS.totalChars.toLocaleString()} characters.</p>
          )}
        </Field>

        {more ? (
          <>
            <Field label="What do you already know?" htmlFor={ids.known} hint="Your tutor skips it and builds on it.">
              <input
                id={ids.known}
                value={known}
                onChange={(e) => setKnown(e.target.value)}
                maxLength={INTAKE_LIMITS.note}
                placeholder="e.g. I've done basic statistics and some Python"
                className="input-box"
              />
            </Field>
            <Field label="Anything it must cover?" htmlFor={ids.cover} hint={`Up to ${INTAKE_LIMITS.coverItems}. Each one gets a lesson that covers it.`}>
              {cover.length > 0 && (
                <ul className="mb-2.5 flex flex-wrap gap-2">
                  {cover.map((c, i) => (
                    <li key={`${c}-${i}`} className="flex items-center gap-1.5 rounded-full bg-accent-soft py-1 pr-1.5 pl-3 text-sm text-fg">
                      {c}
                      <button type="button" onClick={() => setCover((xs) => xs.filter((_, j) => j !== i))} aria-label={`Remove ${c}`} className="flex h-6 w-6 items-center justify-center rounded-full text-muted hover:text-fg">
                        <X size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {cover.length < INTAKE_LIMITS.coverItems && (
                <div className="flex gap-2">
                  <input
                    id={ids.cover}
                    value={coverDraft}
                    onChange={(e) => setCoverDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addCover();
                      }
                    }}
                    maxLength={INTAKE_LIMITS.coverItem}
                    placeholder="e.g. how to read a cash-flow statement"
                    className="input-box"
                  />
                  <button type="button" onClick={addCover} disabled={!coverDraft.trim()} aria-label="Add" className="btn-secondary flex flex-shrink-0 items-center rounded-lg px-3">
                    <Plus size={16} />
                  </button>
                </div>
              )}
            </Field>
            <Field label="How long a course?" hint="Lessons are 5-10 minutes each. Leave it and your tutor sizes it to the subject.">
              <Chips options={LENGTHS.map((l) => ({ value: l.value, label: `${l.label} · ${l.hint}` }))} value={length} onChange={setLength} label="How long a course?" />
            </Field>
          </>
        ) : (
          <button type="button" onClick={() => setMore(true)} className="text-sm font-medium text-accent hover:text-accent-strong">
            More options: what you know, what it must cover, length
          </button>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-line px-6 py-4">
        <p className="text-xs text-muted">Only the first question is required.</p>
        <button type="submit" disabled={!ready} className="btn-pill btn-pill-dark flex-shrink-0">
          Plan my course
        </button>
      </div>
    </form>
  );
}

const CONTEXT_PLACEHOLDER: Record<Purpose, string> = {
  curiosity: "Optional: what got you interested?",
  work: "Optional: your job, e.g. I manage a small marketing team",
  study: "Optional: which class or exam, e.g. A-level Physics, paper 2",
  project: "Optional: the project, e.g. building a budgeting app",
  teaching: "Optional: who you'll teach, e.g. my year 9 class",
};

function Field({ label, hint, htmlFor, children }: { label: string; hint?: string; htmlFor?: string; children: ReactNode }) {
  const Label = htmlFor ? "label" : "p";
  return (
    <div>
      <Label {...(htmlFor ? { htmlFor } : {})} className="block text-[15px] font-semibold text-fg">
        {label}
      </Label>
      {hint && <p className="mt-0.5 mb-2.5 text-sm text-muted">{hint}</p>}
      {!hint && <div className="mb-2.5" />}
      {children}
    </div>
  );
}

/** One choice from a few, or none: tapping the chosen one clears it. */
function Chips<T extends string>({ options, value, onChange, label }: { options: { value: T; label: string }[]; value: T | null; onChange: (v: T | null) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(on ? null : o.value)}
            className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
              on ? "border-accent bg-accent-soft font-medium text-fg" : "border-line bg-white text-fg hover:border-line-strong"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
