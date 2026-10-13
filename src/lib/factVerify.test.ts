import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { citedUrl, evidenceOnPage, quoteOnly, lessonText, settleVerdict, verifyFacts, type VerifyDeps } from "./factVerify";
import type { Lesson } from "./lessonBlocks";

const britannica = {
  url: "https://www.britannica.com/event/Estates-General",
  title: "Estates-General | Britannica",
  content: "The Estates-General had not met since 1614 when Louis XVI summoned it in 1788.",
};

const judgement = (over: Partial<{ verdict: "supported" | "contradicted" | "unclear"; correction: string; sourceUrl: string; evidence: string }>) => ({
  verdict: "supported" as const,
  correction: "",
  sourceUrl: britannica.url,
  evidence: "The Estates-General had not met since 1614",
  ...over,
});

describe("settleVerdict", () => {
  it("accepts a verdict whose source was searched and whose evidence is on the page", () => {
    const check = settleVerdict("The Estates-General last met in 1614.", "blocks[2].text", judgement({}), [britannica]);
    assert.equal(check.verdict, "supported");
    assert.equal(check.source?.url, britannica.url);
  });

  it("matches a cited URL despite www, trailing slashes and query strings", () => {
    const check = settleVerdict("c", "w", judgement({ sourceUrl: "https://britannica.com/event/Estates-General/?utm=x" }), [britannica]);
    assert.equal(check.verdict, "supported");
  });

  it("downgrades a verdict citing a page the search didn't return", () => {
    const check = settleVerdict("c", "w", judgement({ verdict: "contradicted", sourceUrl: "https://made-up.example/page" }), [britannica]);
    assert.equal(check.verdict, "unclear");
    assert.match(check.downgraded!, /didn't return/);
  });

  it("downgrades a verdict whose quoted evidence isn't on the cited page", () => {
    const check = settleVerdict("c", "w", judgement({ verdict: "contradicted", evidence: "The Estates-General last met in 1789 under Louis XV" }), [britannica]);
    assert.equal(check.verdict, "unclear");
    assert.match(check.downgraded!, /evidence/);
  });

  it("reads a source written as a markdown citation and ignores the citation in the quote (run 12)", () => {
    const check = settleVerdict(
      "c",
      "w",
      judgement({
        sourceUrl: "[britannica.com](https://www.britannica.com/event/Estates-General?utm_source=openai)",
        evidence: "“The Estates-General had not met since 1614” ([britannica.com](https://www.britannica.com/event/Estates-General?utm_source=openai))",
      }),
      [britannica]
    );
    assert.equal(check.verdict, "supported");
  });

  it("keeps the correction of a well-sourced contradiction", () => {
    const check = settleVerdict(
      "The Estates-General last met in 1700.",
      "blocks[2].text",
      judgement({ verdict: "contradicted", correction: "It last met in 1614." }),
      [britannica]
    );
    assert.equal(check.verdict, "contradicted");
    assert.equal(check.correction, "It last met in 1614.");
  });
});

describe("lessonText", () => {
  it("leaves out wrong options, traps, misconceptions and code, and keeps the right answer", () => {
    const lesson = {
      title: "Why 1789?",
      objective: "Explain how debt, food prices and new ideas combined.",
      estimatedMinutes: 8,
      blocks: [
        { kind: "explain", title: "Debt", text: "By 1788 about half of royal spending went on debt interest." },
        { kind: "code", code: "print('the moon is made of cheese')", mode: "predict" },
        { kind: "problem", traps: [{ answer: "50", feedback: "That would mean bread cost nothing at all." }] },
        { kind: "explain", misconception: "Many people think the revolution began with the storming of a palace." },
      ],
      questions: [{ question: "Which pressure came first?", options: ["Debt crisis", "A moon landing"], correctAnswer: "Debt crisis", explanation: "The crown was out of credit." }],
    } as unknown as Lesson;
    const text = lessonText(lesson);
    assert.match(text, /debt interest/);
    assert.match(text, /questions\[0\]\.correctAnswer: Debt crisis/);
    assert.doesNotMatch(text, /moon/);
    assert.doesNotMatch(text, /cheese/);
    assert.doesNotMatch(text, /bread cost nothing/);
    assert.doesNotMatch(text, /palace/);
  });
});

describe("verifyFacts", () => {
  const lesson = { title: "t", objective: "o", estimatedMinutes: 5, questions: [] } as unknown as Lesson;

  it("turns contradicted claims into errors and failed searches into unclear claims", async () => {
    const deps: VerifyDeps = {
      extract: async () => [
        { claim: "The Estates-General last met in 1700.", where: "blocks[2].text" },
        { claim: "Louis XVI summoned the Estates-General in 1788.", where: "blocks[3].text" },
        { claim: "Necker was dismissed on 11 July 1789.", where: "blocks[4].text" },
      ],
      judge: async (_topic, claim) => {
        if (claim.startsWith("Necker")) throw new Error("search timed out");
        return claim.includes("1700")
          ? { judgement: judgement({ verdict: "contradicted", correction: "It last met in 1614." }), sources: [britannica] }
          : { judgement: judgement({ evidence: "had not met since 1614 when Louis XVI summoned it in 1788" }), sources: [britannica] };
      },
    };
    const report = await verifyFacts("The French Revolution", lesson, Date.now() + 60_000, deps);
    assert.equal(report.errors.length, 1);
    assert.match(report.errors[0], /1700.*contradicted by Estates-General \| Britannica.*1614/);
    assert.deepEqual(report.uncertain, ['blocks[4].text: "Necker was dismissed on 11 July 1789."']);
    assert.deepEqual(report.sources, [{ url: britannica.url, title: britannica.title }]);
  });
});

describe("evidenceOnPage", () => {
  const page =
    "The Schwarzschild radius of an object is proportional to its mass. Accordingly, the Sun has a Schwarzschild radius of approximately 3.0 km (1.9 mi), [6] whereas Earth's is approximately 9 mm (0.35 in) [6] ... Potential intermediate black";

  it("accepts a quote copied with citation marks dropped or stitched across a gap", () => {
    assert.equal(evidenceOnPage("Accordingly, the Sun has a Schwarzschild radius of approximately 3.0 km, whereas Earth's is approximately 9 mm.", page), true);
  });

  it("accepts a short, exact quote (a real one from run 08)", () => {
    const fizziq = "The range-angle graph has a bell-shaped curve, symmetric about 45°. Maximum range is achieved at 45°. Complementary angles give the same range.";
    assert.equal(evidenceOnPage("Maximum range is achieved at 45°.", fizziq), true);
  });

  it("rejects an invented quote, a short one with a changed number, and one too short to mean anything", () => {
    assert.equal(evidenceOnPage("The Sun's Schwarzschild radius was measured at 30 kilometres by NASA in 1998.", page), false);
    assert.equal(evidenceOnPage("Schwarzschild radius approximately 30 km", page), false);
    assert.equal(evidenceOnPage("Schwarzschild radius", page), false);
  });
});

describe("citations in the model's answer", () => {
  it("takes the URL out of a markdown link", () => {
    assert.equal(citedUrl("[ssec.si.edu](https://ssec.si.edu/stemvisions-blog/what-photosynthesis)"), "https://ssec.si.edu/stemvisions-blog/what-photosynthesis");
    assert.equal(citedUrl("https://example.org/a"), "https://example.org/a");
    assert.equal(citedUrl(""), "");
  });

  it("cuts citations and links from a quote", () => {
    assert.equal(quoteOnly("“Plants are mostly water.” ([asu.edu](https://asu.edu/x))"), "“Plants are mostly water.”");
    assert.equal(quoteOnly("Plants are mostly water. https://asu.edu/x"), "Plants are mostly water.");
  });
});
