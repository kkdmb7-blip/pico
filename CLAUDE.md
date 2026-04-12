# 규칙
- 작업 중 확인 질문 금지
- yes/no 절대 묻지 말 것
- 파일 수정/생성/삭제 모두 자동 승인
- 모르는 것 있어도 최선의 판단으로 진행
- 결과만 출력할 것
- 지시한 것만 실행할 것
- 모든 작업 완료 후 반드시 git commit + git push

---

# 프로젝트 개요

**서비스명**: FORTUNA (운세 앱)
**URL**: https://picolab.kr
**스택**: 순수 HTML/JS (프레임워크 없음), Supabase (DB), Cloudflare Workers (API), Vercel (AI proxy)
**저장소**: https://github.com/kkdmb7-blip/pico

## 인프라

| 역할 | URL |
|---|---|
| Workers API | https://fortuna.kkdmb7.workers.dev |
| AI Proxy | https://fortuna-silk.vercel.app/api/chat |
| Supabase | https://ymghmfkqctckxxysxkvy.supabase.co |
| Supabase Key | sb_publishable_3-9zobXqx6Nv36LzmNMBpA_fohZqA5x |
| Kakao REST Key | 0c8f16db31d8b01ae2fc9cc2c7c56ea7 |

## Workers 엔드포인트

| 엔드포인트 | 메서드 | 설명 |
|---|---|---|
| /saju-test | POST | 사주 계산 (body: {birth, gender, calendar}) |
| /saju-report | GET | DB 저장 사주리포트 (param: year/month/day/hour/gender) |
| /vedic | GET | 베딕 점성술 |
| /astro | GET | 서양 점성술 |
| /astro/aspects | GET | 행성 각도 |
| /ziwei | GET | 자미두수 |
| /qimen | GET | 기문둔갑 포국 |
| /kakao-token | POST | 카카오 OAuth 토큰 교환 |
| /analysis-history | GET | 구형 분석 이력 (param: user_id) |
| /analysis-history-detail | GET | 구형 이력 상세 (param: id) |

## Supabase 테이블

| 테이블 | 주요 필드 | 설명 |
|---|---|---|
| orb_balance | user_id, balance, paid_balance | Orb 잔액 |
| orb_transactions | user_id, amount, type, desc | 충전/차감 내역 |
| reports | user_id, report_type, content(array), orb_spent, created_at | AI 리포트 저장 |
| counselor_profiles | user_id, ... | 상담사 프로필 |

**Orb 충전 규칙**: balance, paid_balance 반드시 동시 업데이트. paid_balance 빠지면 잔액 음수 버그 발생.

## localStorage 키

| 키 | 내용 |
|---|---|
| pico_user | {id, name, avatar} 카카오 로그인 유저 |
| pico_profile | 현재 사주 프로필 {name, year, month, day, hour, gender} |
| pico_profiles | 저장된 프로필 배열 |
| pico_counselor_profile | 상담사 프로필 |

---

# 파일별 구조

## index.html — 메인 (홈/리포트/상담/마이페이지 탭)

**하단 탭**: 홈(tabHome), 리포트(tabReport), 상담(tabConsult), 마이페이지(tabMypage)

**핵심 함수**:
- `openGunghapModal()` — 궁합 모달
- `submitGunghap()` → `requestGunghapAI()` — 궁합 분석
- `openHistoryModal()` — 지난 분석 보기 (analysis-history Worker + reports 테이블 통합 조회)
- `openReportDetail(title, content)` — reports 테이블 항목 상세 보기
- `openHistoryDetail(id)` — 구형 history Worker 항목 상세
- `nsCalc()` — 숫자 운세
- `_drawGunghapCard(cb)` — 궁합 캔버스 카드

**전역변수**: window._fortunaUser, window._ghLastMySaju/PData/Name 등

**마이페이지 탭 (line ~1308)**:
- 📜 지난 분석 보기 → openHistoryModal() (line ~1336)
- 👤 내 프로필 설정 → openProfileModal()
- 👥 프로필 관리 → openProfilesModal()

---

## saju.html — 사주 분석 페이지

**URL params**: pYear, pMonth, pDay, pHour, pGender

**데이터 흐름**:
1. fetchSaju() → POST /saju-test → sd 객체
2. sd.summary.pillars.day → dayStem → STEM_H_MAP → stemHanja
3. requestSajuAI(): GET /saju-report → STEP2(theory JSON) → STEP3-A(원국) → STEP3-B(대운+전략)

**sd 필드 구조** (POST /saju-test 응답):
- sd.summary.pillars.{year/month/day/hour} — 천간지지
- sd.geokguk — 격국
- sd.yongshin — 용신
- sd.five_count — 오행 개수 {wood,fire,earth,metal,water}
- sd.five_pct — 오행 퍼센트
- sd.strength_level_5 — 강약 (신강/신약 등)
- sd.pattern — 특수격
- sd.ten_gods_map — 십신 맵

**STEM_H_MAP**: {甲:'갑', 乙:'을', 丙:'병', 丁:'정', 戊:'무', 己:'기', 庚:'경', 辛:'신', 壬:'임', 癸:'계'}

---

## report.html — AI 운세 리포트

**5가지 타입**: character(기질), money(재물), love(연애), daeun(대운), year(신년운)

**URL params**: type=character|money|love|daeun|year

**핵심 전역변수**: _type, _config, _profile, _user, _personality, _ilju

