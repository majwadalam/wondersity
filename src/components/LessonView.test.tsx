import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { Lesson } from "@/lib/lessonBlocks";
import { normalizeLesson } from "@/lib/lessonDesign";
import { legacyLesson, rawHistoryLesson, rawProgrammingLesson } from "@/lib/testFixtures";
import { parseBindings, variablesAt } from "./lesson/CodeBlock";
import { Paragraphs } from "./lesson/BlockFrame";
import { chunks, rich } from "./lesson/rich";
import { LessonView } from "./LessonView";
import type { View } from "./types";

function render(lesson: Lesson) {
  const view: Extract<View, { kind: "lesson" }> = {
    kind: "lesson",
    key: 1,
    lesson,
    lessonId: 1,
    score: 9,
    status: {},
    course: null,
    moduleIndex: null,
    tutorNote: null,
    trace: [],
  };
  return renderToStaticMarkup(
    <LessonView view={view} onSubmitQuiz={async () => assert.fail()} onContinue={() => {}} onOpenModule={() => {}} />
  );
}

const normalized = (raw: unknown) => {
  const r = normalizeLesson(raw);
  if (!r.ok) assert.fail(r.error);
  return r.lesson;
};

/** Index of each needle in the markup, asserting each is present. */
const positions = (html: string, needles: string[]) =>
  needles.map((n) => {
    const at = html.indexOf(n);
    assert.ok(at >= 0, `missing: ${n}`);
    return at;
  });

describe("LessonView", () => {
  it("renders a programming lesson's blocks in order, checks inline", () => {
    const html = render(normalized(rawProgrammingLesson()));
    const at = positions(html, [
      "Predict the output",
      "Step through it",
      "Check 1 of 2",
      "The accumulator pattern",
      "Find the fix",
      "Check 2 of 2",
      "Put it in order",
      "Finish the lesson",
    ]);
    assert.deepEqual([...at].sort((a, b) => a - b), at, "blocks render in lesson order");
    assert.ok(html.includes("total += i"), "code is shown");
    assert.ok(html.includes("Practice-driven"), "the approach is shown");
    assert.ok(html.includes("Need a hint?"), "checks with hints offer them");
  });

  it("renders a history lesson with a different set of blocks", () => {
    const html = render(normalized(rawHistoryLesson()));
    positions(html, ["Story", "A kingdom in debt", "Check 1 of 2", "Timeline", "Two estates", "In your own words", "Check 2 of 2", "What to take away"]);
    assert.ok(!html.includes("code-window"), "no code in a history lesson");
  });

  it("still renders a lesson saved before blocks existed", () => {
    const html = render(legacyLesson() as Lesson);
    const at = positions(html, ["Predict first", "The dichotomy of control", "Practice", "Check 1 of 3", "Check 3 of 3"]);
    assert.deepEqual([...at].sort((a, b) => a - b), at);
    assert.ok(html.includes("For example"));
  });

  it("explains a lesson with no questions instead of breaking", () => {
    const html = render({ title: "Old", objective: "o", estimatedMinutes: 5, concepts: [], questions: [] });
    assert.ok(html.includes("saved before quizzes were required"));
  });
});

describe("problem blocks", () => {
  it("render an answer field, its unit and hints", () => {
    const lesson = normalized(rawHistoryLesson());
    lesson.blocks = [
      ...lesson.blocks!,
      { kind: "problem", heading: "Bread budget", prompt: "A loaf costs 14 sous; a wage is 20 sous. What percent of the wage is one loaf?", answers: ["70"], unit: "%", traps: [], hints: ["Divide, then multiply by 100."], solution: "14 / 20 = 0.7 = 70%." },
    ];
    const html = render(lesson);
    positions(html, ["Work it out", "Bread budget", 'placeholder="Your answer"', "Need a hint?", "%"]);
    assert.ok(!html.includes("70 / 20"), "the solution stays hidden until solved");
  });
});

