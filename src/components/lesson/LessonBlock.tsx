"use client";

import type { Block, Lesson } from "@/lib/lessonBlocks";
import { Activity } from "../activities/Activity";
import { QuizQuestion } from "../QuizQuestion";
import { CodeBlock } from "./CodeBlock";
import { ProblemBlock } from "./ProblemBlock";
import { DialogueBlock, ReflectBlock, WorkedBlock } from "./StepBlocks";
import { CompareBlock, ExplainBlock, SummaryBlock } from "./TextBlocks";

/** Renders one block of a lesson. Returns null for a block that points at nothing. */
export function LessonBlock({
  block,
  lesson,
  checkNumber = 0,
  checkCount = 0,
  onDone,
  onAnswer,
  lessonId = null,
  blockIndex,
}: {
  block: Block;
  lesson: Lesson;
  /** The saved lesson and this block's position in it, for answers graded on the server (reflections). */
  lessonId?: number | null;
  blockIndex?: number;
  /** For check blocks: its position among the lesson's checks (1-based) and how many there are. */
  checkNumber?: number;
  checkCount?: number;
  onDone: () => void;
  onAnswer: (questionIndex: number, chosen: string, correct: boolean) => void;
}) {
  switch (block.kind) {
    case "explain":
      return <ExplainBlock b={block} />;
    case "compare":
      return <CompareBlock b={block} />;
    case "summary":
      return <SummaryBlock b={block} />;
    case "activity": {
      const a = lesson.activities?.[block.ref];
      return a ? <Activity a={a} onDone={onDone} /> : null;
    }
    case "check": {
      const q = lesson.questions[block.ref];
      if (!q) return null;
      return (
        <div id={`check-${block.ref}`} className="scroll-mt-28">
          <QuizQuestion
            question={q}
            index={Math.max(0, checkNumber - 1)}
            label={checkCount > 0 ? `Check ${checkNumber} of ${checkCount}` : undefined}
            hints={block.hints}
            retry={block.retry}
            onAnswer={(chosen, correct) => onAnswer(block.ref, chosen, correct)}
          />
        </div>
      );
    }
    case "worked":
      return <WorkedBlock b={block} onDone={onDone} />;
    case "code":
      return <CodeBlock b={block} onDone={onDone} />;
    case "reflect":
      return <ReflectBlock b={block} onDone={onDone} lessonId={lessonId} blockIndex={blockIndex} />;
    case "dialogue":
      return <DialogueBlock b={block} onDone={onDone} />;
    case "problem":
      return <ProblemBlock b={block} onDone={onDone} />;
  }
}
