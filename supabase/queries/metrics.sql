-- Is the product working? Run one query at a time in the Supabase dashboard:
-- SQL Editor → paste → Run. The editor sees every learner's rows (the app
-- never does). In-lesson numbers need lesson_views (migration 005), so they
-- start from the day it was applied; completions and answers go back further.


-- 1. The funnel: of the people who signed up, how many got how far.
with l as (
  select learner_id,
         count(*) filter (where completed_at is not null) as done
  from public.lessons
  where course_id is not null
  group by learner_id
)
select
  (select count(*) from auth.users)                                          as signed_up,
  (select count(distinct learner_id) from public.courses)                    as started_a_course,
  (select count(distinct learner_id) from public.lesson_views)               as opened_a_lesson,
  (select count(*) from l where done >= 1)                                   as finished_1_lesson,
  (select count(*) from l where done >= 3)                                   as finished_3_lessons,
  (select count(distinct learner_id) from public.courses where status = 'completed') as finished_a_course;


-- 2. Lesson by lesson: of the learners who opened lesson N, how many finished it.
--    A sharp fall at one lesson number points at that part of the course.
select
  l.module_index + 1                                                         as lesson,
  count(distinct v.lesson_id)                                                as opened,
  count(distinct v.lesson_id) filter (where l.completed_at is not null)      as finished,
  round(100.0 * count(distinct v.lesson_id) filter (where l.completed_at is not null)
        / nullif(count(distinct v.lesson_id), 0))                            as finished_pct
from public.lesson_views v
join public.lessons l on l.id = v.lesson_id
where l.course_id is not null
group by 1
order by 1;


-- 3. Where inside a lesson people stop: for lessons opened but not finished,
--    how far through they got (0% = left on the intro).
with furthest as (
  select v.lesson_id, max(v.step)::float / max(v.step_count - 1) as reached
  from public.lesson_views v
  join public.lessons l on l.id = v.lesson_id
  where l.completed_at is null
  group by v.lesson_id
)
select
  case when reached = 0 then 'left on the intro'
       when reached < 0.34 then 'first third'
       when reached < 0.67 then 'middle third'
       else 'last third' end                                                 as stopped_in,
  count(*)                                                                   as lessons
from furthest
group by 1
order by min(reached);


-- 4. Coming back: of learners whose first lesson was at least N days ago,
--    how many did anything in a lesson again N or more days later.
with activity as (
  select learner_id, created_at from public.lesson_views
  union all
  select learner_id, created_at from public.attempts
),
firsts as (
  select learner_id, min(created_at) as first_seen from activity group by learner_id
)
select
  d.days                                                                     as came_back_after_days,
  count(*) filter (where f.first_seen < now() - make_interval(days => d.days)) as eligible,
  count(*) filter (where f.first_seen < now() - make_interval(days => d.days)
    and exists (select 1 from activity a
                where a.learner_id = f.learner_id
                  and a.created_at >= f.first_seen + make_interval(days => d.days))) as came_back
from firsts f
cross join (values (1), (7), (30)) as d(days)
group by d.days
order by d.days;


-- 5. Hardest checks: questions most people get wrong on their first try.
--    Either the lesson teaches it badly or the question is unclear; read both.
select
  c.title                                                                    as course,
  l.module_index + 1                                                         as lesson,
  a.question_index + 1                                                       as question,
  count(*)                                                                   as answers,
  round(100.0 * count(*) filter (where a.correct) / count(*))                as correct_pct,
  l.lesson_data -> 'questions' -> a.question_index ->> 'question'            as question_text
from public.attempts a
join public.lessons l on l.id = a.lesson_id
join public.courses c on c.id = l.course_id
group by c.title, l.module_index, a.question_index, l.lesson_data
having count(*) >= 3
order by correct_pct, answers desc
limit 20;


-- 6. What people want to learn: the topics they name, most recent first.
--    The niche ones are the positioning bet; see which kinds come up.
select topic, count(*) as learners, max(created_at) as latest
from public.courses
group by topic
order by latest desc
limit 50;


-- 7. Mistakes learners reported, newest first, with the step's text. A
--    wrong_fact report on a lesson that passed the checks shows what the
--    fact check missed; fix the check, not just the lesson.
select r.created_at, r.kind, r.message, c.title as course, l.module_index + 1 as lesson, r.step,
       l.lesson_data->'blocks'->(r.step - 1) as block
