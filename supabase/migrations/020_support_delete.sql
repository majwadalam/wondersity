-- "Delete my data" removes a learner's own support messages too (they're
-- otherwise insert-and-read only; migration 019).
grant delete on public.support_messages to authenticated;
