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
- **존재하지 않는 엘리먼트 textContent 설정으로 이후 라인 실행 중단**: `document.getElementById('X').textContent=...`에서 X가 DOM에 없으면 TypeError로 async 함수가 종료. 뒤에 있는 `reportActions.display='flex'`, `showConsultBanner()` 같은 중요 라인이 실행되지 않아 하단 버튼·배너가 전부 숨겨짐. **사례**: report.html의 `regenNote`는 HTML에 정의 없이 22개 리포트 생성 함수에서 참조돼 하단 연결포인트(공유/전문상담/AI운세) 전체가 안 보이는 버그. **해결**: `{ const _el = document.getElementById('regenNote'); if (_el) _el.textContent = ...; }` 패턴으로 null-safe하게 래핑

## report.html 리포트 생성 후 검증 체크리스트 (반드시 확인)
새 리포트 타입 추가 시 함수 끝에 다음 5가지가 모두 실행되는지 확인:
1. `reports` 테이블 insert (try/catch로 감싸기)
2. `reportMeta.textContent` = 생성일
3. `reportBadge.innerHTML` = emoji + 'AI REPORT'
4. `regenNote` 설정 (null-safe 래핑)
5. `reportActions.display='flex'` + `showConsultBanner()` — 이 두 줄이 안 돌면 하단 버튼 전체 사라짐

`showConsultBanner()`의 `bannerTexts` 객체에도 새 타입 추가 (없으면 fallback 일반 문구)

`generateReport()` dispatch 스위치에 새 타입 케이스 반드시 추가 (누락 시 "지원되지 않는 타입입니다" 에러)

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

---

## saju.html 핵심 프롬프트 (절대 수정 금지)

### STEP2 이론판별엔진 system_prompt
```
당신은 사주 이론 판별 엔진입니다. JSON만 반환하세요. 텍스트 해석 절대 금지.

판단 규칙:
- pattern.type이 "양신성상" 또는 "독상" → primary_theory: "적천수"
- strength_level_5가 "극왕" 또는 "극약" → primary_theory: "적천수"
- strength_level_5가 "신강" 또는 "신약" + pattern.type이 "정격" → primary_theory: "억부지전"
- johu.needs의 원소가 five_count에서 0개 → secondary_theory: "궁통보감"

용신 재확인:
- 양신성상이면: 象을 疏(통하게)하는 오행 = 용신
- 정격이면: yongshin.primary 그대로
- 극왕 종격이면: 비겁/인성이 포섭, 식상이 용신

성향 보정:
- social=introvert + 비겁과다 → personality_keywords에 "내향적" 포함
- action=impulsive_start → "아이디어다발_마무리약" 포함
- stress=need_alone_time → "독립선호" 포함
```

**반환 JSON 필드**: primary_theory, secondary_theory, yongshin_final:{primary,primary_element,in_chart}, structure_summary, strength_interpretation, bijob_role, personality_keywords[], wealth_structure:{type,note}, career_tendency, writing_guidelines[]

---

### STEP3-A 원국분석 system_prompt
```
당신은 {theoryName} 기반 사주 분석가입니다.
확정된 사실과 작성 지시만 따르세요.

절대 규칙:
- #헤더 금지, 표 금지, 일진/날짜 구체적 언급 금지
- **볼드**는 핵심 단어에만 3~5개
- 톤: 따뜻하고 정확한 친구 같은 전문가
- 없는 오행을 "있다"고 쓰면 안 됨
- 용신({ysFinal})을 기신/불리로 쓰면 안 됨
+ writing_guidelines (STEP2 결과 금지표현 체크리스트 자동 주입)
```

**user message 구조**: 일간/일주, 사주기둥, 오행개수·비율, 신강도, 패턴, 격국, 용신, 십신, 성격키워드, 성격DB, 연령대조언 + 적천수 원문(해당 천간 1절) + 구조지시(①천간론인용·자연비유 ②성격기질 ③약점 ④사주구조설명) → 800~1200자

---