from public.lesson_reports r
join public.lessons l on l.id = r.lesson_id
left join public.courses c on c.id = l.course_id
order by r.created_at desc
limit 50;


-- 8. Paying learners: plans by status, and how many renew vs cancel.
select plan, status, count(*) as learners,
       count(*) filter (where canceled_at is not null) as canceling
from public.subscriptions
group by plan, status
order by plan, status;


-- 9. Creator partners: who they brought in and what we owe them (an estimate
--    from list prices; Paddle's transactions are the record for real payouts).
--    A subscription earns commission for commission_months after it started.
select p.code, p.name,
       (select count(*) from public.profiles pr where pr.referred_by = p.code) as signups,
       count(s.*) as subscribers,
       count(s.*) filter (where s.status in ('active', 'trialing', 'past_due')) as paying_now,
       round(sum(
         case when s.status in ('active', 'trialing', 'past_due') and s.started_at > now() - make_interval(months => p.commission_months)
              then (case s.plan when 'yearly' then 119.99 / 12 else 19.99 end) * p.commission_pct / 100.0
              else 0 end
       )::numeric, 2) as est_monthly_commission_usd
from public.partners p
left join public.subscriptions s on s.referred_by = p.code
group by p.code, p.name, p.commission_months
order by subscribers desc, signups desc;


-- 10. What things really cost (from the runs table: OpenRouter's reported
--     cost of every model call and painting). Last 30 days, by kind.
select kind, outcome, count(*) as runs,
       round(avg(cost_usd), 4) as avg_usd, round(sum(cost_usd), 2) as total_usd,
       percentile_cont(0.5) within group (order by ms) / 1000 as p50_seconds,
       percentile_cont(0.9) within group (order by ms) / 1000 as p90_seconds,
       count(*) filter (where not ok) as failed
from public.runs
where created_at > now() - interval '30 days'
group by kind, outcome
order by total_usd desc;


-- 11. Cost per lesson, all in: writing the lesson plus staging it (scenes,
--     voice script, "Go deeper"). Compare with ECONOMICS.md's ~$0.25-0.31.
select round(avg(coalesce(w.cost_usd, 0) + coalesce(s.cost_usd, 0)), 4) as avg_usd_per_lesson,
       percentile_cont(0.9) within group (order by coalesce(w.cost_usd, 0) + coalesce(s.cost_usd, 0)) as p90_usd,
       count(*) as lessons
from public.runs w
left join lateral (
  select sum(cost_usd) as cost_usd from public.runs s where s.kind = 'stage' and s.lesson_id = w.lesson_id
) s on true
where w.kind = 'learn' and w.outcome in ('lesson', 'ahead') and w.lesson_id is not null
  and w.created_at > now() - interval '30 days';


-- 12. AI cost per learner over the last 30 days: the heaviest learners, and
--     whether any cost more than their plan brings in (~$9.45/month yearly,
--     ~$18.50 monthly, after Paddle's fee).
select r.learner_id, coalesce(s.plan, 'free') as plan, count(*) filter (where r.kind = 'learn' and r.outcome in ('lesson', 'ahead')) as lessons,
       round(sum(r.cost_usd), 2) as ai_usd
from public.runs r
left join public.subscriptions s on s.learner_id = r.learner_id
where r.created_at > now() - interval '30 days'
group by r.learner_id, s.plan
order by ai_usd desc
limit 25;


-- 13. The shared caches: how often a new course reuses a plan (exactly or by
--     meaning) and lesson 1. Check a sample of "similar" matches by hand: a
--     wrong one gives a learner a course on a different topic.
select e->>'step' as cache,
       count(*) filter (where e->>'hit' = 'true' and coalesce(e->>'via', '') <> 'similar') as hits_exact,
       count(*) filter (where e->>'via' = 'similar') as hits_similar,
       count(*) filter (where e->>'hit' = 'false') as misses
from public.runs, jsonb_array_elements(trace) e
where kind = 'learn' and e->>'step' in ('plan_cache', 'lesson_cache') and created_at > now() - interval '30 days'
group by e->>'step';

-- 13b. Recent "similar" matches, to review: what was asked and what it matched.
select r.topic as asked, e->>'matched' as matched_plan, e->'nearest' as nearest, r.created_at
from public.runs r, jsonb_array_elements(r.trace) e
where r.kind = 'learn' and e->>'step' = 'plan_cache' and e->>'via' = 'similar'
order by r.created_at desc
limit 30;