describe("rich text", () => {
  it("renders `inline code` as code and leaves other text alone", () => {
    assert.equal(renderToStaticMarkup(<p>{rich("Use `for x in xs` here")}</p>), '<p>Use <code class="inline-code font-mono">for x in xs</code> here</p>');
    assert.equal(renderToStaticMarkup(<p>{rich("No code, <b>not html</b>")}</p>), "<p>No code, &lt;b&gt;not html&lt;/b&gt;</p>");
  });
});

describe("code trace variables", () => {
  it("parses bindings, keeping commas inside values and dropping trailing notes", () => {
    assert.deepEqual(parseBindings('i = 2, total = [1, 2], name = "Ada" — 1 of 2 items'), [
      { name: "i", value: "2" },
      { name: "total", value: "[1, 2]" },
      { name: "name", value: '"Ada"' },
    ]);
    assert.equal(parseBindings("names is unchanged"), null);
  });

  it("carries variables across steps and marks only real changes", () => {
    const trace = [{ state: "total = 0" }, { state: "i = 0, total = 0" }, { state: "i = 1, total = 1" }, { state: "loop ends" }, { state: 'i = 1, total = 1 — unchanged' }];
    assert.deepEqual(variablesAt(trace, 1), [
      { name: "total", value: "0", changed: false },
      { name: "i", value: "0", changed: true },
    ]);
    assert.deepEqual(variablesAt(trace, 2).map((v) => v.changed), [true, true]);
    assert.deepEqual(variablesAt(trace, 4).map((v) => `${v.name}=${v.value}${v.changed ? "*" : ""}`), ["total=1", "i=1"]);
  });
});

describe("markdown in lesson text", () => {
  const payoff = [
    "Here is the game.",
    "",
    "| Maya's choice ↓ / Leo's choice → | Café | Park |",
    "|---|---|---|",
    "| Café | (3, 2) | (0, 0) |",
    "| Park | (0, 0) | (?, ?) |",
    "",
    "Use the original preference scores to complete the last cell.",
  ].join("\n");

  it("draws a pipe table as a table, not a row of pipes", () => {
    const html = renderToStaticMarkup(<Paragraphs text={payoff} />);
    assert.match(html, /<table/);
    assert.equal((html.match(/<tr/g) ?? []).length, 3);
    assert.match(html, /<th scope="col"[^>]*>Café<\/th>/);
    assert.match(html, /<td[^>]*>\(\?, \?\)<\/td>/);
    assert.doesNotMatch(html, /\|---/);
  });

  it("draws lists, and leaves a lone pipe line as text", () => {
    assert.deepEqual(
      chunks("Steps:\n- read\n- **think**\n1. one\n2. two").map((c) => c.kind),
      ["text", "list", "list"]
    );
    assert.deepEqual(chunks("| just one line |").map((c) => c.kind), ["text"]);
  });

  it("typesets \\( \\), \\[ \\], $$ $$ and \\ce math, and leaves prices alone", () => {
    const html = renderToStaticMarkup(<>{rich("Area \\(A = \\pi r^2\\) costs $40, not $50. \\[x = \\frac{-b}{2a}\\] and $$E = mc^2$$ and \\(\\ce{H2O}\\)")}</>);
    assert.equal((html.match(/class="katex"/g) ?? []).length, 4);
    assert.equal((html.match(/katex-display/g) ?? []).length, 2);
    assert.match(html, /costs \$40, not \$50/);
    assert.match(html, /<mfrac>/);
  });

  it("shows bad TeX as source instead of breaking", () => {
    const html = renderToStaticMarkup(<>{rich("broken \\(\\frac{1}\\)")}</>);
    assert.match(html, /katex-error|katex/);
  });

  it("renders **bold** and `code` inline", () => {
    const html = renderToStaticMarkup(<>{rich("a **bold** and `x = 1`")}</>);
    assert.match(html, /<strong[^>]*>bold<\/strong>/);
    assert.match(html, /<code[^>]*>x = 1<\/code>/);
  });
});
