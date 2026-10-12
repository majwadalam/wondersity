# Economics: what Wondersity costs, what to charge, what it could make

Written 2026-10-11, updated 2026-10-12. Prices change; check the sources
before quoting them publicly. Figures marked **measured** come from our own
runs; the rest are estimates until real usage replaces them. Every tutor run,
staging and world painting is now stored with its real cost in the `runs`
table; queries 10-13 in `supabase/queries/metrics.sql` give cost per lesson,
per learner and the plan cache's hit rate.

## In plain words

We sell a **subscription**, not courses. A subscriber gets a tutor that makes
them a course on any topic they name, at their level, and adapts each lesson
to their mistakes; no two learners' courses end up the same. Free users get
the first 2 lessons of any course to try it; Pro is $19.99 a month or $119.99
a year.

It isn't unlimited: Pro covers up to 60 new lessons every 30 days (about 2 a
day), with paintings for 30 of them. We make money because a lesson costs us
~$0.25-0.31 to make and a typical learner takes ~15 a month (~$4.20), while
the plan brings in ~$9.45 (yearly) or ~$18.50 (monthly) a month after
Paddle's fee. A subscriber only costs more than they pay past ~34 lessons a
month on the yearly plan or ~66 on the monthly one.

## Models

GPT-6.1 Sol writes lessons, runs the tutor agent and reviews lessons
(`OPENROUTER_MODEL` and `REVIEW_MODEL`). It was the best value of the writers
compared (see HARNESS.md, "Choosing the models"):

| Writer | Cost per lesson | Fixed-reviewer score | Notes |
| --- | --- | --- | --- |
| GPT-6.1 Sol | ~$0.06 alone, ~$0.04 per lesson incl. review in the new gate | 7.9 | 6 of 6 passed on the first draft |
| GPT-6 Sol | ~$0.09 | 7.9 | Same price list as 6.1, more tokens |
| Claude Opus 5.5 | ~$0.18, ~$0.35 with a revision | 7.0-7.8 (by the Sol reviewer) | 4-8x Sol, not better here |
| GPT-6 Luna | ~$0.003 alone, ~$0.025 incl. Sol review | 7.2 | 1 of 6 reached the bar |
| Claude Haiku 5.5 | ~$0.013 | 6.7 | |
| DeepSeek V4.1 Flash | ~$0.025 | 6.4 | Hidden reasoning makes it costlier than its list price |
| GLM 5.3 Flash | ~$0.006 | 5.5 | Fastest; taught a wrong sum |

Sol reviewing Sol is self-review; arithmetic is checked in code
(`lib/factCheck.ts`) to cover the errors self-review misses. A reviewer from
another family (DeepSeek) adds about $0.004 per lesson.

## What a course costs us

| Per lesson | Cost | Basis |
| --- | --- | --- |
| Writing and review (GPT-6.1 Sol) | ~$0.04-0.08 | **measured**; more when a revision runs |
| Tutor agent turns | ~$0.015 | estimate |
| Staging: guide, scenes, lines (one Sol call) | ~$0.045 | estimate |
| Scene paintings (up to 3 at ~$0.035, Nano Banana 2.1) | ~$0.09 | image list price |
| Guide's voice (gpt-audio-mini, cached by words) | ~$0.01 | estimate |
| Online fact check (up to 8 searches at ~$0.007 plus model tokens) | ~$0.06-0.12 | estimate; added after this table was first written |
| "Go deeper" resources (one small-model call, two web searches) | ~$0.02 | estimate |
| Staging moved to GPT-6 Luna | about -$0.04 | estimate; done |
| **Per lesson** | **~$0.25-0.31** | |

Once per course: world painting and guide portrait, about $0.07.

**A 9-lesson course costs about $2.50-3.** Paintings and the online fact
check are the biggest parts. The margins below were worked out at ~$0.21 per
lesson; with the fact check, typical-user profit falls by about $1 a month.

Cheaper options, not yet built:

- Staging on GPT-6 Luna instead of Sol: about $0.04 less per lesson.
- 1-2 scenes per lesson instead of up to 3: about $0.03-0.06 less.
- Together: about $0.10 per lesson, roughly $1 per course.
- Write only one lesson ahead, so we don't pay for lessons nobody opens.

Hosting (Supabase, Vercel) is small next to model costs at these volumes.

## What others charge (US list prices, 2026)

| Product | Monthly | Yearly | What it is |
| --- | --- | --- | --- |
| Brilliant (closest to us) | $24.99-27.99 | ~$162 | Interactive lessons, subscription |
| Duolingo Max | $29.99 | $168 | AI tutor for languages |
| Skillshare | ~$14 billed yearly | ~$168 | Video library |
| Udemy Personal Plan | $19-32 | $156-240 | Video library |
| Udemy single course | | | $10-20 on sale; average paid about $18.60 (2023) |
| Coursera Plus | $59 | $399 | Courses with certificates |
| MasterClass | | $120-240 | Celebrity video |
| Khanmigo | $4 | $44 | Non-profit, subsidised |

Apart from Khanmigo, the field charges $120-240 a year, and pays for filmed
or hand-built content, or gives instructors a share of each sale. Our content
costs about $2 per course and is made for any topic on request.

## Recommended pricing

- **Free:** plan any course and take its first 2 lessons (about $0.50 per
  signup to us).
- **Monthly: $19.99.** Below Brilliant and Duolingo Max.
- **Yearly: $119.99 ($10 a month)**, the plan to lead with: 59-66% of
  education subscribers choose yearly (RevenueCat).
