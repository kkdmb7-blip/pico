-- AI feedback schema (pico / memox)
-- Run this in Supabase SQL Editor (project ymghmfkqctckxxysxkvy)

-- extension
create extension if not exists "pgcrypto";

-- main table
create table if not exists public.ai_feedbacks (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  client text not null check (client in ('pico', 'memox')),
  source text not null check (source in ('report', 'chat', 'daily_fortune')),
  source_id text,
  source_type text,
  rating smallint not null check (rating in (-1, 1)),
  reasons text[] default '{}',
  comment text,
  meta jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- indexes
create index if not exists idx_ai_feedbacks_source_created
  on public.ai_feedbacks (source, created_at desc);

create index if not exists idx_ai_feedbacks_user_created
  on public.ai_feedbacks (user_id, created_at desc);

create index if not exists idx_ai_feedbacks_source_rating
  on public.ai_feedbacks (source, source_type, rating);

create index if not exists idx_ai_feedbacks_rating_created
  on public.ai_feedbacks (rating, created_at desc);

create unique index if not exists uniq_ai_feedbacks_user_source
  on public.ai_feedbacks (user_id, source, coalesce(source_id, ''), coalesce(source_type, ''));

-- updated_at trigger
create or replace function public.tg_ai_feedbacks_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_ai_feedbacks_touch on public.ai_feedbacks;
create trigger trg_ai_feedbacks_touch
  before update on public.ai_feedbacks
  for each row execute function public.tg_ai_feedbacks_touch();

-- RLS: block anon/authenticated. Worker uses service_role to bypass.
alter table public.ai_feedbacks enable row level security;

-- stats view
create or replace view public.v_ai_feedback_stats as
select
  source,
  coalesce(source_type, '(all)') as source_type,
  count(*) as total,
  count(*) filter (where rating = 1) as positive,
  count(*) filter (where rating = -1) as negative,
  round(100.0 * count(*) filter (where rating = 1) / nullif(count(*), 0), 1) as positive_rate_pct,
  max(created_at) as last_at
from public.ai_feedbacks
group by source, source_type;

-- daily trend view (90 days)
create or replace view public.v_ai_feedback_daily as
select
  date_trunc('day', created_at) as day,
  source,
  count(*) as total,
  count(*) filter (where rating = 1) as positive,
  count(*) filter (where rating = -1) as negative
from public.ai_feedbacks
where created_at > now() - interval '90 days'
group by 1, 2
order by 1 desc, 2;