**상태 흐름**:
- stateIntro → stateDetail → [character: statePersonality] → stateLoading → stateReport

**핵심 함수**:
- `loadSajuData()` — POST /saju-test + GET /saju-report 병렬 (saju.html과 동일 패턴)
- `generateReport()` — money/love/daeun/year 타입 생성
- `generateCharacterReport()` — character 타입 생성 (saju.html STEP2 구조 동일)
- `streamToSections(prompt, secIndices, theoryName, ysFinal, wg, isFirst)` — AI 스트림 → 섹션 분배
- `fetchExistingReport()` — reports 테이블에서 기존 리포트 조회
- `renderReport(sections, createdAt)` — 기존 리포트 렌더링
- `showToast(msg)` — 저장 완료 토스트
- `getSb()` — Supabase 클라이언트

**TYPE_SECTIONS** (타입별 5개 섹션 배열):
```
character: [핵심기질요약(300), 일간과격국분석(600), 강점·약점과오행균형(500), 베딕낙샤트라로본패턴(400), 기질을활용하는실천방향(400)]
money: [재물구조핵심요약, 재성·식상분석, 현재대운재물흐름, 직업·사업적성, 재물전략실천방향]
love: [...], daeun: [...], year: [...]
```

**저장**: reports 테이블에 insert → showToast 표시

---

## astro.html — 서양 점성술

**전역변수**: window._astroData = {planets, aspects}
**공유 버튼**: astroShareBtnWrap (display:none → display:flex)
**캔버스**: _drawAstroCard(cb)
**API**: GET /astro, /astro/aspects

---

## vedic.html — 베딕 점성술

**전역변수**: window._vedicData
**공유 버튼**: vedicShareBtnWrap
**캔버스**: _drawVedicCard(cb)
**API**: GET /vedic

---

## ziwei.html — 자미두수

**전역변수**: window._ziweiData (render() 내부에서 저장)
**공유 버튼**: ziweiShareBtnWrap
**캔버스**: _drawZiweiCard(cb)
**API**: GET /ziwei

**주의**: render() 함수 내부에서 _ziweiData 저장. 코드 삽입 시 닫는 } 위치 주의.

---

## qimen.html — 기문둔갑

**전역변수**: window._qimenData, currentType (wonmyong/siga/ilga)
**공유 버튼**: qimenShareBtnWrap
**캔버스**: _drawQimenCard()
**API**: GET /qimen, POST /saju-test

---

## charge.html — Orb 충전

**결제**: KG이니시스
**Vercel**: POST /api/resolve-user (사용자 resolve)
**Supabase**: orb_balance upsert, orb_transactions insert

---

## mypage.html — 별도 마이페이지 (index.html 탭과 다름)

index.html 하단탭의 마이페이지와 **다른 별개 파일**.
- 카카오 로그인, Orb 잔액, 저장된 프로필 목록
- 리포트 히스토리 없음 (index.html 탭에만 있음)

---

# 코드 수정 전 필수 확인 체크리스트

## 데이터 구조 확인 규칙 (필수)
- API 응답, localStorage, Supabase 데이터의 필드를 새로 쓸 때: **절대 추측 금지**
- 코딩 전에 반드시 실제 데이터 샘플 확인 (Supabase row 조회 또는 콘솔 출력값 요청)
- 확인 없이 필드명을 가정하면 버그 발생 (사례: saju_data.pillars.day → 실제는 sd.summary.pillars.day)

## 자주 발생하는 버그 패턴 (반드시 체크)
- **function 선언 호이스팅 무한재귀**: `var orig = fn; function fn() { orig() }` 패턴 절대 사용 금지. 기존 함수를 override할 때는 원본 함수 끝에 직접 코드 추가
- **display:none → display:flex**: flex 컨테이너를 show할 때 `block`이 아닌 `flex`로 설정
- **공유 버튼 미노출**: 결과 렌더링 함수(renderResult 등) 끝에 shareBtn `display:flex` 코드 포함됐는지 확인
- **성별 누락**: AI 프롬프트/API 호출 시 gender 파라미터 빠지면 기본값(보통 남성)으로 처리됨
- **코드 삽입 위치 오류**: 함수 내부에 코드를 추가할 때 닫는 `}` 위치 반드시 확인
- **Canvas roundRect 호환성**: `ctx.roundRect`는 구형 iOS Safari에서 미지원. 반드시 `if(ctx.roundRect){...}else{ctx.rect(...)}` 패턴 사용
- **Canvas 색상 문자열 연산**: hex 색상에 투명도 추가 시 반드시 6자리 hex 사용

## 공유 버튼 표준 스타일 (모든 페이지 동일)
- 카카오 버튼: background:#fee500; color:#3c1e1e; border-radius:14px; padding:14px 0; width:100%
- AI상담 버튼: background:linear-gradient(135deg,#7b5ea7,#a07fd4); color:#fff; 동일 크기
- 두 버튼 flex 컨테이너, gap:10px, align-items:center

## 페이지별 공유 버튼 ID
| 파일 | 버튼 wrap ID | display 값 |
|---|---|---|
| saju.html | sajuShareBtnWrap | flex |
| astro.html | astroShareBtnWrap | flex |
| vedic.html | vedicShareBtnWrap | flex |
| ziwei.html | ziweiShareBtnWrap | flex |
| qimen.html | qimenShareBtnWrap | flex |
