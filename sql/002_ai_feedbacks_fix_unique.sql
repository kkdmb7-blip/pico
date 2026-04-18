-- Fix ON CONFLICT matching by converting expression-based unique index
-- to simple column-based unique constraint.
-- source_id/source_type are made NOT NULL with default '' so null-equality isn't needed.

-- 1) Drop old expression-based unique index
drop index if exists public.uniq_ai_feedbacks_user_source;

-- 2) Normalize existing rows (safe even if table is empty)
update public.ai_feedbacks set source_id = '' where source_id is null;
update public.ai_feedbacks set source_type = '' where source_type is null;

-- 3) Make columns NOT NULL with default
alter table public.ai_feedbacks alter column source_id set default '';
alter table public.ai_feedbacks alter column source_type set default '';
alter table public.ai_feedbacks alter column source_id set not null;
alter table public.ai_feedbacks alter column source_type set not null;

-- 4) Simple column-based unique constraint (works with PostgREST on_conflict)
alter table public.ai_feedbacks
  add constraint uniq_ai_feedbacks_user_source
  unique (user_id, source, source_id, source_type);
