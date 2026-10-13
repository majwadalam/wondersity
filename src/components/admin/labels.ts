// Plain-English names for what the harness records, so the admin panel reads
// as "Wrote a lesson" and "Fact-checking online" instead of "learn · lesson"
// and "verify". Anything unknown falls back to its raw name.

type Label = { name: string; about: string };

/** What a run did, from its kind and outcome (runs table). */
export function runLabel(kind: string, outcome: string | null, ok = true): Label {
  const o = outcome ?? "";
  if (kind === "learn") {
    if (!ok || o === "failed") return { name: "Writing a lesson failed", about: "The tutor stopped with an error; nothing was shown to the learner." };
    if (o === "lesson") return { name: "Wrote a lesson", about: "The tutor planned the course if it was new, then wrote and checked the learner's next lesson." };
    if (o === "ahead") return { name: "Wrote the next lesson early", about: "Written in the background while the learner was on the previous lesson, so it opens instantly." };
    if (o === "resumed") return { name: "Reopened a lesson", about: "The learner came back to a lesson already written. No AI cost." };
    if (o === "nothing_ahead") return { name: "Nothing to write early", about: "The next lesson already existed or the course was finished. No AI cost." };
    if (o === "course_complete") return { name: "Showed a finished course", about: "The course was done, so its overview was shown. No AI cost." };
    if (o === "upgrade_required") return { name: "Stopped by plan limit", about: "The learner's plan didn't allow another lesson. No AI cost." };
    return { name: `Tutor: ${o || "other"}`, about: "A tutor run that ended without writing a lesson." };
  }
  if (kind === "stage") {
    if (o === "unpainted") return { name: "Scenes couldn't be painted", about: "The guide and lines were added, but pictures failed (often the image provider's limit or balance). They're repainted when the lesson is next opened." };
    if (!ok) return { name: "Adding scenes failed", about: "The lesson is shown without paintings and guide lines." };
    return { name: "Added scenes and a guide", about: "Paintings for the lesson, the guide's spoken lines and the \"Go deeper\" links." };
  }
  if (kind === "cover") {
    if (o === "painted") return { name: "Painted the course map", about: "The big painted world a course's journey is drawn on." };
    if (o === "road") return { name: "Traced the road on the map", about: "A model finds the road in the painting so lesson stops can sit on it." };
    if (o === "road_failed") return { name: "Couldn't trace the road", about: "The map falls back to a default curve." };
    return { name: "Painting the map failed", about: "The course is shown with its default art." };
  }
  return { name: `${kind} · ${o}`, about: "" };
}

/** Where a lesson run's money went (run.cost bySteps; withStep in lib/model.ts). */
export const COST_STEPS: Record<string, Label> = {
  write: { name: "Writing lessons", about: "The main model writing the lesson draft." },
  review: { name: "Quality review", about: "A reviewer model scores the draft out of 10." },
  revise: { name: "Rewriting weak drafts", about: "Drafts scoring under 8 are fixed or rewritten once." },
  verify: { name: "Fact-checking online", about: "Claims checked against web search results." },
  agent: { name: "Tutor's decisions", about: "The tutor deciding what to do next and briefing the writer." },
  blind: { name: "Guessable-answer test", about: "A model tries to answer the checks without the lesson." },
  plan: { name: "Planning courses", about: "Writing a new course's levels and modules." },
  plan_match: { name: "Finding a saved plan", about: "Checking whether a saved course plan fits the topic." },
  digest: { name: "Reading uploads", about: "Outlining materials a learner uploaded for a tailored course." },
};

export const costStep = (step: string): Label => COST_STEPS[step] ?? { name: step, about: "" };

/** What each step of a tutor run's trace means (lib/harness.ts, lib/lessonWriter.ts). */
const TRACE_STEPS: Record<string, Label> = {
  load_course: { name: "Loaded the course", about: "Read the learner's course, if they have one, from the database." },
  plan_check: { name: "Checked plan limits", about: "Whether the learner's plan allows this lesson." },
  plan_cache: { name: "Looked for a saved plan", about: "A hit reuses a course plan already made for this topic." },
  lesson_cache: { name: "Looked for a saved lesson", about: "A hit reuses a lesson already written for this course." },
  fast_path: { name: "Served from the cache", about: "The lesson came straight from the cache; the tutor didn't run." },
  "agent.turn": { name: "Tutor thought", about: "One turn of the tutor model deciding what to do." },
  "agent.tool": { name: "Tutor used a tool", about: "The tutor called one of its tools (plan a course, write a module, read mistakes)." },
  "agent.finish": { name: "Tutor finished", about: "The tutor wrote its closing note." },
  "agent.error": { name: "Tutor made a mistake", about: "A tool call was rejected and handed back to the tutor to correct." },
  create_course: { name: "Planned the course", about: "Saved the course's levels and modules." },
  get_quiz_mistakes: { name: "Read past mistakes", about: "Looked at the checks the learner got wrong, to adapt the next lesson." },
  "lesson.generate": { name: "Wrote the draft", about: "The writer model produced the lesson." },
  "lesson.blind": { name: "Guessable-answer test", about: "Could the checks be answered from the options alone?" },
  "lesson.verify": { name: "Fact-checked online", about: "Factual claims checked against web search." },
  "lesson.evaluate": { name: "Quality review", about: "The reviewer scored the lesson out of 10 and listed problems." },
  "lesson.revise": { name: "Revised the draft", about: "Fixed the problems the review found." },
  "lesson.select": { name: "Picked the best version", about: "The highest-scoring checked version is the one shown." },
  save_lesson: { name: "Saved the lesson", about: "" },
  lesson_cached: { name: "Shared it for other learners", about: "Saved to the cache so the next learner gets it free." },
  save_progress: { name: "Saved progress", about: "" },
  "run.cost": { name: "Total cost", about: "What every model call in this run cost, as OpenRouter reported." },
};

export const traceStep = (step: string | undefined): Label => (step && TRACE_STEPS[step]) || { name: step ?? "step", about: "" };

/** What a learner said was wrong with a lesson (lesson_reports.kind). */
export const REPORT_KINDS: Record<string, Label> = {
  wrong_fact: { name: "Wrong fact", about: "Something stated in the lesson isn't true." },
  confusing: { name: "Confusing", about: "The learner couldn't follow it." },
  broken: { name: "Something broken", about: "A step, activity or button didn't work." },
  other: { name: "Other", about: "" },
};

export const reportKind = (kind: string): Label => REPORT_KINDS[kind] ?? { name: kind.replace(/_/g, " "), about: "" };

/** A recorded error in one plain sentence; the raw text stays on the job's page. */
export function plainError(error: string | null): string {
  if (!error) return "No error text was recorded.";
  const e = error.toLowerCase();
  if (e.includes("key limit exceeded") || e.includes("openrouter_key_limit") || (e.includes("402") && e.includes("balance")))
    return "The OpenRouter key ran out of credit or hit its spending limit.";
  if (e.includes("429") || e.includes("rate limit")) return "The AI provider was busy (rate limited).";
  if (/\b50[234]\b/.test(e) && e.includes("openrouter")) return "The AI provider had an outage.";
  if (e.includes("timed out") || e.includes("timeout") || e.includes("aborted")) return "It took too long and was stopped.";
  if (e.includes("syntaxerror") || e.includes("json")) return "The AI returned malformed data.";
  if (e.includes("guide's script was rejected")) return "The guide's script failed its checks twice.";
  if (e.includes("deadline")) return "Ran out of time before finishing.";
  return error.length > 140 ? `${error.slice(0, 140)}…` : error;
}
