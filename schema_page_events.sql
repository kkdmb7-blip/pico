-- 사용자 행동 추적 테이블 (page_events)
-- Supabase SQL Editor 에서 1회 실행

create table if not exists page_events (
  id bigserial primary key,
  session_id text not null,
  user_id text,
  event_type text not null check (event_type in ('page_view','page_exit','click','custom')),
  page text not null,
  path text,
  referrer text,
  duration_ms integer,
  meta jsonb,
  user_agent text,
  created_at timestamptz default now()
);

create index if not exists idx_page_events_created on page_events(created_at desc);
create index if not exists idx_page_events_page on page_events(page);
create index if not exists idx_page_events_session on page_events(session_id);
create index if not exists idx_page_events_user on page_events(user_id);

-- RLS: anon 삽입 금지 (Worker가 service_role 키로만 삽입)
alter table page_events enable row level security;
-- 기본 정책 없음 → service_role 만 접근 가능

-- ─────────────────────────────────────────────
-- 2026-04 확장: 디바이스/UTM/스크롤 컬럼 추가
-- Supabase SQL Editor 에서 1회 실행
-- ─────────────────────────────────────────────

alter table page_events add column if not exists device_type text;       -- mobile/tablet/desktop
alter table page_events add column if not exists screen_width integer;
alter table page_events add column if not exists viewport_width integer;
alter table page_events add column if not exists language text;
alter table page_events add column if not exists utm_source text;
alter table page_events add column if not exists utm_medium text;
alter table page_events add column if not exists utm_campaign text;
alter table page_events add column if not exists scroll_pct integer;

create index if not exists idx_page_events_device on page_events(device_type);
create index if not exists idx_page_events_utm_src on page_events(utm_source);
create index if not exists idx_page_events_type on page_events(event_type);