- **Fair use: 60 new lessons every 30 days** (2 a day; built in `lib/plans.ts`), so a single heavy
  user can't cost more than they pay.
- **Optional: one course for $9.99**, for people who would buy a Udemy course
  but won't subscribe.

The pricing page still says "Free while in beta" and marks paid plans
"Coming soon"; keep it that way until payments exist.

## What we'd make

Per subscriber per month, after about 3% card fees, for a typical learner
taking about 15 lessons a month:

| Plan | Revenue kept | AI cost | Gross profit |
| --- | --- | --- | --- |
| Monthly $19.99 | ~$19.10 | ~$3.15 | ~$16 (83%) |
| Yearly $119.99 | ~$9.70 | ~$3.15 | ~$6.50 (67%) |
| Yearly, with the cheaper staging | ~$9.70 | ~$1.50 | ~$8.20 (85%) |
| Heaviest user, 60 lessons/month, yearly | ~$9.70 | ~$12.60 | Loss, unless costs are cut |

Selling through the App Store or Google Play costs another 15-30% of the
price.

With 60% of subscribers yearly and 40% monthly, revenue is about $14 per
subscriber per month:

| Subscribers | Revenue a year | After AI costs (approx.) |
| --- | --- | --- |
| 1,000 | ~$168k | ~$130k |
| 10,000 | ~$1.7M | ~$1.3M |

## Break-even and the cap

| Plan | Kept after Paddle's fee | Lessons a month before a subscriber costs more than they pay (~$0.28 each) |
| --- | --- | --- |
| Monthly $19.99 | ~$18.50 | ~66 |
| Yearly $119.99 | ~$9.45 a month | ~34 |

At the 60-lesson cap the worst case is ~$14 a month of AI (30 painted
lessons at ~$0.28, 30 plain at ~$0.19): still profitable on the monthly plan,
a small loss on the yearly one, for the very few who learn that much. The cap
was first set at 150, which would have let one yearly subscriber cost ~$31 a
month against ~$9.45; it was lowered to 60.

**Later: Pro Plus**, a higher tier for people who genuinely learn more than 2
lessons a day, once the runs table shows how many there are.

## Making lessons cheaper

- **Course plans are cached per topic** (`course_plans`): a learner with no
  other courses who asks for a topic someone else already started gets the
  same plan and the same painted world, with no planning call and no new
  painting (about $0.04-0.06 saved per course, and the course appears at
  once). Plans made for learners with history aren't cached, because they're
  tailored to it. Needs `SUPABASE_SECRET_KEY` on the server to fill the cache.
- **Matched by meaning, not wording** ("Stoicism" = "stoic philosophy"), with
  a small model confirming it's the same course (~$0.001 per new course).
- **Lesson 1 is cached per shared plan** once it passes every check, with its
  scenes and "Go deeper" once painted: a new learner on a repeat topic gets
  lesson 1 at ~$0 instead of ~$0.28. Since every free signup takes lesson 1,
  this is the biggest saving on the free tier.
- Staging on GPT-6 Luna (done) and fewer scenes per lesson (not yet).

## Risks in these numbers

- **Free users cost money.** If 2-5% of free signups pay (an assumption; no
  reliable education figure was found), each subscriber carries 20-50 free
  users: $10-25 of free usage. Keep the free tier small, or use a 7-day trial;
  RevenueCat reports education users who start on a trial are worth about 50%
  more over time than those who buy directly.
- **Yearly renewals are weak in education:** about 24% renew (RevenueCat).
  Most of the value is in year one, so habit-building matters.
- **Usage is assumed, not measured.** 15 lessons a month is a guess until
  real learners use it.
- **Competitor prices** come mostly from review sites that differ slightly
  from each other, and vary by country and promotion.

## Next steps

1. Top up OpenRouter and read real per-run costs from `run.cost` to replace
   the estimates above.
2. Build the cheaper staging (Luna, fewer scenes) and a monthly lesson cap.
3. Choose free tier vs 7-day trial.
4. Add Stripe and put the prices on the pricing page.

## Sources

- [Brilliant Premium](https://brilliant.org/premium/), [e-student Brilliant review](https://e-student.org/brilliant-org-review/), [Headway on Brilliant](https://makeheadway.com/blog/brilliant-review/)
- [Skillshare cost (Upskillwise)](https://upskillwise.com/skillshare-cost/), [e-student Skillshare review](https://e-student.org/skillshare-review/)
- [Udemy cost (Upskillwise)](https://upskillwise.com/udemy-cost/), [Udemy by the numbers (Class Central)](https://www.classcentral.com/report/udemy-by-the-numbers/), [Udemy instructor revenue share (Ruzuku)](https://www.ruzuku.com/compare/udemy-pricing)
- [Coursera Plus pricing](https://thepivotwave.com/blog/coursera-pricing/), [MasterClass cost (Upskillwise)](https://upskillwise.com/masterclass-cost/)
- [Duolingo cost (dealnews)](https://www.dealnews.com/features/duolingo/cost/), [Khanmigo pricing](https://www.khanmigo.ai/pricing)
- [RevenueCat State of Subscription Apps 2026](https://www.revenuecat.com/state-of-subscription-apps), [RevenueCat renewal rates by category](https://www.revenuecat.com/blog/growth/average-subscription-renewal-rates-by-app-category), [Trial vs direct-purchase LTV summary](https://chuvak-pavel.medium.com/state-of-app-monetization-2026-key-trends-from-revenuecat-and-adapty-8bdc23a4bb6f)
- Model prices: [OpenRouter models API](https://openrouter.ai/api/v1/models), queried 2026-10-11
