# 플레이스토어 등록 자료 — FORTUNA (피코랩)

## 짧은 설명 (80자 이내, 사용자 제공)

```
사주·운세·궁합을 AI로 풀어낸 나만의 우주 — 포르투나
```
(28자)

## 긴 설명 (4000자 이내, 사용자 제공 그대로)

```
✨ 포르투나 — AI 사주 & 운세 플랫폼

당신의 생년월일 속에 숨겨진 이야기를
인공지능이 깊고 따뜻하게 풀어드립니다.

─────────────────────────
🔮 주요 기능
─────────────────────────

[ 사주 리포트 ]
사주팔자를 기반으로 정체성·위로·전략
3가지 관점에서 AI가 분석해드립니다.
오행 레이더 차트로 나의 에너지 구조를
한눈에 파악하세요.

[ 자미두수 재물운 ]
동양 최고의 별자리 점술 자미두수로
올해·이번달·오늘의 재물 흐름을 봅니다.
화록이 재백궁에 드는 날, 놓치지 마세요.

[ 궁합 분석 ]
연애궁합부터 지금 이 시기의 의미,
두 사람을 위한 조언까지
6가지 섹션으로 깊이 있게 분석합니다.

[ 오늘의 운세 ]
매일 아침, 나에게 맞는 운세 한 줄로
하루를 시작하세요.

─────────────────────────
💫 포르투나가 특별한 이유
─────────────────────────

- 단순한 운세 앱이 아닙니다
  — 나를 이해하는 AI 동반자입니다

- 천편일률적인 띠별 운세가 아닌
  내 사주 데이터 기반 맞춤 분석

- 정체성·위로·전략의 3박자 구조로
  읽을수록 깊어지는 리포트

- 카카오 로그인으로 3초 시작

─────────────────────────
📌 이런 분께 추천해요
─────────────────────────

✔ 나 자신을 더 잘 이해하고 싶은 분
✔ 올해 재물운이 궁금한 분
✔ 연인과의 궁합이 걱정되는 분
✔ 매일 작은 방향키가 필요한 분

─────────────────────────

포르투나와 함께, 당신의 우주를 탐험하세요. 🌌

문의: picolab.kr
```

## 콘텐츠 등급 (IARC 설문)

- 카테고리: **점술/운세** (Lifestyle / Entertainment)
- 등급: **전체 연령**
- 폭력·성·도박·약물·욕설: 없음

## 개인정보 처리방침 URL

```
https://picolab.kr/privacy.html
```

## 데이터 보안 (Play Console — Data safety)

| 항목 | 수집 | 공유 | 목적 |
|---|---|---|---|
| 카카오 ID·닉네임·이메일 | O | X (카카오 로그인 인증만) | 계정 식별 |
| 생년월일·성별·출생시간 | O | X | 운세 분석 |
| 결제 정보 | X (PG사 직접) | X | — |
| 위치 정보 | X | X | — |
| IP·기기 정보 | O | X | 통계·오류 진단 |

- 모든 데이터: HTTPS 전송, Supabase·Cloudflare 저장
- 사용자 탈퇴 시 즉시 삭제
- 광고 ID 미수집

## 결제 정책 (한국 외부결제 정책 활용)

- charge.html 에 **결제 수단 선택 모달** 추가됨
  - Google Play 결제 (준비 중, 비활성)
  - 외부 결제 (포트원 + KG이니시스)
- 외부결제 선택 시 **Google 가이드라인 안내 모달** 필수 노출
  - "이 결제는 Google Play 외부에서 처리됩니다"
  - "Google Play의 구매 보호 정책이 적용되지 않을 수 있습니다"

## 등록 체크리스트

- [x] 짧은 설명 (28자)
- [x] 긴 설명 (사용자 제공)
- [x] 개인정보 처리방침 (privacy.html — 9조 운영자 정보 추가)
- [x] 이용약관 (terms.html — 환불·미성년자 조항 보강)
- [x] 결제 정책 대응 UI (charge.html 모달)
- [x] 앱 아이콘 512×512 (img/icon-512.png)
- [x] AAB 빌드 (Bubblewrap, F:/twa/picolab-twa)
- [ ] 스크린샷 폰 (최소 2장, 권장 5~8장)
- [ ] Play App Signing 키 등록 + assetlinks.json fingerprint 교체
- [ ] 사업자 등록 + 통신판매업 신고 → 정보 placeholder 채우기 (terms.html, privacy.html, charge.html)
- [ ] 내부 테스트 트랙 → 비공개 → 공개

---

## 인프라 비용·약관 체크리스트 (출시 전 필수)

### 🔴 Vercel Pro 업그레이드 (출시 전 필수)

**현재 상태**: fortuna-silk 가 Hobby 무료 플랜 사용 중 (비상업 한정 약관)
**위반 위험**: 매출 1원 발생 즉시 ToS 위반 → 함수 호출 차단 위험
**해결**:
1. https://vercel.com/account/plans 접속
2. fortuna-silk 프로젝트 owner 계정으로 Pro 업그레이드 ($20/월)
3. 결제 카드 등록 + 청구 주소 입력
4. 업그레이드 후 vercel.json 에 `"plan": "pro"` 명시 안 해도 됨 (자동 적용)

### 🟡 Supabase Pro (트래픽 늘면 필수)
- 현재: Free (DB 500MB / 50K MAU / 5GB 대역폭)
- 임계치: DAU 1,500 또는 누적 회원 50K 도달 전
- Pro: $25/월 (DB 8GB / 100K MAU / 100GB 대역폭)
- 모니터링: https://supabase.com/dashboard/project/ymghmfkqctckxxysxkvy → Settings → Usage

### 🟡 Cloudflare Workers Paid
- 현재: Free (100K req/일)
- 임계치: DAU 10K 도달 시 503 발생
- Paid: $5/월 (10M req/월, CPU 30s/req)
- 워커 fortuna 가 ziwei·saju·vedic·qimen·astro 다 처리 → 사용자 1명당 5~10 req

### 🟢 모니터링·알림 SOP

- Vercel: Project Settings → Usage Alerts (이메일 알림 ON)
- Supabase: Project → Settings → Billing → Usage notifications
- Cloudflare: Workers Analytics → 일일 사용량 80% 도달 시 알림 (텔레그램 봇 연동 가능)
- 텔레그램 운영자 알림: 메모리 [project_telegram_alert.md] 참고 — @kkdmbbot

### 🟢 사업자 등록 후 채워 넣을 placeholder 위치

| 파일 | 위치 |
|---|---|
| terms.html | 부칙 운영자 정보 (대표자/사업자번호/통신판매업/주소) |
| privacy.html | 9조 운영자 정보 |
| charge.html | footer biz-row 4개 (대표자/사업자번호/통신판매업/주소) |

모든 placeholder 는 빨간색 `[입력 필요]` 로 표시되어 있어 grep 으로 일괄 찾기 쉬움.

## 참고

- 사주/운세 앱은 한국 시장 IAP 강제 적용에 일부 예외 인정 가능 영역
- 단, "디지털 재화" (Orb) 충전이 명확하므로 IAP 의무 적용 대상
- 한국 외부결제 허용 정책으로 우회 (수수료 약 4% 추가)
