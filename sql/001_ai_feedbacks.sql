-- ─────────────────────────────────────────────────────────────
-- AI 응답 피드백 수집 테이블
-- 대상: pico 리포트, memox 채팅, pico 데일리운세
-- Supabase SQL Editor에서 실행 (ymghmfkqctckxxysxkvy)
-- ─────────────────────────────────────────────────────────────

-- 확장
create extension if not exists "pgcrypto";

-- 테이블
create table if not exists public.ai_feedbacks (
  id            uuid primary key default gen_random_uuid(),
  user_id       text not null,
  client        text not null check (client in ('pico', 'memox')),
  source        text not null check (source in ('report', 'chat', 'daily_fortune')),
  source_id     text,                     -- reports.id, chat_messages.id 등 (없어도 됨)
  source_type   text,                     -- 'character', 'daeun' 등 세부 분류
  rating        smallint not null check (rating in (-1, 1)),
  reasons       text[] default '{}',      -- 이유 다중선택 태그
  comment       text,                     -- 자유 코멘트 (선택)
  meta          jsonb default '{}'::jsonb,-- 프로필키, 비용, 모델 등 context
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table  public.ai_feedbacks is 'AI 응답(리포트/채팅/데일리) 유저 피드백';
comment on column public.ai_feedbacks.source      is 'report | chat | daily_fortune';
comment on column public.ai_feedbacks.source_type is '세부 타입: character/money/love/... 또는 채팅 카테고리';
comment on column public.ai_feedbacks.rating      is '-1=부정, 1=긍정';
comment on column public.ai_feedbacks.reasons     is '이유 태그 배열 (소스별 선택지 다름)';
comment on column public.ai_feedbacks.meta        is '클라이언트 전송 컨텍스트 (프로필키, 토큰, 모델 등)';

-- 인덱스
create index if not exists idx_ai_feedbacks_source_created
  on public.ai_feedbacks (source, created_at desc);

create index if not exists idx_ai_feedbacks_user_created
  on public.ai_feedbacks (user_id, created_at desc);

create index if not exists idx_ai_feedbacks_source_rating
  on public.ai_feedbacks (source, source_type, rating);

create index if not exists idx_ai_feedbacks_rating_created
  on public.ai_feedbacks (rating, created_at desc);

-- 같은 user_id + source + source_id 조합은 1개만 (재평가 시 update로 갱신)
create unique index if not exists uniq_ai_feedbacks_user_source
  on public.ai_feedbacks (user_id, source, coalesce(source_id, ''), coalesce(source_type, ''));

-- updated_at 자동 갱신 트리거
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

-- ─────────────────────────────────────────────────────────────
-- RLS (Row Level Security)
-- 정책: 클라이언트는 anon/publishable key로 직접 접근 불가.
-- 모든 read/write는 fortuna-worker가 SB_SERVICE_KEY로 중계.
-- 이 방식으로 유저 소유권/Admin 권한/레이트리밋을 Worker에서 통제.
-- ─────────────────────────────────────────────────────────────
alter table public.ai_feedbacks enable row level security;

-- anon/authenticated에 어떤 policy도 부여하지 않음 → 기본 차단
-- service_role은 RLS를 자동 우회하므로 Worker에서 정상 동작

-- ─────────────────────────────────────────────────────────────
-- 집계 뷰 (관리자 대시보드용)
-- ─────────────────────────────────────────────────────────────
create or replace view public.v_ai_feedback_stats as
select
  source,
  coalesce(source_type, '(all)') as source_type,
  count(*)                                    as total,
  count(*) filter (where rating = 1)          as positive,
  count(*) filter (where rating = -1)         as negative,
  round(
    100.0 * count(*) filter (where rating = 1) / nullif(count(*), 0),
    1
  ) as positive_rate_pct,
  max(created_at) as last_at
from public.ai_feedbacks
group by source, source_type;

comment on view public.v_ai_feedback_stats is '소스·타입별 긍정/부정 집계';

-- 일별 추이 뷰
create or replace view public.v_ai_feedback_daily as
select
  date_trunc('day', created_at) as day,
  source,
  count(*)                              as total,
  count(*) filter (where rating = 1)    as positive,
  count(*) filter (where rating = -1)   as negative
from public.ai_feedbacks
where created_at > now() - interval '90 days'
group by 1, 2
order by 1 desc, 2;

comment on view public.v_ai_feedback_daily is '최근 90일 일별 피드백 추이';

-- ─────────────────────────────────────────────────────────────
-- 관리자 화이트리스트 (Admin UUID만 전체 조회 허용하려면 service_role 사용)
-- pico admin.html은 Worker 프록시 경유로 service_role 사용 예정
-- ─────────────────────────────────────────────────────────────

-- 완료 확인
do $$
begin
  raise notice 'ai_feedbacks schema ready. Indexes and RLS applied.';
end $$;
