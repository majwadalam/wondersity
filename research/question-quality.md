# Checks that make learners think

**Problem (2026-10-12):** the tutor's knowledge checks were often obvious:
- The right answer was the only option that used the lesson's key words, and often the longest.
- Hints pointed straight at the answer.
- Wrong options were ones nobody would pick.

So a learner could pass a check without understanding the idea, and a passed check said little about what they had learned.

This note records what the research says and what the harness now does about it. The code is `lib/questionCheck.ts` (checks in code), `lib/blindCheck.ts` (the blind test) and the QUESTIONS section of the lesson guide in `lib/lessonDesign.ts`.

## What the research says

**Testwise cues.** Learners who know how tests work can answer a flawed item without the knowledge it tests. The standard item-writing guidelines (Haladyna, Downing & Rodriguez 2002, a review of 31 guidelines; the NBME item-writing guide) list the cues:
- The right answer is the longest or most detailed option.
- The right answer repeats words from the question ("clang").
- Absolute words ("always", "never") appear in wrong options.
- Grammatical mismatches between question and option.
- "All/none of the above".
- Options that converge on the right one.
- Right answers that cluster in certain positions (Attali & Bar-Hillel 2003).

**Models keep writing these cues.** Studies of model-written questions find the same flaws persist even when the model is told to avoid them, above all the longest-answer cue (QuestionWell) and implausible wrong options (University of Michigan, 2024).

Models can also often pick the right option from the choices alone, without the question (Balepur et al., ACL 2024). That makes "show only the options" a usable automatic test.

**Rules beat a model reviewer at finding flaws.** A rule-based checker found 91% of human-annotated item flaws, against 79% for GPT-4 (Moore et al. 2023). So the cues code can see are checked in code, and the model reviewer handles what code can't.

**Wrong options should come from real misconceptions.** The most useful wrong options are the most popular wrong ideas learners actually hold (Sadler 1998; the Force Concept Inventory). Three plausible options beat four with one filler (Rodriguez 2005).

**Difficulty matters.** Retrieval that takes effort helps memory: the testing effect (Roediger & Karpicke 2006) and desirable difficulties (Bjork 1994). A check most learners get right first time, but not all, is the target. The "85% rule" (Wilson et al. 2019) comes from machine learning, so treat it as a hint, not a fact about people.

**Hints should scaffold, not hand over the answer.** Graduated hints work. Hints that give the answer invite clicking through to it (Aleven & Koedinger's help-seeking research; VanLehn 2011).

## What the harness does

| Rule | How it's enforced |
| --- | --- |
| Right answer not the longest | Code: flagged if it's the longest and more than 1.3× the wrong options' mean length; also flagged across the lesson if it's the longest in most questions |
| No word echo | Code: flagged if a content word of the right answer is in the question and in no wrong option, and the right answer shares the most of the question's words |
| No absolute words only in wrong options | Code |
| No "all/none of the above", "both A and B" | Code |
| Answerable before reading the options; no "which of the following is true" | Code (the wording), guide |
| Hints don't give the answer away | Code: flagged if a hint uses words found only in the right answer |
| A typed problem doesn't state its answer | Code |
| Answer position | Code: options are sorted and shuffled with a seed from the question when a lesson is saved, so the writer's order never reaches the learner |
| Options don't give the answer away | Blind test: GPT-6 Luna sees only each question's options and guesses; a confident right guess caps the lesson's score at 7.5, so it's revised |
| Wrong options from real misconceptions, new situations, rising difficulty | Guide and reviewer rubric |

The flags found in code go to the reviewer (each one should lower the score) and to the reviser with the lesson's other problems.

## Still to do

- Measure difficulty from real answers. `attempts` records every first answer. A check that more than 90% get right first time is too easy, and one under 40% is broken or confusing. Query 4 in `supabase/queries/metrics.sql` lists the hardest checks; add the easiest.
- Ask the writer for the misconception behind each wrong option, as its own field. The wrong-answer feedback could then name the learner's mistake.

## Sources

- Haladyna, Downing & Rodriguez (2002), Applied Measurement in Education 15(3): https://experts.umn.edu/en/publications/a-review-of-multiple-choice-item-writing-guidelines-for-classroom/
- NBME item-writing guide: https://ucns.org/common/Uploaded%20files/Help/NBME%20Item%20Writing%20Guide.pdf
- Brame, Vanderbilt Center for Teaching (2013): https://cft.vanderbilt.edu/guides-sub-pages/writing-good-multiple-choice-test-questions
- Sadler (1998), distractor-driven assessment: https://users.nber.org/~sewp/events/2004.05.28/Sadler_PsychometricModels.pdf
- Rodriguez (2005), three options are optimal (summary): https://tipsforteachers.substack.com/p/research-bite-20-three-options-are
- Attali & Bar-Hillel (2003), answer position: https://www.nite.org.il/wp-content/uploads/2018/06/e286_abstract.pdf
- Wilson et al. (2019), the 85% rule: https://pmc.ncbi.nlm.nih.gov/articles/PMC6831579
- Desirable difficulties and the testing effect: https://pmc.ncbi.nlm.nih.gov/articles/PMC4888598
- Balepur et al. (2024), answering from the choices alone: https://arxiv.org/abs/2402.12483
- Moore et al. (2023), rules vs GPT-4 at finding item flaws: https://arxiv.org/pdf/2307.08161
- QuestionWell, flaws in model-written questions: https://questionwell.org/hubfs/Papers/mcq-paper-llncs-main.pdf
- Implausible wrong options in model-written questions (U. Michigan): https://public.websites.umich.edu/~kevynct/pubs/L_S_2024_WorkInProgress_Question_Generation_CRFinal2.pdf

Some details above come from secondary summaries (the Vanderbilt guide and the Rodriguez figures), not the original papers.
