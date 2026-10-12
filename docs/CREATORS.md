# Creator partnerships: playbook

Written 2026-10-12. For the founders running creator partnerships. It builds
on [GTM.md](GTM.md) (creators are channel 3) and [ECONOMICS.md](../ECONOMICS.md).
Numbers marked **estimate** should be replaced with measured ones as soon as
real referrals come in.

## Why creators

Our first audience (curious adults who already pay to learn history,
philosophy and science; see [MARKET_RESEARCH.md](MARKET_RESEARCH.md)) already
follows creators they trust. Brilliant grew largely by sponsoring science
and maths YouTubers with a personal link and a discount. Wondersity can offer
creators something a sponsor can't: **a course that goes with their
episode**, so the plug extends their content instead of interrupting it.

## The offer

| Level | What the creator gets | What we need | When |
| --- | --- | --- | --- |
| 1. Referral partner | A personal link (`wondersity.com/?ref=CODE`), a discount for their audience, a revenue share | A partner row and a Paddle discount | Now |
| 2. Companion course | A co-branded page for one of their episodes (`/c/<slug>`) with their video, "a companion course with <name>", and the same revenue share | A companion row per episode | Now |
| 3. Reviewed course | They approve the course plan; credited as "reviewed by"; a higher share | A review flow (not built) | After 10+ active partners |
| 4. The creator as guide | Their portrait (and possibly voice) as the lesson's guide | A written likeness and voice licence; a code change (today the guide is never a living person) | Only with a signed agreement |

Start everyone at level 2: it costs nothing to make a companion page, and it
gives them a better thing to say than "use my code".

### Standard terms (proposal)