### STEP3-B 대운분석 system_prompt
```
당신은 {theoryName} 기반 사주 분석가입니다.
대운 분석 + 실전 전략을 작성하세요.

절대 규칙:
- #헤더 금지, 표 금지
- **볼드**는 핵심 단어에만 3~5개
- 톤: 따뜻하고 실용적
- 구체적 금액, 확정적 예언 금지. "황금기" "최고의 대운" "성과 폭발" 같은 확정적 표현 절대 금지
- 대운별로 stem_ten_god과 element_supply 반드시 반영

양신성상 대운 해석 규칙 (pattern.type이 양신성상인 경우 반드시 적용):
- 양신의 오행이 오는 대운 → "상(象) 유지, 편안하나 큰 성과보다 안정기"
- 상을 설(泄)하는 오행이 오는 대운 → "에너지 발산, 성과 발현 가능"
- 상을 극하는 오행이 오는 대운 → "변화·전환기, 기존 흐름이 바뀌는 양면적 시기"
- 천간이 지지 위에 앉아 생하는 관계면 "천간의 힘이 지지로 빠져 약화됨" 반드시 서술

## 신해(辛亥) 대운 특별 규칙 (양신성상 수목 사주 전용)
신금(辛)이 해수(亥) 위에 앉으면, 금이 수를 생한다(金生水).
이 경우 금의 제어 에너지가 수로 흘러가 원국의 수목 기세를 오히려 강화시킨다. 따라서:
- "황금기" "최고의 대운" "성과 폭발" 같은 표현 절대 금지
- "금의 힘이 수에 흡수되어 제어력이 약화된다" 반드시 서술
- "여러 아이디어가 분산되고 마무리가 어려운 시기" 서술
- 긍정면: "창의성과 직관이 깊어지는 시기"로 서술
- 부정면: "실질적 재물 성과는 제한적" 서술
+ writing_guidelines (STEP2 결과 금지표현 체크리스트 자동 주입)
```

**user message 구조**: 일주, 신강도, 용신, 나이, 대운8개 JSON, 대운특성, 올해운세, 이달운세, 창업/투자조언DB + 구조지시(①현재대운400자 ②과거요약150자 ③미래전망250자 ④실전액션3가지) → 1000~1500자, max_tokens:3000

---

### writing_guidelines 생성 로직
STEP2 Claude 응답 JSON에서 `writing_guidelines[]` 배열로 반환됨.
STEP3-A/B system_prompt 끝에 `wg` 변수로 자동 주입:

```javascript
var wg = theoryFrame && theoryFrame.writing_guidelines
  ? '\n\n금지 표현 체크리스트:\n' + theoryFrame.writing_guidelines.map(function(g){return '- '+g;}).join('\n')
  : '';
```

wg는 STEP3 system_prompt 문자열 끝에 직접 연결됨 (`...쓰면 안 됨'+wg`).

---

## report.html 현재 상태
- `generateCharacterReport()`: saju.html STEP2~STEP3 이식 필요
- `money/love/daeun/year`: 기존 `generateReport()` 유지 중

---

## 공유 버튼 구현 패턴 (실수 방지용)

**순서**: `navigator.share` (모바일 우선) → `Kakao.Share.sendDefault` (PC) → `clipboard` fallback

### 핵심 규칙
- **objectType 반드시 `'feed'`** — `'text'`는 Error 4019 발생
- **imageUrl은 실존 파일만** — `og-image.png` 없음, `https://picolab.kr/img/goddess/goddess-app.png` 사용
- **모바일에서 Kakao Share 직접 호출 시 4019 오류** — `navigator.share`로 우회하면 해결
- Kakao SDK: `Kakao.Share` 존재 확인 → `isInitialized()` → `init(KAKAO_JS_KEY)` 순서

### 표준 구현 코드
```javascript
document.getElementById('btnShare').addEventListener('click', function() {
  var pageUrl = 'https://picolab.kr';
  var shareText = '공유할 텍스트\n\n🔮 ' + pageUrl;
  // 1. 모바일 OS 네이티브 공유 (iOS/Android)
  if (navigator.share) {
    navigator.share({ title: '제목', text: shareText, url: pageUrl }).catch(function(){});
    return;
  }
  // 2. PC 카카오 공유
  if (window.Kakao && Kakao.Share) {
    if (!Kakao.isInitialized()) { try { Kakao.init(KAKAO_JS_KEY); } catch(e) {} }
    Kakao.Share.sendDefault({
      objectType: 'feed',
      content: {
        title: '제목',
        description: '설명 텍스트',
        imageUrl: 'https://picolab.kr/img/goddess/goddess-app.png',
        link: { mobileWebUrl: pageUrl, webUrl: pageUrl }
      },
      buttons: [{ title: '내 운세 보러가기', link: { mobileWebUrl: pageUrl, webUrl: pageUrl } }]
    });
    return;
  }
  // 3. 클립보드 fallback
  navigator.clipboard && navigator.clipboard.writeText(shareText).then(function() { alert('📋 복사됐어요!'); });
});
```

### KAKAO_JS_KEY
```javascript
var KAKAO_JS_KEY = '25432f8a37e0ac51a5e10cbcba8ae413';
```
