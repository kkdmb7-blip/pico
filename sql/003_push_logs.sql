-- Push notification log for personalized AI messages
-- Used for: dedup (don't spam same user in 48h), click-through tracking, seed for memox chat

create table if not exists public.push_logs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  slot smallint not null default 0,
  message text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  opened_at timestamptz,
  dismissed_at timestamptz
);

create index if not exists idx_push_logs_user_created
  on public.push_logs (user_id, created_at desc);

create index if not exists idx_push_logs_created
  on public.push_logs (created_at desc);

create index if not exists idx_push_logs_opened
  on public.push_logs (opened_at) where opened_at is not null;

alter table public.push_logs enable row level security;

comment on table public.push_logs is 'Personalized push messages (sent, opened, dismissed tracking)';
