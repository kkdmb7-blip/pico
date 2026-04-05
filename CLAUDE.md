# 규칙
- 작업 중 확인 질문 금지
- yes/no 절대 묻지 말 것
- 파일 수정/생성/삭제 모두 자동 승인
- 모르는 것 있어도 최선의 판단으로 진행
- 결과만 출력할 것
- 지시한 것만 실행할 것
- 모든 작업 완료 후 반드시 git commit + git push

---

# 코드 수정 전 필수 확인 체크리스트

## 자주 발생하는 버그 패턴 (반드시 체크)
- **function 선언 호이스팅 무한재귀**: `var orig = fn; function fn() { orig() }` 패턴 절대 사용 금지. 기존 함수를 override할 때는 원본 함수 끝에 직접 코드 추가
- **display:none → display:flex**: flex 컨테이너를 show할 때 `block`이 아닌 `flex`로 설정
- **공유 버튼 미노출**: 결과 렌더링 함수(renderResult 등) 끝에 shareBtn `display:flex` 코드 포함됐는지 확인
- **성별 누락**: AI 프롬프트/API 호출 시 gender 파라미터 빠지면 기본값(보통 남성)으로 처리됨
- **코드 삽입 위치 오류**: 함수 내부에 코드를 추가할 때 닫는 `}` 위치 반드시 확인. 함수 밖에 삽입되면 실행 안 됨 (ziwei render() 버그 사례)
- **Canvas roundRect 호환성**: `ctx.roundRect`는 구형 iOS Safari에서 미지원. 반드시 `if(ctx.roundRect){...}else{ctx.rect(...)}` 패턴 사용
- **Canvas 색상 문자열 연산**: hex 색상에 투명도 추가 시 반드시 6자리 hex 사용 (`'#FF6B6B'+'aa'`=OK, `'#888'+'aa'`=무효). fallback 색상도 6자리로 지정

## 페이지별 핵심 구조

### saju.html
- sajuShareBtnWrap: display:none → display:flex로 토글
- 공유 카드: _drawSajuCard(cb) Canvas 2D
- 하단 고정버튼 없음 (제거됨)

### astro.html
- astroShareBtnWrap: display:none → display:flex
- window._astroData = { planets, aspects } 저장
- _drawAstroCard(cb): 빅3(태양/달/상승) + 행성 목록

### vedic.html
- vedicShareBtnWrap: display:none → display:flex
- window._vedicData 저장
- _drawVedicCard(cb): 달/낙샤트라/상승 + 다샤 + 행성

### ziwei.html
- ziweiShareBtnWrap: display:none → display:flex
- window._ziweiData 저장 (render() 함수 내부에서 저장)
- _drawZiweiCard(cb): 명주성/신주성/오행국 + 현재대한 + 명궁 주성

### qimen.html
- qimenShareBtnWrap: display:none → display:flex
- window._qimenData 저장
- _drawQimenCard(): Canvas 2D 9궁 그리드
- renderResult() 함수 끝에 공유 데이터 저장 코드 포함

## 공유 버튼 표준 스타일 (모든 페이지 동일)
- 카카오 버튼: background:#fee500; color:#3c1e1e; border-radius:14px; padding:14px 0; width:100%
- AI상담 버튼: background:linear-gradient(135deg,#7b5ea7,#a07fd4); color:#fff; 동일 크기
- 두 버튼 flex 컨테이너, gap:10px, align-items:center
