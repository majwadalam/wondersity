# Tailoring a course before it's planned

**Problem (2026-10-12):** clicking a topic planned a course right away. The tutor knew only the topic's name, so it guessed at everything else:
- what the learner wanted to be able to do,
- what they already knew,
- why they were learning it,
- what they were studying from.

Two learners who typed "Statistics", one for an exam on Friday and one checking A/B tests at work, got the same course.

This note records what the research says and what the harness now does about it. The code:
- `lib/intake.ts`: the brief, its limits, and how it's described to the models.
- `lib/coursePlan.ts`: the tailored planning guide and the rules checked in code.
- `lib/materials.ts`: the outline, storage and retrieval of the learner's materials.
- `components/app/StartCourse.tsx`: the start dialog.

## What the research says

**Plan backwards from outcomes.** Backward design starts from the results you want, then decides what evidence shows they were reached, and only then plans the teaching (Wiggins & McTighe, *Understanding by Design*, 2005). Constructive alignment says objectives, activities and checks should all aim at the same verbs (Biggs 1996). A vague wish has to become checkable outcomes before any levels are planned.

**Outcomes need observable verbs.** Bloom's revised taxonomy writes an objective as a thinking process plus a kind of knowledge (Anderson & Krathwohl 2001; Krathwohl 2002). "Understand X" can't be checked. "Explain", "calculate" and "diagnose" can. The taxonomy is a framework for writing objectives, not an experimental finding, and its order is a convention.

**Prior knowledge changes the format, not just the difficulty.** What the learner already knows matters most (Ausubel 1968). The expertise reversal effect shows that the help novices need can slow experienced learners down or hurt them (Kalyuga, Ayres, Chandler & Sweller 2003):
- Novices learn from worked examples and close guidance.
- Experienced learners do better with problems.

Self-ratings are unreliable, though: in one study of medical students they correlated negatively with actual scores. Pretesting helps learning in itself, even when the answers are wrong, as long as feedback follows (Richland, Kornell & Kao 2009).

**Learners' own goals help, if the choices stay few.**
- Choice raises motivation and effort. The effect is largest with 2-4 options and falls off after about 5 (Patall, Cooper & Robinson 2008, a meta-analysis of 41 studies).
- Specific goals beat "do your best" (Locke & Latham 2002).
- Setting your own written goals improved struggling students' grades in one small trial (Morisano et al. 2010).

**Context makes problems stick.** Rewriting maths problems around each student's own interests sped up mastery, and the gains lasted into later units, most for struggling students (Walkington 2013). How deeply problems are personalised matters (Walkington & Bernacki 2018).

**Grounding in the learner's own material.**
- The Harvard physics AI-tutor trial was built on the course's own content and gave larger gains than an active-learning class (Kestin et al. 2025). It was one course at one institution.
- CS50's bot is grounded in the course materials. The evidence for it is a deployment report, not a trial.
- Grounding is proposed to reduce invented facts, but the evidence so far is small pilots.
- Unguarded AI help can raise practice scores while lowering exam scores (Bastani et al. 2025).

So materials are a guide for the tutor, and the usual checks still apply.

**Don't ask about learning styles.** Matching teaching to a "visual" or "auditory" style has no rigorous support (Pashler, McDaniel, Rohrer & Bjork 2008). Match the teaching to the content instead.

**Spacing and retrieval.** Practice testing and spaced practice rate highest among study techniques; rereading rates low (Dunlosky et al. 2013). Later lessons should bring back earlier ideas.

**Form length.** The number of fields hurts more than the number of steps (Baymard Institute), and progressive disclosure moves secondary questions later (NN/g). No study gives a question count at which learners drop off, so the intake funnel should be measured rather than assumed.

## What the harness does

**Two ways in.** A new topic opens a dialog with two options:
- **Plan it for me:** one click, the same as before, and still able to use the shared plan cache.
- **Tailor it:** one screen. Only "What do you want to be able to do?" is required. Then:
  - why (5 chips, plus where they'll use it),
  - where they're starting (4 chips),
  - their materials.

  Behind "More options": what they already know, up to 6 things it must cover, and the length (short 4-5, standard 6-9, deep 9-12 lessons). Nobody is asked about learning styles.

**Outcomes first, checked in code.** For a tailored course, `create_course` must:
- give 2-4 outcomes that don't start with a vague verb (understand, know, learn…),
- tie every level to one outcome, with every outcome served by some level,
- list in each module which of the learner's "must cover" items it covers, with every item covered,
- fit the length they chose.

A plan that misses any of these goes back to the agent as an error to fix. The outcomes are shown on the course page under "Built for your goal".

**Starting point changes the lesson's shape.** The writer is given a format hint for the learner's starting point, from "worked examples and generous hints" (new) to "hard problems, edge cases, sparse hints" (knows it well). Because self-ratings are unreliable, the planner opens level 1 with a module that checks the foundations quickly.

**Their context sets the examples.** The learner's purpose and where they'll use it go into every lesson brief, so scenarios and problems can be set there "when it fits the idea; never force it". The reviewer scores fit to the brief, and a lesson that ignores it can't score above 7.

**Materials guide; they don't dictate.** Uploads are read on the server (PDF with page markers, Word, text, Markdown):
- A small model outlines them for the planner.
- They're stored in passages with embeddings (`course_materials`, private, deleted with the course).
- Each lesson gets the 4 passages closest to its module.

The writer follows the materials' terms and examples and cites them by name and page. If a passage disagrees with established fact, the lesson teaches the fact and says how the material differs. Arithmetic and web fact checks run as usual. Every prompt frames the material as data, never as instructions.

**Tailored courses stay private.** They never use or seed the shared plan cache or shared lessons. The materials' text leaves the job row once the course is made.

## Not done yet

- A short placement check in lesson 1 that can override the learner's self-rating (the research favours it over self-ratings alone).
- Deadlines and spaced review timed to them (Cepeda et al. 2008).
- Letting the learner edit the outcomes after planning.
- Measuring the dialog: how many choose each path, and where people stop.