- **Revenue share: 30% of net revenue for 12 months** from each subscriber
  they refer. "Net" means after Paddle's fee (about 5% + $0.50 per sale),
  taxes and refunds. Typical app affiliate terms are 20-30% recurring for 12
  months ([Tapfiliate](https://tapfiliate.com/blog/best-creator-affiliate-programs-to-join-gp/)).
- **Audience discount: 10% off the first payment**, as a Paddle discount
  code attached to the partner.
- **Attribution:** a 30-day cookie; the first creator a visitor came from
  gets the credit. A learner's referral is saved when they finish onboarding,
  and travels with them to checkout.
- **Payouts:** monthly, once at least $25 is owed, by Wise or PayPal, from
  query 9 in `supabase/queries/metrics.sql` checked against Paddle's
  transactions. Move to an affiliate tool when manual payouts take more than
  an hour a month (see "Tracking and payouts").
- **Disclosure:** creators must say it's a paid partnership (FTC rules in
  the US, ASA/CAP in the UK). The companion page says so too.
- **No exclusivity**, and either side can end it with 30 days' notice;
  subscribers already referred keep earning for their 12 months.

### Why 30% of net and 10% off (the arithmetic)

Per referred yearly subscriber, first year (**estimates**, AI cost from
ECONOMICS.md at ~15 lessons a month and ~$0.28 a lesson ≈ $4.20 a month):

| Offer | Learner pays | After Paddle fee | Creator gets | AI cost | We keep |
| --- | --- | --- | --- | --- | --- |
| 30% of gross, 20% off | $95.99 | ~$90.70 | $28.80 | ~$50 | **~$12** |
| **30% of net, 10% off** (proposed) | $107.99 | ~$102.10 | $30.60 | ~$50 | **~$21** |
| 30% of net, no discount | $119.99 | ~$113.50 | $34.00 | ~$50 | ~$29 |

Year one is thin for heavy users and much better for typical ones (AI cost
falls with the cheaper staging and with fewer lessons a month). Renewals
earn no commission after 12 months. A monthly subscriber is worth more per
month: $19.99 → ~$18.50 after fees, ~$5.55 to the creator, ~$4.20 AI,
~$8.75 to us.

The GTM plan's ceiling is **$35 to acquire one paying subscriber**; a
revenue share is always under it, and it's paid only when someone pays. Flat
fees ($100-2,500 a video) come later, once we know a creator's conversion.

## Who to approach

**Profile:** 5k-100k followers, posting regularly in history, philosophy,
science or maths explainers; on YouTube, a podcast or Substack; English;
audience mostly adults. Small creators reply to cold email, charge little,
and their audiences trust them.

**Where to find them:** YouTube search for specific topics we teach well
("why did Rome fall", "stoicism explained", "event horizon"), sorted by
upload date; podcast charts in History, Philosophy and Science; Substack's
history and philosophy categories; the creators other creators collaborate
with.

**Score each one (1-3 on each, keep 10+):**

| | 1 | 3 |
| --- | --- | --- |
| Topic fit | Loosely related | Topics Wondersity already teaches well (try one first) |
| Audience | Kids or broad entertainment | Adults who comment with questions |
| Engagement | Under 1% comments/likes per view | Active comments, returning viewers |
| Openness | Never mentions sponsors | Already does sponsor reads or affiliate links |

Shortlist 40, contact 10 a week (GTM.md, phase 4 onwards).

## Outreach

**First email** (short, specific, about their work):

> Subject: A course to go with your "<episode title>" episode
>
> Hi <name>,
>
> I loved <specific moment in a specific episode>. I'm building Wondersity, which
> turns a topic into a short hands-on course: you predict, sort, simulate and
> answer checks instead of just reading, and every lesson's facts are checked
> against sources before anyone sees it.
>
> I made a companion course for that episode: <link to /c/slug>. Your
> viewers could take it after watching. If you'd like to share it, you'd get
> 30% of what anyone who subscribes through it pays for their first year,
> and your audience would get 10% off.
>
> Happy to change anything in the course, or to make one for another
> episode. Either way, thanks for the episode.
>
> <name>, Wondersity

**Follow-up** after 5-7 days, once: one line, plus a screenshot of the
companion page with their video on it.

**What to send with a yes:** their link and code, their companion page,
three lesson screenshots, a two-sentence description they can read on air,
and the disclosure line.

Before sending any email: **take the companion course yourself** (lessons 1
and 2), and fix anything wrong. One factual error in front of a creator's
audience costs more than the partnership earns.

## Setting a partner up

1. **Paddle discount** (once billing is on): Paddle → Catalog → Discounts →
   new discount, 10% off, one use per customer, code e.g. `HISTORYHUB10`.
2. **Partner row** (Supabase SQL editor, or `npx supabase db query --linked "…"`):

   ```sql
   insert into public.partners (code, name, url, discount_code, contact_email)
   values ('historyhub', 'History Hub', 'https://youtube.com/@historyhub', 'HISTORYHUB10', 'them@example.com');
   ```

   Codes are 2-31 lowercase letters, digits or dashes. Commission defaults
   to 30% for 12 months (`commission_pct`, `commission_months`).
3. **Companion page** for an episode:

   ```sql
   insert into public.companions (slug, partner_code, topic, title, blurb, video_url)
   values ('historyhub-fall-of-rome', 'historyhub', 'The fall of the Western Roman Empire',
           'Why Rome fell, hands-on',
           'Watch the episode, then work through the causes yourself: money, migration, armies and politics, one decision at a time.',
           'https://www.youtube.com/watch?v=VIDEO_ID');
   ```

   The page is `/c/historyhub-fall-of-rome`. The topic is what Wondersity plans
   the course on, so make it specific.
4. **Their links:** the companion page, and for anything else
   `https://<our domain>/?ref=historyhub`.
5. **Ending a partnership:** `update public.partners set active = false where code = '…';`
   (their pages stop working; referrals already saved stay for payouts).

## Tracking and payouts

- **Query 9** in `supabase/queries/metrics.sql`: per partner, signups,
  subscribers, paying now, and an estimated monthly commission from list
  prices. Check it against Paddle's transactions before paying.
- **When to adopt an affiliate tool:** once there are 10+ active partners or
  payouts take over an hour a month. FirstPromoter and Partnero advertise
  Paddle support, and Partnero documents Paddle Billing specifically
  ([Partnero](https://www.partnero.com/integrations/paddle),
  [FirstPromoter](https://firstpromoter.com/solutions/paddle-affiliate-software));
  Rewardful appears to cover only Paddle Classic. Test in Paddle's sandbox
  before committing (~$49 a month and up). Our own cookie and
  `customData.ref` can stay as the backup record.

## What to measure, and who to keep

Per partner, monthly: clicks (if their platform shows them), signups,
lesson 2 reached, paying subscribers, commission paid, and **commission per
paying subscriber**. Keep and deepen partners whose referrals reach lesson 2
at a good rate and convert; for those, offer a flat-fee integration or a
reviewed course. Quietly let the others lapse.

## Rules

- Never imply a creator wrote or endorsed lessons they haven't reviewed. The
  companion page says the course is written by Wondersity.
- Never put a living person's face or voice in a lesson without a signed
  licence. The code keeps guides to historical or invented figures.
- Every partner discloses the partnership.
- Pay on time, exactly as agreed. Small creators talk to each other.

## What's built and what isn't

Built: referral links and cookie (`?ref=`), partner and companion tables
(migration 007), companion pages (`/c/<slug>`), referral saved on the
learner's profile at onboarding and on the subscription at checkout, the
partner's Paddle discount applied at checkout, the payouts query.

Not built: a partner dashboard, automated payouts, click counts, reviewed
courses, creator guides, and courses that include the creator's own video in
"Go deeper" automatically.
