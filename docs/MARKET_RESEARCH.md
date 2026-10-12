# Wondersity: market research

Written 2026-10-11. Wondersity is in free beta with no real users, so nothing here
describes Wondersity traction. Every outside number links to its source. Anything
we worked out ourselves is marked **Assumption** or **Estimate**. Many
market and pricing figures come from vendor blogs and market-research
summaries that disagree with each other; where they do, the range is given
and the weakest sources are flagged.

## Contents

1. [What we are selling](#1-what-we-are-selling)
2. [Market sizing](#2-market-sizing)
3. [Competitive landscape](#3-competitive-landscape)
4. [Customer segments and the beachhead](#4-customer-segments-and-the-beachhead)
5. [Trends and risks](#5-trends-and-risks)
6. [User-research plan](#6-user-research-plan)
7. [Sources](#7-sources)

---

## 1. What we are selling

So the rest of this document stays honest, this is what the product does
today (from `AGENTS.md`, `ECONOMICS.md`, `CHANGES.md` and the landing page):

- A learner types any topic. An agent plans a course of 2-4 levels and 4-12
  modules. The plan opens in under a minute and lesson 1 is written while the
  learner looks at it.
- Each module is one 5-10 minute lesson built from interactive blocks:
  simulations, sort and order activities, graphs the learner reshapes, typed
  problems, code tracing, worked examples, dialogues, and 2-4 graded checks
  placed inside the lesson.
- Every lesson passes a quality gate before it is shown. A second model
  scores it, arithmetic is recomputed in code, and up to 8 factual claims are
  checked against web search. Confirmed sources are listed at the end of the
  lesson.
- The next lesson adapts to the learner's quiz mistakes.
- Lessons are staged with painted scenes and a voiced guide character (a
  historical figure for history or philosophy, an invented expert otherwise).
- Web app only (Next.js), Supabase accounts (Google or email). No mobile app,
  no payments, no uploads of the learner's own material, no spaced repetition
  yet.
- Current positioning on the landing page: courses for the topics nobody made
  a course for (too niche, too new, too scattered, or not at your level), for
  work and for curiosity.
- Cost to us: about $0.27-0.33 per lesson and $2.50-3 per 9-lesson course
  (`ECONOMICS.md`, mostly estimates; the writing part is measured).

Three things matter for go-to-market:

1. **The unit of value is a structured course on a topic the learner chose**,
   not an answer. This is the main difference from ChatGPT and Gemini.
2. **The product makes visual, shareable output.** Painted scenes, a guide
   character and interactive steps are good material for short video.
   ChatGPT-style text is not.
3. **Each lesson costs real money to make.** The free tier, the fair-use cap
   and paid acquisition all have to be planned around that.

---

## 2. Market sizing

### 2.1 Published top-down figures

| Market | 2025 size | Growth | Source | Notes |
| --- | --- | --- | --- | --- |
| Global e-learning (all segments) | $276B-370B | 7.7-12.7% CAGR | [IMARC](https://www.imarcgroup.com/e-learning-market) ($369.7B), [Arizton](https://www.arizton.com/market-reports/e-learning-market-size-2025) ($325B), [Maximize](https://www.maximizemarketresearch.com/market-report/e-learning-market/187622/) ($275.9B) | Includes corporate training, K-12 and higher-ed platforms. Far too broad to plan against. |
| AI tutors (global) | $2.1B | 30.5% CAGR to $17.7B by 2033 | [Grand View Research](https://www.grandviewresearch.com/industry-analysis/ai-tutors-market-report) | Data Bridge has nearly the same figure, [$2.15B](https://www.databridgemarketresearch.com/reports/global-ai-tutors-market). |
| AI tutors (conservative) | $3.55B | 12.7% CAGR to $6.45B by 2030 | [Mordor Intelligence](https://www.mordorintelligence.com/industry-reports/ai-tutors-market) | |
| AI tutoring (aggressive) | $6.6B | 32.4% CAGR | [MarketIntelo](https://marketintelo.com/report/ai-tutoring-market) | The high outlier. Don't quote it. |

These are paid-report summaries with undisclosed methods, and every firm
defines "AI tutoring" differently. They show the direction (AI tutoring is a
low single-digit billions market growing fast), not a number to plan on.

**Public reference points for consumer spending on self-directed learning:**

- Duolingo had **12.7M paid subscribers** and $250.3M in subscription
  bookings in Q2 2026, with 58.7M daily active users
  ([Duolingo 10-Q, Q2 2026](https://www.sec.gov/Archives/edgar/data/0001562088/000162828026053603/duol-20260630.htm);
  [Q2 2026 shareholder letter](https://investors.duolingo.com/static-files/3c8277ee-bc94-4f5d-9b77-0db3e46f88b8)).
  That is about $1B a year in subscription bookings from one consumer
  learning app.
- Coursera and Udemy merged in May 2026. The combined company reported more
  than $1.5B in 2025 revenue, and secondary summaries of its investor
  materials expect consumer revenue to decline
  ([Coursera 8-K via StockTitan](https://www.stocktitan.net/sec-filings/COUR/8-k-coursera-inc-reports-material-event-0f805b46228c.html);
  [Minichart summary](https://www.minichart.com.sg/2026/06/23/coursera-and-udemy-complete-merger-post-merger-strategy-financial-outlook-and-ai-driven-skilling-platform-for-2026/), secondary).
- Brilliant reports more than 10M registered users (registered, not active)
  ([Wikipedia](https://en.wikipedia.org/wiki/Brilliant_(website))). It does not
  publish revenue.

### 2.2 Demand signals

- **74% of US adults** had done at least one activity in the past year to
  learn about a personal interest. Only 16% of those took an online course
  ([Pew, 2016](https://www.pewresearch.org/internet/2016/03/22/three-quarters-of-adults-have-done-a-personal-learning-activity-in-the-past-year/)).
  The data is old, but it is the best US baseline we found. It shows a large
  appetite and low course uptake.
- **26% of US adults (46% of under-30s)** have used ChatGPT to learn
  something new ([Pew, June 2025](https://www.pewresearch.org/short-reads/2025/06/25/34-of-us-adults-have-used-chatgpt-about-double-the-share-in-2023/)).
- About **10% of ChatGPT consumer messages** are requests for tutoring or
  teaching ([OpenAI/NBER, "How People Use ChatGPT"](https://cdn.openai.com/pdf/a253471f-8260-40c6-a2cc-aa93fe9f142e/economic-research-chatgpt-usage-paper.pdf)).
- **51% of US YouTube users** say the site is very important for figuring out
  how to do things they haven't done before ([Pew, 2018](https://www.pewresearch.org/internet/2018/11/07/many-turn-to-youtube-for-childrens-content-news-how-to-lessons/)).

The demand to learn with AI already exists at scale. Most of it is served
for free by general chatbots, in unstructured form.

### 2.3 TAM / SAM / SOM for Wondersity (bottom-up)

Top-down market figures are too loose to use, so we size bottom-up from the
people Wondersity can actually reach: English-speaking adults on the web.

| Step | Figure | Basis |
| --- | --- | --- |
| US adults | ~260M | **Assumption** (rounded US adult population) |
| ...who used ChatGPT to learn something new | 26% → ~68M | [Pew 2025](https://www.pewresearch.org/short-reads/2025/06/25/34-of-us-adults-have-used-chatgpt-about-double-the-share-in-2023/) |
| Add UK, Canada, Australia, Ireland, NZ at a similar rate | ×1.4 → ~95M | **Assumption** (those countries' adult population is roughly 40% of the US's; adoption assumed similar) |
| **TAM**: English-speaking adults who already use AI to learn, × $120/yr | ~95M × $120 ≈ **$11B/yr** | **Assumption.** $120 is Wondersity's proposed annual price. The figure is theoretical: it means everyone pays. |
| Share who pay for any learning subscription or course today | 10% | **Assumption.** Duolingo alone has 12.7M payers worldwide ([10-Q](https://www.sec.gov/Archives/edgar/data/0001562088/000162828026053603/duol-20260630.htm)). We have no clean figure for English-speaking adults who pay for learning; 10% is a planning guess to test. |
| **SAM**: ~9.5M paying self-directed learners × $120/yr | **≈ $1.1B/yr** | **Assumption** |
| **SOM** (3 years): 0.1-0.3% of SAM | **~10k-30k subscribers, ≈ $1.7-5M ARR** at ~$14/month blended revenue | **Assumption.** $14 is the 60/40 yearly/monthly blend from `ECONOMICS.md`. For scale: Duolingo took years to reach its paid base. 10k subscribers would be a good outcome for a small team. |

What to take from this: the market is not the constraint. The constraints
are (a) getting people who already have ChatGPT to pay for structure, and
(b) keeping them past the first course. Section 5 covers both.

---

## 3. Competitive landscape

### 3.1 Direct competitors: AI course generators, AI tutors, interactive learning apps

Prices are US list prices found in October 2026. Many come from review
sites that disagree, so check them before quoting publicly.

| Product | What it is | Price | Strengths | Weaknesses vs Wondersity |
| --- | --- | --- | --- | --- |
| **Oboe** (closest direct competitor) | Type a learning goal and get an AI-generated course: chapters, quizzes, flashcards, an adaptive audio "podcast". Web first. From the Anchor co-founders. | Free (unlimited course generation, limited chapters); $15/mo ($144/yr); Pro $40/mo ($384/yr) ([TechCrunch, Dec 2025](https://techcrunch.com/2025/12/10/oboe-raises-16-million-from-a16z-for-its-ai-powered-course-generation-platform/)) | $20M raised ($4M seed, $16M Series A led by a16z); experienced consumer founders; generous free tier; audio format | Mostly reading, audio and quizzes. No simulations, typed problems or code tracing that we could find. We found no public claims of verifying facts. Same core promise ("any topic → a course"), so Wondersity must win on depth of interaction and trust, not on the idea. |
| **Brilliant** | Hand-built interactive STEM lessons (math, science, CS, data) | ~$24.99-27.99/mo, ~$162/yr ([e-student](https://e-student.org/brilliant-org-review/); [brighterly](https://brighterly.com/blog/brilliant-org-cost/)) | The standard for "learn by doing"; polished; 10M+ registered users ([Wikipedia](https://en.wikipedia.org/wiki/Brilliant_(website))); strong brand with curious adults | Fixed catalog, STEM only. Nothing on history, philosophy, a new work tool or a niche topic. Wondersity's interaction model is close to Brilliant's, applied to any topic. Brilliant's hand-built lessons are almost certainly more polished per lesson. |
| **Duolingo** (Max and non-language courses) | Gamified language app, plus math, music and chess ([chess launch](https://channel8.com/english/news/36531)); Max adds AI conversation | Max ~$29.99/mo, ~$168/yr ([dealnews](https://www.dealnews.com/features/duolingo/cost/)) | Best habit loop in the category (streaks); 58.7M DAU ([10-Q](https://www.sec.gov/Archives/edgar/data/0001562088/000162828026053603/duol-20260630.htm)); proof that adults pay for learning apps | Fixed subjects; short drill format, not conceptual depth. Duolingo is a benchmark for retention mechanics more than a direct rival. |
| **Khanmigo** | Khan Academy's AI tutor, mostly K-12 and teachers | Learners and parents $4/mo or $44/yr; free for teachers ([official](https://www.khanmigo.ai/pricing)) | Nonprofit trust; very cheap; school distribution | Tied to Khan's K-12 curriculum. It is not a course generator for adult topics. It sets a low price anchor in parents' minds. |
| **Synthesis Tutor** | AI math tutor for children, built on the Synthesis School brand | Family ~$29/mo or ~$119/yr; reports disagree ([brighterly](https://brighterly.com/blog/synthesis-tutor-cost/)) | Strong with homeschool parents; a deep, purpose-built math experience | Math only, ages ~5-11. Matters only if Wondersity goes after homeschool, which this document advises against for now. |
| **ChatGPT study mode** (OpenAI) | A Socratic mode inside ChatGPT that asks questions instead of giving answers. Launched July 2025 for Free, Plus, Pro and Team ([TechCrunch](https://techcrunch.com/2025/07/29/openai-launches-study-mode-in-chatgpt)); added to teen parental controls in 2026 ([secondary](https://www.winssolutions.org/chatgpt-study-mode-teen-controls/)) | Free with ChatGPT | Already where learners are; zero friction; any topic | Built on prompting, not a new model; the learner can switch back to plain answers at any time ([alternativeto](https://alternativeto.net/news/2025/7/chatgpt-launches-study-mode-to-foster-student-learning-and-critical-thinking)). No course plan, interactive activities, graded progress or verified sources. **This is the default Wondersity must beat in the learner's head.** |
| **Gemini Guided Learning** and **Learn Your Way** (Google) | Guided Learning: step-by-step tutoring in Gemini ([Technology Magazine](https://technologymagazine.com/news/guided-learning-googles-ai-tool-that-teaches-not-answers)). Learn Your Way: a research experiment (Sept 2025) that turns textbook material into personalised interactive lessons with quizzes, mind maps and audio ([Google blog](https://blog.google/products-and-platforms/products/education/learn-your-way/); [Google Research](https://research.google/blog/learn-your-way-reimagining-textbooks-with-generative-ai/)) | Free | Google's distribution; LearnLM models; Learn Your Way is close to Wondersity in concept | Learn Your Way starts from source material (textbooks), not from any topic, and is an experiment. Guided Learning is a chat. **If Google ships Learn Your Way broadly for any topic, it becomes the biggest threat.** |
| **NotebookLM** (Google) | Upload sources; get summaries, audio overviews, flashcards and quizzes with citations ([Google blog](https://blog.google/innovation-and-ai/models-and-research/google-labs/notebooklm-app-quizzes-flashcards/)) | Free tier; paid via Google AI plans | Very popular with students; grounded in the user's own sources | Needs the learner to bring sources. No course plan and no interactive activities. Wondersity fits the learner who has no material yet. |
| **Claude learning mode** (Anthropic) | A Socratic mode, launched with Claude for Education in April 2025 ([Anthropic](https://www.anthropic.com/news/introducing-claude-for-education)) | Paid Claude plans, mostly university deals | Strong university relationships | Chat format; aimed at higher-ed institutions. |
| **Speak** | AI conversation app for language speaking practice | ~$18-20/mo, ~$84-120/yr depending on region ([AIVario](https://aivario.com/tools/speak)); ~$1B valuation after a $78M Series C ([Tracxn](https://tracxn.com/d/companies/speak/__MGE4pNR9-6S7I4ZZgeMwZJZJ5Kr-QmtYxSsROAljqcM)) | Proves adults pay ~$100+/yr for an AI-native learning app | Languages only. Not a rival; a pricing comparison. |
| **Coursebox** | AI course *authoring* for trainers and businesses, with an LMS | 3 courses free, paid from ~$10/mo ([listing](https://www.coursebox.ai/)) | B2B, quick authoring for instructors | Built for course *creators*, not learners. Different buyer. |
| **Small "learn anything" apps** (Morso, NerdSip, "Learn Anything: Self study AI", Mindgrasp, StudyFetch) | Course or flashcard generators, often mobile, often weekly pricing | e.g. Morso from $1.99/wk ([morso blog](https://www.morso.app/blog/best-ai-learning-app)); Mindgrasp $5.99/mo ([studygenie](https://studygenie.io/blog/mindgrasp-ai-alternatives)) | Cheap; on app stores | Thin content; study-tool framing. They show the category is crowded at the low end and that "generate a course" alone is not a moat. |

We searched for 2026 seed-stage "learn anything" AI startups and found no
notable funded entrant beyond Oboe, only small app-store listings such as
[Learn Anything: Self study AI](https://play.google.com/store/apps/details?id=com.vijayt.learn).
Expect that to change quickly; check every quarter.

### 3.2 Indirect competitors

| Product | What it is | Price | Strengths | Weaknesses vs Wondersity |
| --- | --- | --- | --- | --- |
| **Udemy** (now part of Coursera) | Marketplace of instructor videos | Single courses $10-20 on sale; Personal Plan $19-32/mo ([Upskillwise](https://upskillwise.com/udemy-cost/)) | Huge catalog; cheap one-off purchases; strong for practical tech skills | Passive video, fixed content, quality varies, nothing on niche or brand-new topics. |
| **Coursera** | University and company courses, certificates | Coursera Plus $59/mo, $399/yr ([PivotWave](https://thepivotwave.com/blog/coursera-pricing/)) | Credentials; employer reimbursement | Long, formal courses; certificates are the product. Wondersity offers no credential. |
| **Skillshare** | Creative video classes | ~$168/yr ([Upskillwise](https://upskillwise.com/skillshare-cost/)) | Creative hobbies; strong creator affiliate engine | Passive video; creative skills Wondersity doesn't target. |
| **MasterClass** | Celebrity-taught video | $120-240/yr ([Upskillwise](https://upskillwise.com/masterclass-cost/)) | Prestige and entertainment value | Inspiration more than skill; no practice. Shows that curious adults pay ~$120-180/yr for "interesting". |
| **YouTube** (and podcasts) | Free explainers and lectures | Free | Unlimited supply, great creators, the default for most people | No plan, no practice, no check of understanding; the learner does all the structuring. It is also Wondersity's best acquisition channel (see GTM). |

### 3.3 Positioning map

Two axes describe the market best:

- **Horizontal: what can be learned.** A fixed catalog (left) to any topic
  the learner names (right).
- **Vertical: how learning happens.** Reading, watching or chatting (bottom)
  to structured, interactive practice with graded checks (top).

```
            Structured, interactive, graded
                        ▲
     Brilliant  ●       │                ● Wondersity (target)
     Duolingo   ●       │        ● Oboe (structured; mostly read/listen/quiz)
     Synthesis  ●       │    ● Learn Your Way (needs source material)
                        │
  Fixed catalog ────────┼──────────────────────────── Any topic
                        │
     Coursera   ●       │     ● NotebookLM (your sources)
     Udemy      ●       │                  ● ChatGPT study mode / Gemini Guided Learning
     MasterClass●       │                  ● ChatGPT / Gemini / Claude (plain)
     Skillshare ●       │       ● YouTube
                        ▼
            Passive (watch, read, chat)
```

The upper-right quadrant is the only one without a scaled leader. Oboe is
moving into it with $20M. Google is one product decision away with Learn
Your Way. That quadrant is open now, and it won't stay open: Wondersity's lead
has to come from **interaction depth and trust (verified, cited, graded)**,
because "AI makes a course on any topic" can be copied.

---

## 4. Customer segments and the beachhead

Willingness-to-pay evidence is from comparable products; none of it is
Wondersity data.

### Segment A: Curious adults who already pay to learn ("the autodidacts")

- **Who:** Adults, roughly 22-50, in English-speaking countries, who listen
  to history and science podcasts, watch explainer YouTube, and have paid
  for Brilliant, MasterClass, Blinkist, Nebula or similar. They have a list
  of topics they keep meaning to learn properly (the Byzantine Empire, the
  Socratic method, how vaccines work, music theory).
- **Pains:** YouTube and podcasts feel good but don't stick. No good course
  exists for their exact topic at their level. Chatting with ChatGPT has no
  plan and no end. Brilliant doesn't cover the humanities.
- **Current alternatives:** YouTube, podcasts, books, ChatGPT, Brilliant
  (STEM only), MasterClass.
- **Willingness to pay:** Brilliant ~$162/yr, MasterClass $120-240/yr,
  Duolingo Max ~$168/yr (sources in 3.1), all priced for this kind of buyer.
  80% of personal learners learn "to make their lives more interesting"
  ([Pew 2016](https://www.pewresearch.org/internet/2016/03/22/three-quarters-of-adults-have-done-a-personal-learning-activity-in-the-past-year/)).
- **How to reach them:** Short-form video, subject subreddits and Discords,
  history, philosophy and science podcasts and newsletters, and YouTube
  explainer creators.
- **Risk:** Low urgency, so retention depends on habit and delight.

### Segment B: Professionals learning a topic for work ("the upskillers")

- **Who:** Knowledge workers who need to understand something new quickly:
  cap tables for a first startup job, SQL window functions, GDPR basics for a
  product manager, a tool their team just adopted.
- **Pains:** Courses are long and generic. Docs assume prior knowledge.
  ChatGPT answers the question but doesn't build understanding. Time is
  short.
- **Current alternatives:** ChatGPT, Udemy, LinkedIn Learning, Coursera,
  internal docs, colleagues.
- **Willingness to pay:** Highest per person. About 47% of US employers
  offer tuition reimbursement, but only ~2% of employees use it
  ([SHRM figure via Compt](https://compt.io/blog/employee-stipend-statistics/), secondary). Employer
  stipends exist, but most require a receipt for a named course.
- **How to reach them:** LinkedIn, SEO for "learn X for work" searches,
  role-specific newsletters and communities, later team plans.
- **Risks:** Wondersity's own FAQ admits that AI knows least about very new
  topics, which is exactly what this segment needs most. ChatGPT is
  strongest here. There are no certificates.

### Segment C: Students revising for exams (16-24)

- **Pains:** Exam pressure and gaps in understanding.
- **Current alternatives:** ChatGPT (free), NotebookLM with their own lecture
  material, Quizlet, Khan Academy, StudyFetch and Mindgrasp ($6-8/mo).
- **Willingness to pay:** Low. Study tools sit at $5-8/mo, and the free
  options from OpenAI and Google are strong. 54% of US teens already use
  chatbots for schoolwork
  ([Pew, Feb 2026](https://www.pewresearch.org/internet/2026/02/24/how-teens-use-and-view-ai/)).
- **How to reach them:** TikTok, student subreddits, campus ambassadors.
- **Risks:** Wondersity can't ingest the syllabus or lecture slides, which is what
  students need. Users under 18 raise safety and consent requirements.
  Seasonal usage.

### Segment D: Homeschool parents

- **Who:** About 3.4M US K-12 homeschool students in 2024-25
  ([NHERI](https://nheri.org/how-many-homeschool-students-are-there-in-the-united-states/),
  an advocacy-affiliated source; federal estimates are lower), spending
  about $600 per student per year on materials (NHERI via
  [brighterly](https://brighterly.com/blog/homeschooling-statistics/)).
- **Pains:** Building curriculum for many subjects, especially electives and
  interest-led topics.
- **Willingness to pay:** Real, but anchored low (Khanmigo $44/yr;
  Synthesis ~$119/yr per family).
- **How to reach them:** Facebook groups, homeschool co-ops, curriculum
  review blogs.
- **Risks:** Children under 13 bring COPPA. The amended rule has applied in
  full since April 22, 2026
  ([Hunton](https://www.hunton.com/privacy-and-cybersecurity-law-blog/coppa-rule-amendment-compliance-deadline-approaches)).
  Wondersity's text and pacing are written for adults. Parents want alignment to
  standards and grade level, which Wondersity doesn't offer.

### Segment E: Hobbyists with a specific craft (music theory, chess, photography, cooking science)

- **Pains:** Want theory behind a hobby they already practise.
- **Current alternatives:** YouTube, hobby-specific apps (Duolingo music and
  chess, Yousician), forums.
- **Willingness to pay:** Proven in individual hobbies, but captured by
  specialist apps.
- **Fit:** Wondersity's playable sound and graph activities help. Many hobbies are
  physical, though, and Wondersity can't watch you play.
- **Treatment:** Not a separate beachhead. These are a sub-group of Segment A
  and a good source of topic ideas for content.

### Recommendation: beachhead = Segment A, curious adults who already pay to learn

Why A over the others:

1. **The product fits it best today.** Painted scenes, a guide character
   (Socrates for the Socratic method), narrative lessons and interactive
   activities are most valuable in history, philosophy and conceptual
   science. These are the subjects Brilliant doesn't cover and ChatGPT
   covers flatly. The landing page's own examples (Stoicism, the French
   Revolution, Babylonian numbers) are Segment A topics.
2. **Willingness to pay is proven at our price.** Brilliant, MasterClass and
   Duolingo Max charge this buyer $120-170 a year.
3. **Reachable cheaply.** These people gather around creators and
   communities organised by subject, and Wondersity's output is visual enough to
   spread as short video. Segment B is reached mostly through LinkedIn and
   SEO, both slower and more contested.
4. **Fewer blockers.** Adults only (no COPPA), no syllabus upload, no
   certificates, and no team purchase needed.
5. **Accuracy risk is manageable.** Established topics such as Stoicism or
   the Roman Republic are well covered by the web sources Wondersity's fact check
   uses. Brand-new work tools (Segment B) are where verification is weakest.

What would change the decision: if interviews (section 6) show Segment B
professionals hitting the "aha" moment more often and saying they'd pay, or
if Segment A activation is high but week-4 retention is very low (below ~10%
of activated users), switch the wedge to B. Keep Segment B as the explicit
second test from week 6 of the GTM plan. The landing page already mixes work
and curiosity topics, which helps.

---

## 5. Trends and risks

### 5.1 AI tutoring adoption and evidence

- **Adoption is mainstream among the young.** 46% of US adults under 30
  have used ChatGPT to learn something new
  ([Pew 2025](https://www.pewresearch.org/short-reads/2025/06/25/34-of-us-adults-have-used-chatgpt-about-double-the-share-in-2023/)),
  and 54% of teens use chatbots for schoolwork
  ([Pew 2026](https://www.pewresearch.org/internet/2026/02/24/how-teens-use-and-view-ai/)).
  The habit of learning with AI is forming now.
- **Well-designed AI tutoring can outperform good teaching.** In a Harvard
  randomized crossover trial (194 students, introductory physics), students
  using a carefully designed AI tutor had median learning gains more than
  double those from in-class active learning, in less time
  ([Kestin et al., Scientific Reports 2025](https://www.researchgate.net/publication/392839220_AI_tutoring_outperforms_in-class_active_learning_an_RCT_introducing_a_novel_research-based_design_in_an_authentic_educational_setting)).
  The caveat: one course, two topics, and a tutor built on research-based
  design, not a plain chatbot. That supports Wondersity's "structure plus
  practice" thesis, but it is not evidence that Wondersity works.
- **The big platforms are moving into "teaching mode."** OpenAI study mode
  (July 2025), Gemini Guided Learning (2025), Claude learning mode (April
  2025), Google Learn Your Way (Sept 2025), and NotebookLM quizzes and
  flashcards (sources in 3.1). Expect each to keep adding structure.

### 5.2 "Why not just use ChatGPT?" (the central objection)

Wondersity's answer has to be concrete and demonstrable in under a minute:

| ChatGPT / Gemini (incl. study modes) | Wondersity |
| --- | --- |
| One long thread; the learner has to know what to ask next | A course plan with levels and short lessons, one objective each |
| Mostly text; learning means reading | Activities: simulations, sorting, graphs, typed problems, code tracing |
| Study mode is optional; one click returns to plain answers | Checks are part of the lesson; first answers are graded on the server |
| Says nothing about its own accuracy | Every lesson is scored by a reviewer, arithmetic recomputed in code, claims checked against web search, sources listed |
| Doesn't remember what you got wrong in a usable way | The next lesson is built around your mistakes |
| Free | Paid after the free tier |

The honest weak point: a determined learner can get much of this from
ChatGPT with good prompts. Wondersity's bet is that most people won't do that
work, and that interaction plus verified accuracy is worth $10 a month.
**This is the riskiest assumption and is tested first (6.4).**

### 5.3 Trust and accuracy

- Students report fabricated citations, false information and overconfident
  answers as the main problems with AI tools, and novices are the least able
  to spot errors
  ([arXiv thematic analysis, 2026](https://arxiv.org/html/2602.17671v1);
  [review of GenAI in CS education](https://arxiv.org/pdf/2507.11543)).
- Wondersity's verification (cited sources, code-checked arithmetic, a second-model
  review) is a real differentiator, and the GTM leans on it. It also raises
  the stakes: one viral screenshot of a wrong "verified" fact would hurt
  more than it would hurt a chatbot. Mitigations: show "checked against N
  sources" only where true; put an easy "report an error" button on every
  step; publish an error log.

### 5.4 Retention benchmarks (the hardest problem in this category)

| Metric | Benchmark | Source |
| --- | --- | --- |
| Education app Day 1 / Day 7 / Day 30 retention | ~27.5% / 17.8% / 8.0% | [GetStream 2026](https://getstream.io/blog/app-retention-guide/) |
| Education Day 30 retention (low estimate) | ~2% | [Business of Apps](https://www.businessofapps.com/data/education-app-benchmarks/) |
| Education Day 1 / Day 30 (another estimate) | 30-42% / 5-9% | [Semnexus](https://semnexus.com/day-1-day-7-day-30-retention-benchmarks-app-category-2026) (secondary) |
| Annual subscription renewal, education | ~24% | [RevenueCat renewal rates](https://www.revenuecat.com/blog/growth/average-subscription-renewal-rates-by-app-category) (via `ECONOMICS.md`) |
| Download-to-trial, education (median) | 6.5% | [RevenueCat SOSA 2026, Education](https://www.revenuecat.com/state-of-subscription-apps-2026-education) |
| Median education price | $9.99/mo, $44.99/yr | same |
| Trial users' 12-month LTV vs direct buyers, education | +50.4% | [Adapty education benchmarks](https://adapty.io/blog/education-app-subscription-benchmarks/) |

These are mobile app benchmarks; Wondersity is a web app, so treat them as
directional. Most of a yearly subscriber's value comes in year one, and
"finishing a course" is a natural point where people churn. **Wondersity needs a
reason to start a second course** (recommendations, a "next course" built
from the first course's mistakes, spaced review). Spaced repetition is
already on the roadmap and matters for revenue, not just pedagogy.

### 5.5 Regulatory

- **COPPA (US, under 13).** The amended rule took effect June 23, 2025, and
  has been fully enforceable since April 22, 2026: separate parental consent
  before sharing children's data with third parties, data retention limits, a
  written security program
  ([Hunton](https://www.hunton.com/privacy-and-cybersecurity-law-blog/coppa-rule-amendment-compliance-deadline-approaches);
  [Securiti](https://securiti.ai/ftc-coppa-final-rule-amendments/)).
  Wondersity sends lesson content to third-party model APIs. **Action:** state
  "18+ (or 13+ with a parent)" in the terms, add an age confirmation at
  signup, and don't market to under-13s.
- **GDPR (EU/UK).** Lawful basis and privacy notice; data-processing
  agreements with Supabase, Vercel, OpenRouter and the model providers;
  transfer safeguards for US processing; export and deletion (Wondersity already
  has delete-all-data). The age of digital consent is 13-16 depending on the
  country ([GDPR Art. 8](https://gdpr-info.eu/art-8-gdpr/)).
- **EU AI Act.** AI that evaluates learning outcomes in education and
  vocational training is classed as high-risk. After the Digital Omnibus,
  the best available reading is that these Annex III obligations are
  deferred to December 2, 2027
  ([SIG summary](https://www.softwareimprovementgroup.com/blog/eu-ai-act-summary/));
  sources conflict, so confirm with counsel. A consumer hobby product that
  grades practice quizzes is probably not the target (institutions using AI
  for admissions or exam decisions are), but **don't sell to EU schools, or
  market any grade as a credential, before getting legal advice.**
- **Accuracy and consumer protection.** "Verified" claims in marketing must
  be substantiated. Say exactly what is checked (arithmetic in code; up to 8
  claims per lesson against web sources), not "fact-checked" in general.

### 5.6 Platform risks

| Dependency | Risk | Mitigation |
| --- | --- | --- |
| Model providers via OpenRouter (GPT-6.1 Sol, Nano Banana, gpt-audio-mini) | Price rises, deprecations, quality changes, rate limits | Already multi-model through OpenRouter. Keep the writer comparison script (`scripts/sample-lessons.ts`, `judge-lessons.ts`) as a monthly check. Keep a second writer qualified. |
| OpenAI / Google as competitors | Both supply models to Wondersity and compete with free study modes | Differentiate on the parts they don't ship: structured courses, activities, verification, a persistent course world. Avoid being only a thin layer over one model. |
| Google Search | AI Overviews cut clicks. Pew found users clicked a traditional result on 8% of visits with an AI summary vs 15% without ([Pew via SEJ](https://www.searchenginejournal.com/pew-research-confirms-google-ai-overviews-is-eroding-web-ecosystem/551825/)); Ahrefs found a 58% lower CTR for the top result ([Ahrefs](https://ahrefs.com/blog/ai-overviews-reduce-clicks-update)). Mass-generated pages risk Google's scaled-content-abuse policy ([Google Search Central](https://developers.google.com/search/blog/2024/03/core-update-spam-policies)). | Treat SEO as a slower, secondary channel. Publish real, quality-gated sample courses, not thousands of thin pages. |
| App stores (later) | 15-30% fee ([RevenueCat on Apple's rules](https://www.revenuecat.com/blog/growth/apple-anti-steering-ruling-monetization-strategy)) | Stay web-first with Stripe. On iOS in the US, link out to web checkout (allowed since May 2025; early data shows ~12% fewer initial conversions but ~20% higher net proceeds, [Superwall](https://superwall.com/blog/initial-data-is-in-app-to-web-conversion-rates-after-the-app-store-ruling), a vendor source). |
| Social platforms (TikTok, Reddit) | Algorithm and policy changes; Reddit bans self-promotion in many subreddits | Spread across 2-3 channels; build an email list from day one. |

---

## 6. User-research plan

The goal is to answer, within 4-6 weeks and for under $1,000, whether
Segment A will (1) finish lessons, (2) come back on their own, and (3) pay
about $10 a month.

### 6.1 Who to recruit

| Group | Number | Criteria | How to find them |
| --- | --- | --- | --- |
| Segment A core | 12-15 interviews | 22-50; paid for Brilliant, MasterClass, Duolingo Plus or Max, Blinkist, Nebula, or a Udemy course in the last 12 months; can name a topic they want to learn | Screener (below) posted in subject subreddits that allow research posts, history and philosophy Discords, the founders' own networks, a $50-75 Respondent or User Interviews budget for 5 people |
| Segment B comparison | 6-8 interviews | Knowledge workers who learned a new work topic in the last 3 months | LinkedIn posts, founder network, startup Slack groups |
| Lapsed Brilliant / Duolingo users | 4-5 | Paid and cancelled in the last 12 months | Same screener ("cancelled" branch); these explain churn |

Offer a $20-30 gift card or a year of Wondersity free when paid plans launch.
Screen out other founders and people building AI learning tools.

**Screener (5 questions):**
1. In the last 12 months, have you paid for any app, course or subscription
   to learn something not required for school? Which?
2. Is there a topic you've wanted to learn properly for a while but haven't?
   What is it?
3. How do you usually learn something new on your own? (YouTube, podcasts,
   books, ChatGPT or other AI, courses, other)
4. How old are you? (screen out under 18)
5. Are you free for a 30-minute video call this week?

### 6.2 Interview script (30 minutes; the last 10 are a live product session)

Past behaviour first, opinions last. Don't pitch before question 9.

1. Tell me about the last time you set out to learn something on your own,
   not for school. What was it, and why then?
2. Walk me through what you actually did, step by step. Where did you start?
3. How far did you get? What made you stop or keep going?
4. What did you use AI for in that, if anything? What worked and what
   annoyed you?
5. Have you ever paid to learn something on your own? What made it worth
   paying for? What made you cancel (if you did)?
6. Is there a topic you've wanted to learn but couldn't find a good course
   or resource for? Why didn't the existing options work?
7. When you learn something, how do you know you've really understood it?
8. How much time do you realistically have for this in a normal week? When
   in the day?
9. *(Live session.)* Here's Wondersity. Type that topic from question 6. Think
   aloud as you go. *(Watch the plan load and the first lesson; note where
   they hesitate, skim or smile.)*
10. What, if anything, was different from asking ChatGPT the same thing?
11. If this cost $10 a month billed yearly, or $20 month to month, what would
    you do? Who would you compare it to?
12. What would have to be true for you to still be using this in a month?

After the call, record: the topic, their current tools, what they paid for,
their reaction to the plan, whether they finished lesson 1, their exact words
on ChatGPT, their price reaction, and the lesson 2 date (did they come back
without a prompt? check `lesson_views`).

### 6.3 Short survey (to go with the landing-page test; ~3 minutes)

1. What topic would you want Wondersity to teach you first? (free text; this also
   builds a topic list for content)
2. Why do you want to learn it? (curiosity / work / study / a hobby / other)
3. How do you learn on your own today? (multi-select)
4. Have you paid for a learning app or course in the last 12 months? Which?
5. What frustrates you most about learning on your own? (free text)
6. How often would you realistically do a 10-minute lesson? (daily / a few
   times a week / weekly / less)
7. Van Westendorp pricing, monthly: at what price would Wondersity be so cheap
   you'd doubt its quality / a bargain / getting expensive / too expensive?
8. Can we email you when your course is ready? (email)

### 6.4 Riskiest assumptions and cheap tests

| # | Assumption | Why it's risky | Cheapest test | Pass / fail threshold (**Assumption**, set before running) |
| --- | --- | --- | --- | --- |
| 1 | **People who use ChatGPT will see Wondersity as different enough to come back.** | ChatGPT is free and already open. If Wondersity feels like "a nicer chat," nothing else matters. | **Unprompted return test.** Give 30-50 Segment A recruits access, ask nothing else, and measure how many finish lesson 1 and return for lesson 2 within 7 days on their own (using `supabase/queries/metrics.sql`). Pair it with interview question 10. | Pass: at least 40% of those who finish lesson 1 start lesson 2 within 7 days. Fail: under 20%. |
| 2 | **They will pay about $10 a month (billed yearly).** | Saying yes in an interview is not paying. The education median annual price is $44.99 ([RevenueCat](https://www.revenuecat.com/state-of-subscription-apps-2026-education)), well below $119.99. | **Fake-door pricing test.** After lesson 2, show a paywall with real prices and a "Start 7-day trial" button that collects an email and says "paid plans open on [date], you'll get [X] free". Split two price points ($119.99 vs $79.99 yearly). Later, run a **preorder**: a real Stripe charge for a discounted founding-member year. | Pass: at least 5% of users who reach the paywall click the trial at $119.99, and at least 10 real founding-member preorders from the first 300 activated users. |
| 3 | **Lessons stay accurate and good across the topics real people ask for.** | Real topics will be messier than our samples; one public error damages trust. | **Concierge quality audit.** For the first 100 real courses, a founder reads lesson 1 of each and logs errors by type and topic. Add a "report an error" button and count reports per 100 lessons. | Pass: under 1 substantive factual error per 20 lessons, and no error in a claim marked as confirmed. |
| 4 | **Segment A can be reached cheaply through short video and communities.** | If no organic channel works, paid acquisition doesn't pay back (see GTM, budget). | **Landing-page smoke test plus 20 short videos.** Post 20 videos of real lesson moments (scene, guide line, an activity) over 3 weeks on TikTok, Reels and Shorts, each linking to a topic-specific landing page with a waitlist and the survey. Compare with 3-4 Reddit or Discord posts and one $300 paid-social test. | Pass: at least one channel brings 300+ waitlist signups for under $1 each (including time valued at $0) or under $3 each paid; at least 25% of signups complete the survey. |

Run tests 1 and 3 together in weeks 1-4; test 4 starts at the same time
because it feeds recruits into 1. Run test 2 once test 1 passes. Testing
price on people who don't come back tells you nothing.

---

## 7. Sources

All sources are linked inline. Main ones:

- Market: [Grand View AI tutors](https://www.grandviewresearch.com/industry-analysis/ai-tutors-market-report), [Mordor](https://www.mordorintelligence.com/industry-reports/ai-tutors-market), [IMARC e-learning](https://www.imarcgroup.com/e-learning-market), [Duolingo Q2 2026 10-Q](https://www.sec.gov/Archives/edgar/data/0001562088/000162828026053603/duol-20260630.htm), [Coursera/Udemy 8-K](https://www.stocktitan.net/sec-filings/COUR/8-k-coursera-inc-reports-material-event-0f805b46228c.html)
- Demand: [Pew 2016 personal learning](https://www.pewresearch.org/internet/2016/03/22/three-quarters-of-adults-have-done-a-personal-learning-activity-in-the-past-year/), [Pew 2025 ChatGPT](https://www.pewresearch.org/short-reads/2025/06/25/34-of-us-adults-have-used-chatgpt-about-double-the-share-in-2023/), [Pew 2026 teens](https://www.pewresearch.org/internet/2026/02/24/how-teens-use-and-view-ai/), [OpenAI usage paper](https://cdn.openai.com/pdf/a253471f-8260-40c6-a2cc-aa93fe9f142e/economic-research-chatgpt-usage-paper.pdf)
- Competitors: [Oboe (TechCrunch)](https://techcrunch.com/2025/12/10/oboe-raises-16-million-from-a16z-for-its-ai-powered-course-generation-platform/), [Learn Your Way](https://blog.google/products-and-platforms/products/education/learn-your-way/), [ChatGPT study mode](https://techcrunch.com/2025/07/29/openai-launches-study-mode-in-chatgpt), [Khanmigo](https://www.khanmigo.ai/pricing), [NotebookLM](https://blog.google/innovation-and-ai/models-and-research/google-labs/notebooklm-app-quizzes-flashcards/), [Claude for Education](https://www.anthropic.com/news/introducing-claude-for-education)
- Benchmarks: [RevenueCat Education 2026](https://www.revenuecat.com/state-of-subscription-apps-2026-education), [Adapty Education](https://adapty.io/blog/education-app-subscription-benchmarks/), [GetStream retention](https://getstream.io/blog/app-retention-guide/), [Business of Apps](https://www.businessofapps.com/data/education-app-benchmarks/)
- Evidence and risk: [Kestin et al. RCT](https://www.researchgate.net/publication/392839220_AI_tutoring_outperforms_in-class_active_learning_an_RCT_introducing_a_novel_research-based_design_in_an_authentic_educational_setting), [COPPA amendments](https://www.hunton.com/privacy-and-cybersecurity-law-blog/coppa-rule-amendment-compliance-deadline-approaches), [EU AI Act summary](https://www.softwareimprovementgroup.com/blog/eu-ai-act-summary/), [Pew on AI Overviews (via SEJ)](https://www.searchenginejournal.com/pew-research-confirms-google-ai-overviews-is-eroding-web-ecosystem/551825/)
