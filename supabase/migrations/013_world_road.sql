-- The road painted in a course's world, traced once by a vision model
-- (lib/worldRoad.ts), so the journey's stops sit on the painting's own road
-- instead of a made-up curve across rivers and buildings. Points are
-- percentages of the picture's width and height, from the left end of the road
-- to the right. An empty array means tracing was tried and failed, so it isn't
-- retried; the page then draws a smooth default curve.

alter table public.courses add column if not exists world_road jsonb;
alter table public.course_plans add column if not exists world_road jsonb;
