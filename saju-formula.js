/**
 * saju-formula.js — 명리학 매핑 매트릭스 + 점수 공식 단일 모듈
 *
 * 목적: pico 전체 리포트(child_career, character, money, love, year, summary 등)에서
 *       오행/십신 → 능력/분야/기질/재물/관계 매핑을 단일 출처로 관리.
 *       공식 누락("어떤 능력에 어떤 십신이 빠졌는가") 문제를 매트릭스로 시각화·차단.
 *
 * 사용:
 *   <script src="saju-formula.js"></script>
 *   const sf = window.SajuFormula;
 *   const ctx = sf.fromSajuData(sd, ohList);
 *   const fields = sf.scoreCareerFields(ctx);
 *   const axes = sf.scoreTalentAxes(ctx);
 *   const dist = sf.distributeTopHeavy(fields, {pow:2.5, topBoost:1.25});
 *
 * 매트릭스 구조: 각 항목은 {oh:{목,화,토,금,수}, tg:{sik,in,gwan,jae,bige}, dayBoost:{...}}
 *   - 가중치 0~1 (오행), 0~2 (십신), 0~14 (일간 부스트)
 *   - 빈 셀이 곧 "공식 구멍" — 매트릭스 점검만으로 누락 발견 가능
 *
 * 명리학 원전 근거:
 *   - 적천수(滴天髓) 천간론: STEM_METAPHOR
 *   - 자평진전·연해자평 십신론: TG_TRAITS
 *   - 황제내경 오행배속: OH_TRAITS
 */
(function (root) {
  'use strict';

  // ─────────────────────────────────────────────────────────
  // 1. 기본 사전 (천간/오행/십신)
  // ─────────────────────────────────────────────────────────

  const STEM2OH = { 갑: '목', 을: '목', 병: '화', 정: '화', 무: '토', 기: '토', 경: '금', 신: '금', 임: '수', 계: '수' };
  const STEM_HANJA = { 갑: '甲', 을: '乙', 병: '丙', 정: '丁', 무: '戊', 기: '己', 경: '庚', 신: '辛', 임: '壬', 계: '癸' };
  const STEM_YINYANG = { 갑: '양', 병: '양', 무: '양', 경: '양', 임: '양', 을: '음', 정: '음', 기: '음', 신: '음', 계: '음' };
  const OH_LIST = ['목', '화', '토', '금', '수'];

  // 적천수 정통 비유 (수정 금지: 사용자 검증 완료)
  const STEM_METAPHOR = {
    갑: '뿌리 깊은 큰 나무',
    을: '유연하게 자라는 풀잎',
    병: '한낮의 태양',
    정: '은은한 등촉',
    무: '드넓은 산과 들',
    기: '비옥한 정원의 흙',
    경: '잘 벼린 강철검',
    신: '정련된 옥(玉)',
    임: '바다로 흐르는 큰 강',
    계: '촉촉한 새벽 이슬'
  };

  // 십신 그룹 (5분류)
  // sik = 식상(식신+상관), in = 인성(정인+편인), gwan = 관성(정관+편관),
  // jae = 재성(정재+편재), bige = 비겁(비견+겁재)
  const TG_KEYWORDS = {
    sik: ['식신', '상관'],
    in: ['정인', '편인'],
    gwan: ['정관', '편관'],
    jae: ['정재', '편재'],
    bige: ['비견', '겁재']
  };

  // ─────────────────────────────────────────────────────────
  // 2. 오행 본질 (참고용 메타데이터)
  // ─────────────────────────────────────────────────────────
  const OH_TRAITS = {
    목: { 신체: '간·근육·신경', 기질: '성장·인의·창의', 색: '청', 방위: '동' },
    화: { 신체: '심장·혈관·시력', 기질: '예의·열정·표현', 색: '적', 방위: '남' },
    토: { 신체: '비위·근육살', 기질: '신의·중재·안정', 색: '황', 방위: '중앙' },
    금: { 신체: '폐·뼈·피부', 기질: '의리·결단·정의', 색: '백', 방위: '서' },
    수: { 신체: '신장·혈액·뇌', 기질: '지혜·총명·유연', 색: '흑', 방위: '북' }
  };

  // 십신 본질 (자평진전 기반)
  const TG_TRAITS = {
    식신: { 본질: '여유·표현·온화한 창작', 직업: '예술·교육·요리·아동' },
    상관: { 본질: '재능발산·반항·천재성', 직업: '예술·연예·언론·기획' },
    정인: { 본질: '학문·자비·전통계승', 직업: '학자·교사·복지·종교' },
    편인: { 본질: '직관·전문성·독학', 직업: '연구·의료·역술·예술' },
    정관: { 본질: '책임·규범·관리', 직업: '공무원·행정·법조·관리직' },
    편관: { 본질: '용맹·결단·도전', 직업: '군경·운동·외과·CEO' },
    정재: { 본질: '근면·축적·실리', 직업: '회계·재무·은행·중소기업' },
    편재: { 본질: '활동·기회·사업감각', 직업: '사업·영업·투자·유통' },
    비견: { 본질: '독립·자주·동지', 직업: '자영업·운동·동업·전문직' },
    겁재: { 본질: '경쟁·돌파·승부욕', 직업: '운동·영업·창업·투자' }
  };

  // ─────────────────────────────────────────────────────────
  // 3. ★ 핵심 매트릭스 ★ — 능력/분야/기질/재물/관계 가중치
  //    가중치는 명리학 정통(자평진전·연해자평·적천수) 매핑 기준.
  //    빈 셀(0)은 의도적 — 해당 오행/십신이 그 항목에 영향 없다는 명시.
  // ─────────────────────────────────────────────────────────

  // 3-1. 8축 재능 (child_career 레이더 + 일반 재능 분석)
  const TALENT_AXES = {
    언어:       { oh: { 수: 0.5, 화: 0.2 },                tg: { in: 1.2, sik: 1.0 },          dayBoost: { 수: 12, 화: 5 } },
    수리논리:   { oh: { 금: 0.5, 수: 0.4 },                tg: { in: 0.8, gwan: 0.5 },         dayBoost: { 금: 12, 수: 8 } },
    대인관계:   { oh: { 화: 0.4, 토: 0.35 },               tg: { gwan: 1.0, jae: 0.7, bige: 0.4 }, dayBoost: { 화: 10, 토: 6 } },
    자연친화:   { oh: { 목: 0.6, 토: 0.3 },                tg: { in: 0.5 },                     dayBoost: { 목: 12, 토: 6 } },
    음악:       { oh: { 화: 0.4, 수: 0.3, 목: 0.2 },       tg: { sik: 1.4, in: 0.4 },          dayBoost: { 화: 10, 수: 5 } },
    공감:       { oh: { 수: 0.4, 토: 0.4 },                tg: { in: 1.2, sik: 0.4 },          dayBoost: { 수: 8, 토: 6 } },
    손재능:     { oh: { 토: 0.4, 금: 0.4 },                tg: { sik: 1.2, jae: 0.4 },         dayBoost: { 금: 8, 토: 6 } },
    신체운동:   { oh: { 금: 0.35, 목: 0.3, 화: 0.25 },     tg: { bige: 1.5, gwan: 1.2, sik: 0.7 }, dayBoost: { 금: 10, 목: 8, 화: 6 } }
  };

  // 3-2. 진로 분야 (child_career 빅버블) — 현대 21개 분야로 확장
  const CAREER_FIELDS = {
    '연구·학문':     { oh: { 수: 0.7, 금: 0.3 },             tg: { in: 1.4, sik: 0.3 },                     dayBoost: { 수: 14, 금: 6 },         color: '#1a5fa0', bg: '#6db4ff' },
    'AI·데이터':     { oh: { 수: 0.5, 금: 0.4, 화: 0.1 },    tg: { in: 1.0, sik: 1.0, gwan: 0.4 },          dayBoost: { 수: 12, 금: 10 },        color: '#1f3a8a', bg: '#7c8df5' },
    'IT·공학':       { oh: { 금: 0.5, 수: 0.4 },             tg: { sik: 0.8, gwan: 0.6, in: 0.3 },          dayBoost: { 금: 12, 수: 8 },         color: '#5a6a7a', bg: '#8aa0b8' },
    '공학·제조':     { oh: { 금: 0.5, 토: 0.3, 화: 0.2 },    tg: { gwan: 1.2, sik: 0.6 },                   dayBoost: { 금: 12, 토: 6 },         color: '#3a4a5a', bg: '#788ca0' },
    '예술·창작':     { oh: { 목: 0.5, 화: 0.5 },             tg: { sik: 1.5, in: 0.3 },                     dayBoost: { 화: 14, 목: 10 },        color: '#c2236a', bg: '#f489c4' },
    '방송·콘텐츠':   { oh: { 화: 0.5, 목: 0.3, 수: 0.2 },    tg: { sik: 1.6, jae: 0.6 },                    dayBoost: { 화: 12, 목: 6 },         color: '#d04a8a', bg: '#f49ac4' },
    '미디어·표현':   { oh: { 화: 0.6, 목: 0.2, 수: 0.2 },    tg: { sik: 1.4, jae: 0.4, in: 0.4 },           dayBoost: { 화: 12, 수: 5 },         color: '#b84c1a', bg: '#f4a062' },
    '경영·리더십':   { oh: { 목: 0.4, 금: 0.3, 화: 0.2 },    tg: { gwan: 1.2, jae: 0.8, bige: 0.6 },        dayBoost: { 목: 10, 금: 6 },         color: '#7a4e00', bg: '#f4d860' },
    '창업·스타트업': { oh: { 목: 0.4, 화: 0.3, 금: 0.2 },    tg: { jae: 1.2, sik: 1.0, bige: 0.8 },         dayBoost: { 목: 10, 화: 8 },         color: '#a05a00', bg: '#f4b048' },
    '금융·투자':     { oh: { 금: 0.5, 화: 0.2, 수: 0.2 },    tg: { jae: 1.4, gwan: 0.8, in: 0.4 },          dayBoost: { 금: 12, 수: 6 },         color: '#0a5a3a', bg: '#5ac49a' },
    '법률·행정':     { oh: { 금: 0.5, 토: 0.3, 수: 0.2 },    tg: { gwan: 1.5, in: 0.8 },                    dayBoost: { 금: 12, 토: 8 },         color: '#3a3a6a', bg: '#9a9ad4' },
    '의료·치유':     { oh: { 수: 0.4, 토: 0.3, 화: 0.2 },    tg: { in: 1.0, sik: 0.6, gwan: 0.5 },          dayBoost: { 수: 10, 토: 8 },         color: '#1a6a30', bg: '#7ad4a0' },
    '심리상담':      { oh: { 수: 0.5, 토: 0.3, 화: 0.2 },    tg: { in: 1.3, sik: 0.7 },                     dayBoost: { 수: 10, 토: 6 },         color: '#5a3a8a', bg: '#a48ad4' },
    '교육·복지':     { oh: { 토: 0.5, 화: 0.3, 수: 0.2 },    tg: { in: 1.2, sik: 0.6 },                     dayBoost: { 토: 12, 화: 6 },         color: '#3d7a3a', bg: '#7ad48f' },
    '건축·디자인':   { oh: { 목: 0.4, 토: 0.3, 화: 0.2 },    tg: { sik: 1.2, in: 0.5, gwan: 0.5 },          dayBoost: { 목: 10, 토: 8 },         color: '#7a5a2a', bg: '#c4a878' },
    '요리·식음료':   { oh: { 화: 0.4, 토: 0.4, 목: 0.2 },    tg: { sik: 1.4, jae: 0.7 },                    dayBoost: { 화: 10, 토: 8 },         color: '#a83018', bg: '#ec8a6a' },
    '농업·환경':     { oh: { 목: 0.5, 토: 0.4, 수: 0.1 },    tg: { in: 0.6, sik: 0.6, jae: 0.4 },           dayBoost: { 목: 14, 토: 8 },         color: '#3a6a1a', bg: '#9ec468' },
    '운동·체육':     { oh: { 금: 0.4, 목: 0.3, 화: 0.3 },    tg: { bige: 1.6, gwan: 1.2, sik: 0.5 },        dayBoost: { 금: 12, 목: 8, 화: 6 },  color: '#a02a2a', bg: '#e87878' },
    '서비스·외교':   { oh: { 화: 0.5, 토: 0.3, 수: 0.2 },    tg: { jae: 1.2, gwan: 0.8, sik: 0.5 },         dayBoost: { 화: 10, 토: 6 },         color: '#a05a8a', bg: '#d49ac4' },
    '군경·보안':     { oh: { 금: 0.5, 화: 0.2, 토: 0.2 },    tg: { gwan: 1.6, bige: 0.8, sik: 0.3 },        dayBoost: { 금: 14, 화: 4 },         color: '#2a3a5a', bg: '#6a7a9a' },
    '종교·영성':     { oh: { 수: 0.5, 토: 0.4 },             tg: { in: 1.5, sik: 0.4 },                     dayBoost: { 수: 12, 토: 8 },         color: '#5a3a18', bg: '#b89878' }
  };

  // 3-3. 기질 (character용)
  const CHARACTER_TRAITS = {
    창의력:  { oh: { 목: 0.5, 화: 0.4 },                  tg: { sik: 1.4, in: 0.3 } },
    분석력:  { oh: { 금: 0.5, 수: 0.5 },                  tg: { in: 1.2, gwan: 0.4 } },
    리더십:  { oh: { 목: 0.4, 화: 0.3, 금: 0.3 },         tg: { gwan: 1.2, bige: 0.8, jae: 0.4 } },
    표현력:  { oh: { 화: 0.6, 목: 0.3 },                  tg: { sik: 1.5, jae: 0.3 } },
    안정감:  { oh: { 토: 0.7, 금: 0.2 },                  tg: { in: 0.8, jae: 0.6 } },
    직관력:  { oh: { 수: 0.5, 화: 0.3 },                  tg: { in: 1.0, sik: 0.5 } },
    실행력:  { oh: { 금: 0.4, 화: 0.3, 목: 0.2 },         tg: { gwan: 1.0, sik: 0.6, bige: 0.5 } },
    공감력:  { oh: { 수: 0.4, 토: 0.4 },                  tg: { in: 1.2, sik: 0.4 } }
  };

  // 3-4. 재물 패턴 (money용)
  const MONEY_PATTERNS = {
    안정축적형:    { oh: { 토: 0.4, 금: 0.4 },             tg: { jae: 1.2, gwan: 0.8, in: 0.3 },         note: '꾸준히 모으는 직장·전문직' },
    사업가형:      { oh: { 목: 0.4, 화: 0.4 },             tg: { jae: 1.5, sik: 0.8, bige: 0.5 },        note: '편재+상관 활용 사업·유통' },
    전문직형:      { oh: { 수: 0.4, 금: 0.4 },             tg: { in: 1.2, gwan: 0.8 },                   note: '인성·정관 기반 전문가' },
    투자형:        { oh: { 화: 0.4, 금: 0.3, 수: 0.2 },    tg: { jae: 1.4, gwan: 0.6 },                  note: '편재·편관 결합 투자/사업' },
    직장형:        { oh: { 토: 0.4, 금: 0.3 },             tg: { gwan: 1.4, jae: 0.6, in: 0.4 },         note: '정관·정재 안정 봉급' },
    프리랜서형:    { oh: { 목: 0.4, 수: 0.3, 화: 0.2 },    tg: { sik: 1.3, jae: 0.7, bige: 0.6 },        note: '식상+편재 자유전문가' }
  };

  // 3-5. 관계 스타일 (love용)
  const LOVE_STYLES = {
    헌신형:        { oh: { 토: 0.5, 수: 0.3 },             tg: { in: 1.2, gwan: 0.7 },                   note: '정인+정관 안정·헌신' },
    카리스마형:    { oh: { 화: 0.4, 목: 0.3, 금: 0.2 },    tg: { gwan: 1.2, bige: 0.8 },                 note: '편관+비겁 강한 매력' },
    로맨틱형:      { oh: { 화: 0.5, 수: 0.3 },             tg: { sik: 1.2, in: 0.6 },                    note: '식상+인성 감성 표현' },
    신중형:        { oh: { 금: 0.4, 토: 0.4 },             tg: { gwan: 1.0, in: 1.0 },                   note: '정관+정인 신중 검토' },
    자유형:        { oh: { 목: 0.4, 화: 0.3 },             tg: { sik: 1.0, jae: 1.0, bige: 0.5 },        note: '상관+편재 구속싫음' },
    배려형:        { oh: { 수: 0.4, 토: 0.4 },             tg: { in: 1.0, sik: 0.7 },                    note: '인성+식신 따뜻함' }
  };

  // 3-6. 건강 영역 (참고용)
  const HEALTH_AREAS = {
    '간·신경계':   { oh: { 목: 1.0 },                                                                    note: '목 약 → 피로·근육경직, 목 강·과 → 화 부족 시 분노' },
    '심혈관·시력': { oh: { 화: 1.0 },                                                                    note: '화 약 → 순환저하·시력, 과 → 불면·심계' },
    '소화·근육':   { oh: { 토: 1.0 },                                                                    note: '토 약 → 소화·면역, 과 → 비만' },
    '호흡·뼈':     { oh: { 금: 1.0 },                                                                    note: '금 약 → 호흡기·피부, 과 → 골절·관절' },
    '신장·뇌':     { oh: { 수: 1.0 },                                                                    note: '수 약 → 신장·생식, 과 → 부종·우울' }
  };

  // 3-7. ★ 현대 직업 매트릭스 ★ — 100개 + 분야 + 시대 트렌드 + 한 줄 매칭 코멘트
  //   field: CAREER_FIELDS의 키와 일치
  //   era: '전통' / '안정' / '성장' / '미래' (시대 트렌드)
  //   trait: 적성 키워드 (내향/외향/분석/직관/안정/도전/단독/협업/정적/동적)
  //   hint: 추천 코멘트 (15~30자)
  const CAREER_JOBS = [
    // 연구·학문
    { name: '대학교수',         field: '연구·학문',     oh: { 수: 0.6, 금: 0.3 }, tg: { in: 1.5, sik: 0.4 },             dayBoost: { 수: 12, 금: 6 }, era: '안정', trait: '내향·분석·단독', hint: '깊이 있는 사유와 가르침의 균형' },
    { name: '연구원',           field: '연구·학문',     oh: { 수: 0.6, 금: 0.4 }, tg: { in: 1.4 },                       dayBoost: { 수: 12 },         era: '성장', trait: '내향·분석·정적', hint: '오랜 집중과 호기심이 강점' },
    { name: '학예사·큐레이터',  field: '연구·학문',     oh: { 수: 0.4, 토: 0.4 }, tg: { in: 1.2, sik: 0.5 },             dayBoost: { 수: 8, 토: 6 },   era: '안정', trait: '내향·정적·정밀', hint: '문화 자원의 해석가' },
    { name: '역사학자',         field: '연구·학문',     oh: { 수: 0.5, 토: 0.4 }, tg: { in: 1.5 },                       dayBoost: { 수: 10, 토: 6 },  era: '전통', trait: '내향·정적', hint: '시간의 결을 읽는 사람' },
    { name: '철학자·사상가',    field: '연구·학문',     oh: { 수: 0.7, 화: 0.2 }, tg: { in: 1.6 },                       dayBoost: { 수: 14 },         era: '전통', trait: '내향·직관·단독', hint: '본질을 묻는 정신' },

    // AI·데이터
    { name: 'AI엔지니어',       field: 'AI·데이터',     oh: { 수: 0.5, 금: 0.4 }, tg: { sik: 1.2, in: 0.8 },             dayBoost: { 수: 12, 금: 8 }, era: '미래', trait: '분석·창의·정적', hint: '데이터에서 패턴을 캐는 연금술사' },
    { name: '데이터사이언티스트', field: 'AI·데이터',   oh: { 수: 0.5, 금: 0.4 }, tg: { in: 1.2, sik: 0.8 },             dayBoost: { 수: 12, 금: 8 }, era: '미래', trait: '분석·정밀', hint: '숫자 너머의 의미를 본다' },
    { name: 'ML리서처',         field: 'AI·데이터',     oh: { 수: 0.6, 금: 0.4 }, tg: { in: 1.4, sik: 0.6 },             dayBoost: { 수: 14, 금: 8 }, era: '미래', trait: '내향·분석·단독', hint: '모델 구조 자체를 발명' },
    { name: '프롬프트엔지니어', field: 'AI·데이터',     oh: { 수: 0.4, 화: 0.3, 목: 0.2 }, tg: { sik: 1.3, in: 0.5 },    dayBoost: { 수: 10, 화: 6 },  era: '미래', trait: '직관·창의·언어', hint: 'AI와 대화하는 새 직업군' },
    { name: '데이터엔지니어',   field: 'AI·데이터',     oh: { 금: 0.5, 수: 0.4 }, tg: { gwan: 0.8, sik: 0.7 },           dayBoost: { 금: 12, 수: 8 }, era: '성장', trait: '정밀·실행', hint: '대규모 데이터 파이프라인 설계' },
    { name: 'AI윤리연구자',     field: 'AI·데이터',     oh: { 수: 0.5, 토: 0.3, 금: 0.2 }, tg: { in: 1.4, gwan: 0.6 },   dayBoost: { 수: 12, 토: 6 }, era: '미래', trait: '내향·신중', hint: '기술과 사회의 경계 조율' },

    // IT·공학
    { name: '풀스택개발자',     field: 'IT·공학',       oh: { 금: 0.4, 수: 0.4 }, tg: { sik: 1.0, gwan: 0.6 },           dayBoost: { 금: 10, 수: 8 }, era: '성장', trait: '실행·창의', hint: '한 사람으로 한 서비스를 짓는 사람' },
    { name: '백엔드개발자',     field: 'IT·공학',       oh: { 금: 0.5, 수: 0.4 }, tg: { in: 0.8, gwan: 0.8, sik: 0.5 },  dayBoost: { 금: 12, 수: 8 }, era: '성장', trait: '내향·정밀·단독', hint: '겉에 안 보이는 곳을 단단하게' },
    { name: '프론트엔드개발자', field: 'IT·공학',       oh: { 목: 0.3, 화: 0.3, 금: 0.3 }, tg: { sik: 1.2, jae: 0.4 },   dayBoost: { 화: 10, 목: 6 }, era: '성장', trait: '창의·실행', hint: '쓰는 사람의 첫 인상을 만든다' },
    { name: 'DevOps엔지니어',   field: 'IT·공학',       oh: { 금: 0.5, 토: 0.3 }, tg: { gwan: 1.2, in: 0.5, sik: 0.5 }, dayBoost: { 금: 12, 토: 8 }, era: '성장', trait: '실행·정밀·안정', hint: '시스템을 끊김 없이 돌게 한다' },
    { name: '보안전문가',       field: 'IT·공학',       oh: { 금: 0.6, 수: 0.3 }, tg: { gwan: 1.4, in: 0.6 },            dayBoost: { 금: 14, 수: 6 }, era: '성장', trait: '분석·신중', hint: '공격자의 시선으로 방어한다' },
    { name: '게임개발자',       field: 'IT·공학',       oh: { 목: 0.3, 화: 0.4, 금: 0.2 }, tg: { sik: 1.4, jae: 0.5 },   dayBoost: { 화: 10, 목: 8 }, era: '성장', trait: '창의·도전', hint: '세계를 통째로 만드는 사람' },
    { name: '블록체인개발자',   field: 'IT·공학',       oh: { 금: 0.5, 수: 0.4 }, tg: { gwan: 1.0, sik: 0.6, in: 0.4 }, dayBoost: { 금: 12, 수: 8 }, era: '미래', trait: '분석·도전', hint: '신뢰의 구조를 다시 짠다' },
    { name: '클라우드아키텍트', field: 'IT·공학',       oh: { 금: 0.4, 수: 0.4, 토: 0.2 }, tg: { gwan: 1.2, in: 0.6 },   dayBoost: { 금: 12, 수: 8 }, era: '성장', trait: '구조·실행', hint: '거대 인프라를 그림처럼 그린다' },

    // 공학·제조
    { name: '기계공학자',       field: '공학·제조',     oh: { 금: 0.5, 토: 0.3 }, tg: { gwan: 1.2, in: 0.6 },            dayBoost: { 금: 12, 토: 6 }, era: '안정', trait: '정밀·실행', hint: '움직이는 모든 것의 근본' },
    { name: '화학공학자',       field: '공학·제조',     oh: { 수: 0.4, 금: 0.4 }, tg: { in: 1.0, gwan: 0.6 },            dayBoost: { 수: 10, 금: 6 }, era: '안정', trait: '분석·정밀', hint: '물질의 변화를 설계한다' },
    { name: '항공우주엔지니어', field: '공학·제조',     oh: { 금: 0.4, 화: 0.3, 목: 0.2 }, tg: { gwan: 1.4, sik: 0.6 }, dayBoost: { 금: 12, 화: 8 }, era: '미래', trait: '도전·정밀', hint: '인간이 못 가본 곳을 향해' },
    { name: '전기전자엔지니어', field: '공학·제조',     oh: { 금: 0.5, 화: 0.3 }, tg: { sik: 1.0, gwan: 0.8 },           dayBoost: { 금: 10, 화: 6 }, era: '안정', trait: '정밀·실행', hint: '전류를 자유자재로 다룬다' },
    { name: '로봇공학자',       field: '공학·제조',     oh: { 금: 0.5, 수: 0.3 }, tg: { sik: 1.2, gwan: 1.0 },           dayBoost: { 금: 12, 수: 6 }, era: '미래', trait: '창의·정밀', hint: '기계에 의도를 부여하는 사람' },
    { name: '자동차엔지니어',   field: '공학·제조',     oh: { 금: 0.5, 토: 0.3, 화: 0.2 }, tg: { gwan: 1.2 },             dayBoost: { 금: 12, 토: 6 }, era: '안정', trait: '실행·정밀', hint: '안전과 성능을 동시에' },

    // 예술·창작
    { name: '화가',             field: '예술·창작',     oh: { 목: 0.4, 화: 0.5 }, tg: { sik: 1.5, in: 0.4 },             dayBoost: { 화: 12, 목: 8 }, era: '전통', trait: '내향·창의·정적', hint: '눈에 보이는 것 너머를 그린다' },
    { name: '조각가',           field: '예술·창작',     oh: { 목: 0.4, 토: 0.4 }, tg: { sik: 1.3, in: 0.4 },             dayBoost: { 토: 10, 목: 8 }, era: '전통', trait: '정적·정밀', hint: '단단한 것을 부드럽게' },
    { name: '작곡가',           field: '예술·창작',     oh: { 화: 0.4, 수: 0.4 }, tg: { sik: 1.5, in: 0.4 },             dayBoost: { 화: 12, 수: 8 }, era: '안정', trait: '직관·창의·정적', hint: '공기 중의 감정을 음으로' },
    { name: '시인·작가',        field: '예술·창작',     oh: { 수: 0.5, 화: 0.3 }, tg: { sik: 1.3, in: 1.0 },             dayBoost: { 수: 12, 화: 6 }, era: '전통', trait: '내향·언어·정적', hint: '말로 세상을 다시 만든다' },
    { name: '일러스트레이터',   field: '예술·창작',     oh: { 목: 0.4, 화: 0.4 }, tg: { sik: 1.5, jae: 0.5 },             dayBoost: { 화: 10, 목: 8 }, era: '성장', trait: '창의·정밀', hint: '한 장으로 메시지를 전한다' },
    { name: '캘리그라퍼',       field: '예술·창작',     oh: { 목: 0.3, 토: 0.4 }, tg: { sik: 1.2, in: 0.5 },             dayBoost: { 토: 8, 목: 6 },   era: '안정', trait: '정밀·정적', hint: '획 하나에 마음을 담는다' },

    // 방송·콘텐츠
    { name: '유튜버·크리에이터', field: '방송·콘텐츠',  oh: { 화: 0.4, 목: 0.3 }, tg: { sik: 1.6, jae: 0.8, bige: 0.4 },  dayBoost: { 화: 12, 목: 8 }, era: '미래', trait: '외향·창의·도전', hint: '나만의 채널이 곧 회사' },
    { name: '영상편집자',       field: '방송·콘텐츠',   oh: { 화: 0.4, 금: 0.3 }, tg: { sik: 1.3, in: 0.5 },             dayBoost: { 화: 10, 금: 6 }, era: '성장', trait: '정밀·창의', hint: '시간을 자르고 붙이는 마술사' },
    { name: '스트리머',         field: '방송·콘텐츠',   oh: { 화: 0.5, 목: 0.3 }, tg: { sik: 1.4, bige: 0.8, jae: 0.5 }, dayBoost: { 화: 12, 목: 8 }, era: '미래', trait: '외향·동적·도전', hint: '실시간으로 사람을 모은다' },
    { name: '팟캐스터',         field: '방송·콘텐츠',   oh: { 화: 0.4, 수: 0.3 }, tg: { sik: 1.3, in: 0.6 },             dayBoost: { 화: 10, 수: 6 }, era: '성장', trait: '언어·내향', hint: '목소리로 신뢰를 쌓는다' },
    { name: '시나리오작가',     field: '방송·콘텐츠',   oh: { 수: 0.4, 화: 0.4 }, tg: { sik: 1.5, in: 0.8 },             dayBoost: { 수: 10, 화: 8 }, era: '안정', trait: '내향·언어·창의', hint: '한 편의 세계를 글로 짓는다' },
    { name: '카피라이터',       field: '방송·콘텐츠',   oh: { 화: 0.4, 목: 0.3 }, tg: { sik: 1.5, jae: 0.5 },             dayBoost: { 화: 10, 목: 6 }, era: '안정', trait: '언어·창의', hint: '짧은 말이 가장 멀리 간다' },

    // 미디어·표현
    { name: '아나운서',         field: '미디어·표현',   oh: { 화: 0.5, 토: 0.3 }, tg: { sik: 1.0, gwan: 1.0 },           dayBoost: { 화: 12, 토: 6 }, era: '안정', trait: '외향·언어·정확', hint: '가장 정제된 목소리' },
    { name: '기자·저널리스트',  field: '미디어·표현',   oh: { 화: 0.4, 수: 0.4 }, tg: { sik: 1.3, in: 0.8 },             dayBoost: { 화: 10, 수: 8 }, era: '안정', trait: '도전·언어', hint: '감춰진 사실을 끄집어낸다' },
    { name: '방송PD',           field: '미디어·표현',   oh: { 화: 0.5, 목: 0.3 }, tg: { sik: 1.3, gwan: 0.8, jae: 0.4 }, dayBoost: { 화: 12, 목: 8 }, era: '안정', trait: '리더·창의', hint: '한 편의 프로그램을 지휘' },
    { name: '광고기획자',       field: '미디어·표현',   oh: { 화: 0.4, 목: 0.3, 수: 0.2 }, tg: { sik: 1.3, jae: 1.0 },   dayBoost: { 화: 10, 목: 8 }, era: '안정', trait: '창의·전략', hint: '한 줄로 제품을 이긴다' },

    // 경영·리더십
    { name: 'CEO·대표',         field: '경영·리더십',   oh: { 목: 0.4, 화: 0.3, 금: 0.2 }, tg: { gwan: 1.2, bige: 1.0, jae: 0.8 }, dayBoost: { 목: 10, 금: 6 }, era: '안정', trait: '리더·도전·외향', hint: '방향을 정하고 책임진다' },
    { name: 'COO·운영총괄',     field: '경영·리더십',   oh: { 금: 0.5, 토: 0.3 }, tg: { gwan: 1.4, in: 0.5 },            dayBoost: { 금: 12, 토: 8 }, era: '안정', trait: '실행·정밀', hint: '계획을 현실로 옮긴다' },
    { name: 'HR매니저',         field: '경영·리더십',   oh: { 화: 0.4, 토: 0.4 }, tg: { gwan: 1.0, in: 1.0, sik: 0.5 },  dayBoost: { 화: 8, 토: 8 },   era: '안정', trait: '협업·공감', hint: '사람과 조직 사이의 다리' },
    { name: '경영컨설턴트',     field: '경영·리더십',   oh: { 금: 0.4, 화: 0.3, 수: 0.2 }, tg: { in: 1.0, sik: 0.8, gwan: 0.6 }, dayBoost: { 금: 10, 화: 6 }, era: '성장', trait: '분석·전략·외향', hint: '문제를 구조로 본다' },
    { name: '프로젝트매니저',   field: '경영·리더십',   oh: { 금: 0.4, 토: 0.4 }, tg: { gwan: 1.4, sik: 0.5 },            dayBoost: { 금: 10, 토: 8 }, era: '성장', trait: '협업·실행', hint: '여러 흐름을 하나의 결과로' },

    // 창업·스타트업
    { name: '창업가·기업가',    field: '창업·스타트업', oh: { 목: 0.4, 화: 0.3, 금: 0.2 }, tg: { jae: 1.4, sik: 1.0, bige: 0.8 }, dayBoost: { 목: 12, 화: 8 }, era: '미래', trait: '도전·외향·리더', hint: '없던 것을 처음으로 만든다' },
    { name: 'VC·투자심사역',    field: '창업·스타트업', oh: { 금: 0.4, 화: 0.3, 수: 0.2 }, tg: { jae: 1.4, gwan: 0.8, in: 0.4 }, dayBoost: { 금: 10, 수: 6 }, era: '미래', trait: '분석·외향·전략', hint: '사람과 가능성에 베팅' },
    { name: '그로스해커',       field: '창업·스타트업', oh: { 화: 0.4, 금: 0.3, 수: 0.2 }, tg: { sik: 1.3, jae: 1.0 },   dayBoost: { 화: 10, 금: 6 }, era: '미래', trait: '창의·실험', hint: '데이터로 폭발 지점을 찾는다' },
    { name: '프로덕트매니저',   field: '창업·스타트업', oh: { 목: 0.3, 금: 0.3, 수: 0.3 }, tg: { sik: 1.0, gwan: 1.0, in: 0.5 }, dayBoost: { 목: 8, 금: 8 }, era: '성장', trait: '협업·전략·실행', hint: '왜·무엇·언제를 정한다' },
    { name: '스타트업CTO',      field: '창업·스타트업', oh: { 금: 0.5, 수: 0.3, 목: 0.2 }, tg: { sik: 1.0, gwan: 1.0, bige: 0.6 }, dayBoost: { 금: 12, 수: 8 }, era: '미래', trait: '리더·기술', hint: '기술의 방향키를 잡는다' },

    // 금융·투자
    { name: '펀드매니저',       field: '금융·투자',     oh: { 금: 0.4, 화: 0.3, 수: 0.2 }, tg: { jae: 1.4, gwan: 0.8 },  dayBoost: { 금: 12, 수: 6 }, era: '안정', trait: '분석·도전', hint: '자산의 흐름을 읽는다' },
    { name: '애널리스트',       field: '금융·투자',     oh: { 금: 0.5, 수: 0.4 }, tg: { in: 1.2, jae: 1.0 },             dayBoost: { 금: 12, 수: 8 }, era: '안정', trait: '내향·분석·정밀', hint: '숫자 뒤의 시나리오를 본다' },
    { name: '투자은행원',       field: '금융·투자',     oh: { 금: 0.5, 수: 0.3 }, tg: { jae: 1.3, gwan: 1.0 },            dayBoost: { 금: 12, 수: 6 }, era: '안정', trait: '분석·도전·정밀', hint: '자본의 빅 게임을 설계' },
    { name: '회계사',           field: '금융·투자',     oh: { 금: 0.5, 토: 0.3 }, tg: { jae: 1.4, gwan: 1.0 },            dayBoost: { 금: 12, 토: 8 }, era: '안정', trait: '정밀·신중', hint: '숫자의 진실을 증명한다' },
    { name: '세무사',           field: '금융·투자',     oh: { 금: 0.5, 토: 0.4 }, tg: { jae: 1.3, gwan: 0.8 },            dayBoost: { 금: 12, 토: 8 }, era: '안정', trait: '정밀·전문', hint: '복잡한 규칙의 길잡이' },
    { name: '핀테크개발자',     field: '금융·투자',     oh: { 금: 0.4, 수: 0.4 }, tg: { sik: 1.0, jae: 1.0 },             dayBoost: { 금: 10, 수: 8 }, era: '미래', trait: '창의·기술', hint: '돈의 흐름을 코드로 다시' },
    { name: '핀플루언서·재테크', field: '금융·투자',    oh: { 화: 0.4, 금: 0.3 }, tg: { sik: 1.3, jae: 1.2 },             dayBoost: { 화: 10, 금: 6 }, era: '미래', trait: '외향·언어', hint: '재테크를 콘텐츠로' },

    // 법률·행정
    { name: '변호사',           field: '법률·행정',     oh: { 금: 0.5, 수: 0.3 }, tg: { gwan: 1.4, in: 1.0 },             dayBoost: { 금: 12, 수: 6 }, era: '안정', trait: '논리·도전', hint: '말과 논리로 사람을 지킨다' },
    { name: '검사',             field: '법률·행정',     oh: { 금: 0.6, 토: 0.2 }, tg: { gwan: 1.5, in: 0.6 },             dayBoost: { 금: 14 },         era: '안정', trait: '논리·결단', hint: '공익의 검을 든 사람' },
    { name: '판사',             field: '법률·행정',     oh: { 금: 0.4, 토: 0.4 }, tg: { gwan: 1.3, in: 1.2 },             dayBoost: { 금: 10, 토: 8 }, era: '안정', trait: '신중·균형', hint: '저울을 다루는 사람' },
    { name: '공무원·행정직',    field: '법률·행정',     oh: { 토: 0.5, 금: 0.3 }, tg: { gwan: 1.3, in: 0.8 },             dayBoost: { 토: 12, 금: 6 }, era: '안정', trait: '안정·신중', hint: '사회의 뼈대를 지킨다' },
    { name: '외교관',           field: '법률·행정',     oh: { 화: 0.4, 토: 0.3, 수: 0.2 }, tg: { gwan: 1.2, jae: 0.6, in: 0.6 }, dayBoost: { 화: 8, 토: 6 }, era: '안정', trait: '외향·언어·전략', hint: '국가 사이의 다리' },
    { name: '국회의원·정치인',  field: '법률·행정',     oh: { 화: 0.4, 목: 0.3, 금: 0.2 }, tg: { gwan: 1.2, bige: 1.0 },  dayBoost: { 화: 10, 목: 8 }, era: '전통', trait: '외향·리더·도전', hint: '공동체의 방향을 결정' },

    // 의료·치유
    { name: '내과의사',         field: '의료·치유',     oh: { 수: 0.4, 화: 0.3, 토: 0.2 }, tg: { in: 1.2, gwan: 0.8 },   dayBoost: { 수: 10, 화: 6 }, era: '안정', trait: '신중·정밀', hint: '몸 전체를 종합으로 본다' },
    { name: '외과의사',         field: '의료·치유',     oh: { 금: 0.5, 화: 0.3 }, tg: { gwan: 1.4, sik: 0.6 },            dayBoost: { 금: 12, 화: 6 }, era: '안정', trait: '결단·정밀·도전', hint: '손끝의 결정이 곧 생명' },
    { name: '한의사',           field: '의료·치유',     oh: { 수: 0.4, 토: 0.4 }, tg: { in: 1.4, sik: 0.5 },             dayBoost: { 수: 10, 토: 8 }, era: '전통', trait: '직관·균형', hint: '오래된 지혜의 현대적 적용' },
    { name: '약사',             field: '의료·치유',     oh: { 수: 0.4, 금: 0.4 }, tg: { in: 1.2, jae: 0.6 },             dayBoost: { 수: 10, 금: 8 }, era: '안정', trait: '정밀·신중', hint: '약물의 미세한 차이를 안다' },
    { name: '간호사',           field: '의료·치유',     oh: { 수: 0.4, 토: 0.4 }, tg: { in: 1.0, sik: 1.0 },             dayBoost: { 수: 8, 토: 8 },   era: '안정', trait: '협업·공감·실행', hint: '환자 곁을 가장 가까이' },
    { name: '물리치료사',       field: '의료·치유',     oh: { 목: 0.4, 토: 0.3, 화: 0.2 }, tg: { sik: 1.0, in: 0.6 },    dayBoost: { 목: 8, 토: 6 },   era: '성장', trait: '동적·정밀', hint: '몸을 다시 움직이게 한다' },
    { name: '치과의사',         field: '의료·치유',     oh: { 금: 0.5, 토: 0.2, 수: 0.2 }, tg: { in: 1.0, gwan: 0.8 },   dayBoost: { 금: 12, 토: 6 }, era: '안정', trait: '정밀·단독', hint: '미세 손기술의 정점' },

    // 심리상담
    { name: '임상심리사',       field: '심리상담',      oh: { 수: 0.5, 토: 0.3 }, tg: { in: 1.4, sik: 0.6 },             dayBoost: { 수: 10, 토: 6 }, era: '성장', trait: '내향·공감·정밀', hint: '마음의 결을 읽는 전문가' },
    { name: '심리상담사',       field: '심리상담',      oh: { 수: 0.4, 토: 0.4 }, tg: { in: 1.3, sik: 0.7 },             dayBoost: { 수: 8, 토: 8 },   era: '성장', trait: '공감·언어', hint: '듣는 것이 곧 치유' },
    { name: '라이프코치',       field: '심리상담',      oh: { 화: 0.4, 토: 0.3, 수: 0.2 }, tg: { sik: 1.0, gwan: 1.0 },  dayBoost: { 화: 10, 토: 6 }, era: '미래', trait: '외향·동기부여', hint: '변화의 동반자' },
    { name: '정신과의사',       field: '심리상담',      oh: { 수: 0.5, 화: 0.2, 토: 0.2 }, tg: { in: 1.3, gwan: 0.8 },   dayBoost: { 수: 12, 토: 6 }, era: '성장', trait: '신중·전문', hint: '몸과 마음의 경계에서' },

    // 교육·복지
    { name: '초등교사',         field: '교육·복지',     oh: { 화: 0.3, 토: 0.4 }, tg: { sik: 1.2, in: 1.2 },             dayBoost: { 화: 8, 토: 10 },  era: '안정', trait: '협업·공감', hint: '인생의 첫 어른' },
    { name: '중등교사',         field: '교육·복지',     oh: { 토: 0.4, 수: 0.3 }, tg: { in: 1.4, sik: 0.6 },             dayBoost: { 토: 10, 수: 6 }, era: '안정', trait: '정적·전문', hint: '한 과목을 깊이 가르친다' },
    { name: '유아교사',         field: '교육·복지',     oh: { 화: 0.4, 토: 0.4 }, tg: { sik: 1.3, in: 1.0 },             dayBoost: { 화: 10, 토: 8 }, era: '안정', trait: '공감·동적', hint: '아이의 첫 사회를 만든다' },
    { name: '사회복지사',       field: '교육·복지',     oh: { 수: 0.3, 토: 0.5 }, tg: { in: 1.3, sik: 0.8 },             dayBoost: { 수: 6, 토: 12 }, era: '성장', trait: '공감·실행', hint: '제도의 손길이 닿는 곳' },
    { name: '특수교사',         field: '교육·복지',     oh: { 토: 0.4, 수: 0.3, 화: 0.2 }, tg: { in: 1.3, sik: 0.8 },    dayBoost: { 토: 10, 수: 6 }, era: '성장', trait: '인내·공감', hint: '느린 성장을 함께 걷는다' },

    // 건축·디자인
    { name: '건축가',           field: '건축·디자인',   oh: { 토: 0.4, 목: 0.3, 금: 0.2 }, tg: { sik: 1.0, in: 0.8, gwan: 0.6 }, dayBoost: { 토: 10, 목: 6 }, era: '안정', trait: '창의·전략·정밀', hint: '공간으로 삶의 방식을 짓는다' },
    { name: '인테리어디자이너', field: '건축·디자인',   oh: { 목: 0.4, 화: 0.3, 토: 0.2 }, tg: { sik: 1.4, jae: 0.5 },   dayBoost: { 목: 10, 화: 6 }, era: '성장', trait: '창의·감각', hint: '머무는 시간의 감정을 디자인' },
    { name: '도시계획가',       field: '건축·디자인',   oh: { 토: 0.5, 금: 0.3 }, tg: { gwan: 1.0, in: 1.0 },             dayBoost: { 토: 12, 금: 6 }, era: '미래', trait: '전략·신중', hint: '수십 년 후의 도시를 그린다' },
    { name: 'UX·UI디자이너',    field: '건축·디자인',   oh: { 목: 0.3, 수: 0.3, 화: 0.2 }, tg: { sik: 1.3, in: 0.8 },    dayBoost: { 목: 8, 수: 6 },   era: '성장', trait: '공감·창의', hint: '쓰는 사람의 마음을 그린다' },
    { name: '패션디자이너',     field: '건축·디자인',   oh: { 목: 0.3, 화: 0.4 }, tg: { sik: 1.5, jae: 0.8 },             dayBoost: { 화: 12, 목: 6 }, era: '안정', trait: '창의·도전', hint: '시대의 옷을 처음 입힌다' },
    { name: '그래픽디자이너',   field: '건축·디자인',   oh: { 목: 0.3, 화: 0.4 }, tg: { sik: 1.4, jae: 0.4 },             dayBoost: { 화: 10, 목: 6 }, era: '성장', trait: '창의·정밀', hint: '시각의 첫 인상을 만든다' },

    // 요리·식음료
    { name: '셰프',             field: '요리·식음료',   oh: { 화: 0.4, 토: 0.3, 목: 0.2 }, tg: { sik: 1.4, jae: 0.8 },   dayBoost: { 화: 10, 토: 8 }, era: '안정', trait: '창의·실행·도전', hint: '재료에 이야기를 더한다' },
    { name: '파티시에',         field: '요리·식음료',   oh: { 화: 0.3, 토: 0.4 }, tg: { sik: 1.4, in: 0.4 },             dayBoost: { 화: 8, 토: 10 }, era: '성장', trait: '정밀·창의', hint: '달콤함의 정밀 공학' },
    { name: '바리스타',         field: '요리·식음료',   oh: { 수: 0.3, 화: 0.4 }, tg: { sik: 1.2, jae: 0.6 },             dayBoost: { 수: 6, 화: 8 },   era: '성장', trait: '정밀·감각', hint: '한 잔의 균형감' },
    { name: '소믈리에',         field: '요리·식음료',   oh: { 수: 0.4, 화: 0.3, 토: 0.2 }, tg: { sik: 1.0, jae: 0.8, in: 0.5 }, dayBoost: { 수: 8, 화: 6 }, era: '안정', trait: '감각·전문', hint: '향과 시간의 큐레이터' },
    { name: '푸드스타일리스트', field: '요리·식음료',   oh: { 목: 0.3, 화: 0.4 }, tg: { sik: 1.3, jae: 0.7 },             dayBoost: { 화: 10, 목: 6 }, era: '성장', trait: '창의·감각', hint: '음식을 한 컷으로 살린다' },
    { name: '식음료기업가',     field: '요리·식음료',   oh: { 목: 0.3, 화: 0.3, 토: 0.3 }, tg: { jae: 1.4, sik: 1.0 },   dayBoost: { 화: 8, 토: 8 },   era: '안정', trait: '도전·실행', hint: '맛에 사업 감각을 더한다' },

    // 농업·환경
    { name: '스마트팜운영자',   field: '농업·환경',     oh: { 목: 0.4, 토: 0.4 }, tg: { sik: 1.0, jae: 0.8 },             dayBoost: { 목: 12, 토: 8 }, era: '미래', trait: '실행·기술', hint: '땅과 기술의 결합' },
    { name: '환경공학자',       field: '농업·환경',     oh: { 수: 0.4, 토: 0.4 }, tg: { in: 1.2, gwan: 0.6 },             dayBoost: { 수: 10, 토: 8 }, era: '미래', trait: '분석·신중', hint: '미래 세대에게 줄 세상' },
    { name: '조경설계사',       field: '농업·환경',     oh: { 목: 0.5, 토: 0.4 }, tg: { sik: 1.0, in: 0.6 },             dayBoost: { 목: 12, 토: 8 }, era: '안정', trait: '창의·정적', hint: '자연을 도시 안으로' },
    { name: '동물보호활동가',   field: '농업·환경',     oh: { 수: 0.3, 목: 0.3, 토: 0.3 }, tg: { in: 1.2, sik: 0.8 },    dayBoost: { 목: 10, 토: 6 }, era: '미래', trait: '공감·도전', hint: '말 못 하는 존재의 대변자' },

    // 운동·체육
    { name: '운동선수',         field: '운동·체육',     oh: { 금: 0.4, 목: 0.3, 화: 0.2 }, tg: { bige: 1.6, gwan: 1.2 }, dayBoost: { 금: 12, 목: 8 }, era: '전통', trait: '도전·동적·결단', hint: '한계를 매일 갱신' },
    { name: '스포츠코치',       field: '운동·체육',     oh: { 목: 0.4, 화: 0.3, 금: 0.2 }, tg: { gwan: 1.2, bige: 1.0, sik: 0.5 }, dayBoost: { 목: 8, 금: 6 }, era: '안정', trait: '리더·동적', hint: '선수의 또 다른 자신' },
    { name: '퍼스널트레이너',   field: '운동·체육',     oh: { 금: 0.4, 화: 0.3 }, tg: { sik: 1.0, bige: 1.0, gwan: 0.8 }, dayBoost: { 금: 10, 화: 6 }, era: '성장', trait: '동적·외향·실행', hint: '몸을 바꾸는 동행자' },
    { name: '체육교사',         field: '운동·체육',     oh: { 목: 0.4, 화: 0.3, 토: 0.2 }, tg: { gwan: 1.2, sik: 0.8 },  dayBoost: { 목: 8, 토: 6 },   era: '안정', trait: '리더·동적', hint: '땀의 가치를 가르친다' },
    { name: 'e스포츠선수',      field: '운동·체육',     oh: { 금: 0.4, 화: 0.3, 수: 0.2 }, tg: { bige: 1.4, sik: 1.0 },  dayBoost: { 금: 10, 화: 6 }, era: '미래', trait: '도전·정밀·집중', hint: '0.1초의 판단력' },
    { name: '무용가·안무가',    field: '운동·체육',     oh: { 화: 0.4, 목: 0.3 }, tg: { sik: 1.5, bige: 0.6 },            dayBoost: { 화: 10, 목: 8 }, era: '전통', trait: '동적·창의·표현', hint: '몸으로 쓰는 시' },

    // 서비스·외교
    { name: '호텔리어',         field: '서비스·외교',   oh: { 화: 0.4, 토: 0.4 }, tg: { jae: 1.0, sik: 1.0, gwan: 0.6 }, dayBoost: { 화: 10, 토: 8 }, era: '안정', trait: '외향·정밀', hint: '여행의 첫 환대' },
    { name: '항공승무원',       field: '서비스·외교',   oh: { 화: 0.5, 토: 0.3 }, tg: { sik: 1.0, gwan: 1.0, jae: 0.5 }, dayBoost: { 화: 12, 토: 6 }, era: '안정', trait: '외향·정밀·인내', hint: '구름 위의 안전과 환대' },
    { name: '통역사·번역가',    field: '서비스·외교',   oh: { 수: 0.4, 화: 0.3 }, tg: { in: 1.2, sik: 1.0 },             dayBoost: { 수: 10, 화: 6 }, era: '성장', trait: '언어·정밀·내향', hint: '두 언어 사이의 다리' },
    { name: '여행기획자',       field: '서비스·외교',   oh: { 목: 0.3, 화: 0.4 }, tg: { jae: 1.2, sik: 1.0 },             dayBoost: { 화: 10, 목: 6 }, era: '성장', trait: '창의·외향', hint: '시간을 경험으로 만든다' },
    { name: '이벤트플래너',     field: '서비스·외교',   oh: { 화: 0.5, 목: 0.3 }, tg: { sik: 1.2, jae: 1.0 },             dayBoost: { 화: 12, 목: 6 }, era: '성장', trait: '창의·실행·외향', hint: '하루를 평생의 기억으로' },

    // 군경·보안
    { name: '군인·장교',        field: '군경·보안',     oh: { 금: 0.5, 토: 0.3 }, tg: { gwan: 1.5, bige: 0.8 },           dayBoost: { 금: 14, 토: 6 }, era: '전통', trait: '리더·결단·도전', hint: '명령과 책임의 위계' },
    { name: '경찰',             field: '군경·보안',     oh: { 금: 0.5, 화: 0.2, 토: 0.2 }, tg: { gwan: 1.5, bige: 0.8 }, dayBoost: { 금: 14 },         era: '전통', trait: '결단·정의·동적', hint: '거리의 질서' },
    { name: '소방관',           field: '군경·보안',     oh: { 금: 0.4, 화: 0.3, 목: 0.2 }, tg: { gwan: 1.4, bige: 1.0 }, dayBoost: { 금: 10, 화: 8 }, era: '전통', trait: '도전·동적·헌신', hint: '불 속으로 들어가는 사람' },
    { name: '사이버보안전문가', field: '군경·보안',     oh: { 금: 0.5, 수: 0.4 }, tg: { gwan: 1.4, in: 0.8 },             dayBoost: { 금: 14, 수: 8 }, era: '미래', trait: '분석·신중·정밀', hint: '보이지 않는 전선의 수호자' },
    { name: '경호원',           field: '군경·보안',     oh: { 금: 0.5, 목: 0.3 }, tg: { bige: 1.4, gwan: 1.0 },           dayBoost: { 금: 12, 목: 8 }, era: '안정', trait: '결단·동적', hint: '한 사람의 안전이 임무' },

    // 종교·영성
    { name: '성직자',           field: '종교·영성',     oh: { 수: 0.4, 토: 0.5 }, tg: { in: 1.5, sik: 0.5 },             dayBoost: { 수: 10, 토: 10 }, era: '전통', trait: '내향·헌신', hint: '신성과 일상 사이의 안내자' },
    { name: '명상지도자',       field: '종교·영성',     oh: { 수: 0.5, 토: 0.4 }, tg: { in: 1.4, sik: 0.6 },             dayBoost: { 수: 10, 토: 8 }, era: '성장', trait: '내향·정적', hint: '고요로 사람을 가르친다' },
    { name: '역술가·명리상담',  field: '종교·영성',     oh: { 수: 0.5, 금: 0.3 }, tg: { in: 1.3, sik: 0.7 },             dayBoost: { 수: 12, 금: 6 }, era: '전통', trait: '직관·언어', hint: '시간의 결을 읽어준다' },
    { name: '풍수가',           field: '종교·영성',     oh: { 목: 0.3, 토: 0.4, 수: 0.2 }, tg: { in: 1.2, sik: 0.5 },    dayBoost: { 목: 8, 토: 8 },   era: '전통', trait: '직관·신중', hint: '공간의 기운을 읽는다' }
  ];

  // ─────────────────────────────────────────────────────────
  // 4. 사주 데이터 추출 헬퍼
  //    sd: POST /saju-test 응답
  //    ohList: [['목',N],...] 형식의 오행 리스트 (report.html 기존 변수)
  // ─────────────────────────────────────────────────────────

  function fromSajuData(sd, ohList) {
    const ohScore = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };
    if (Array.isArray(ohList)) {
      ohList.forEach(function (p) { ohScore[p[0]] = Number(p[1]) || 0; });
    } else if (sd && sd.five_pct) {
      const pct = sd.five_pct;
      ohScore.목 = pct.wood || 0; ohScore.화 = pct.fire || 0; ohScore.토 = pct.earth || 0;
      ohScore.금 = pct.metal || 0; ohScore.수 = pct.water || 0;
    }
    const tgm = (sd && sd.ten_gods_map) || {};
    const tgVals = Object.values(tgm).filter(Boolean);
    const tgCount = { sik: 0, in: 0, gwan: 0, jae: 0, bige: 0 };
    Object.keys(TG_KEYWORDS).forEach(function (key) {
      const kw = TG_KEYWORDS[key];
      tgCount[key] = tgVals.filter(function (v) {
        return kw.some(function (k) { return v.includes(k); });
      }).length;
    });
    const dayStem = (sd && sd.summary && sd.summary.pillars && sd.summary.pillars.day && sd.summary.pillars.day.stem) || '';
    const dayOh = STEM2OH[dayStem] || '';
    return { ohScore: ohScore, tgCount: tgCount, dayStem: dayStem, dayOh: dayOh, raw: sd };
  }

  // ─────────────────────────────────────────────────────────
  // 5. 점수 공식 (단일 진실)
  //    score = Σ(oh% × ohWeight) × OH_COEF
  //          + Σ(tgCount × tgWeight) × TG_COEF
  //          + dayBoost[dayOh]
  // ─────────────────────────────────────────────────────────

  const COEF = { OH: 0.55, TG: 5.5 };

  function scoreOne(matrixEntry, ctx) {
    const oh = matrixEntry.oh || {};
    const tg = matrixEntry.tg || {};
    const db = matrixEntry.dayBoost || {};
    let ohSum = 0;
    Object.keys(oh).forEach(function (k) { ohSum += (ctx.ohScore[k] || 0) * oh[k]; });
    let tgSum = 0;
    Object.keys(tg).forEach(function (k) { tgSum += (ctx.tgCount[k] || 0) * tg[k]; });
    const boost = db[ctx.dayOh] || 0;
    return ohSum * COEF.OH + tgSum * COEF.TG + boost;
  }

  function scoreMatrix(matrix, ctx) {
    const out = [];
    Object.keys(matrix).forEach(function (name) {
      const e = matrix[name];
      out.push(Object.assign({ name: name, score: scoreOne(e, ctx) }, {
        color: e.color || null, bg: e.bg || null, note: e.note || null
      }));
    });
    return out;
  }

  // 편의 함수: 매트릭스 직접 호출
  function scoreCareerFields(ctx) { return scoreMatrix(CAREER_FIELDS, ctx); }
  function scoreTalentAxes(ctx) {
    const arr = scoreMatrix(TALENT_AXES, ctx);
    // 레이블 표시용 가공
    const LABEL_MAP = { 수리논리: '수리·논리' };
    return arr.map(function (a) { return Object.assign({}, a, { label: LABEL_MAP[a.name] || a.name }); });
  }
  function scoreCharacterTraits(ctx) { return scoreMatrix(CHARACTER_TRAITS, ctx); }
  function scoreMoneyPatterns(ctx) { return scoreMatrix(MONEY_PATTERNS, ctx); }
  function scoreLoveStyles(ctx) { return scoreMatrix(LOVE_STYLES, ctx); }

  // 현대 직업 점수 (CAREER_JOBS 배열용)
  // opts: { topN, fieldFilter, eraFilter, traitMatch }
  function scoreCareerJobs(ctx, opts) {
    opts = opts || {};
    const arr = CAREER_JOBS.map(function (j) {
      const s = scoreOne(j, ctx);
      return Object.assign({}, j, { score: s });
    });
    let filtered = arr;
    if (opts.fieldFilter) filtered = filtered.filter(function (j) { return j.field === opts.fieldFilter; });
    if (opts.eraFilter) filtered = filtered.filter(function (j) { return j.era === opts.eraFilter; });
    if (opts.traitMatch) {
      filtered = filtered.filter(function (j) { return (j.trait || '').includes(opts.traitMatch); });
    }
    filtered.sort(function (a, b) { return b.score - a.score; });
    return opts.topN ? filtered.slice(0, opts.topN) : filtered;
  }

  // 분야별 직업 추출 (점수 정렬)
  function jobsByField(ctx, field, topN) {
    return scoreCareerJobs(ctx, { fieldFilter: field, topN: topN });
  }

  // 분야 + 직업 통합 추천 (TOP N개 분야의 TOP M개 직업)
  function recommendJobs(ctx, opts) {
    opts = opts || {};
    const topFieldsN = opts.topFields || 3;
    const jobsPerField = opts.jobsPerField || 3;
    const fieldDist = distributeTopHeavy(scoreCareerFields(ctx), { pow: 2.5, topBoost: 1.25 }).slice(0, topFieldsN);
    return fieldDist.map(function (f) {
      return {
        field: f.name,
        pct: f.pct,
        color: f.color,
        bg: f.bg,
        jobs: jobsByField(ctx, f.name, jobsPerField)
      };
    });
  }

  // ─────────────────────────────────────────────────────────
  // 6. 분포 가공 (TOP-heavy 거듭제곱 + 1위 부스트)
  // ─────────────────────────────────────────────────────────

  function distributeTopHeavy(items, opts) {
    const pow = (opts && opts.pow) || 2.5;
    const topBoost = (opts && opts.topBoost) || 1.25;
    const minPct = (opts && opts.minPct) || 2;
    const sorted = items.map(function (it, i) { return { i: i, s: it.score }; })
      .sort(function (a, b) { return b.s - a.s; });
    const topIdx = sorted[0] ? sorted[0].i : -1;
    const adj = items.map(function (it, i) { return i === topIdx ? it.score * topBoost : it.score; });
    const sumPow = adj.reduce(function (s, sc) { return s + Math.pow(Math.max(1, sc), pow); }, 0) || 1;
    return items.map(function (it, i) {
      const pw = Math.pow(Math.max(1, adj[i]), pow);
      return Object.assign({}, it, { pct: Math.max(minPct, Math.round(pw / sumPow * 100)) });
    }).sort(function (a, b) { return b.pct - a.pct; });
  }

  // 단순 정규화 (8축 레이더용)
  function normalizeAxis(items, opts) {
    const minNorm = (opts && opts.min) || 0.22;
    const max = Math.max.apply(null, items.map(function (a) { return a.score; })) || 1;
    return items.map(function (a) { return Object.assign({}, a, { norm: Math.max(minNorm, Math.min(1, a.score / max)) }); });
  }

  // ─────────────────────────────────────────────────────────
  // 7. 자가 검증 (구멍 탐지)
  //    각 매트릭스에서 어떤 오행/십신이 어디에도 안 쓰였는지 보고.
  //    개발 콘솔에서 SajuFormula.audit() 호출.
  // ─────────────────────────────────────────────────────────

  function audit() {
    const matrices = {
      TALENT_AXES: TALENT_AXES,
      CAREER_FIELDS: CAREER_FIELDS,
      CHARACTER_TRAITS: CHARACTER_TRAITS,
      MONEY_PATTERNS: MONEY_PATTERNS,
      LOVE_STYLES: LOVE_STYLES
    };
    const report = {};
    Object.keys(matrices).forEach(function (mName) {
      const m = matrices[mName];
      const ohUsed = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };
      const tgUsed = { sik: 0, in: 0, gwan: 0, jae: 0, bige: 0 };
      Object.keys(m).forEach(function (item) {
        const e = m[item];
        Object.keys(e.oh || {}).forEach(function (k) { ohUsed[k] += 1; });
        Object.keys(e.tg || {}).forEach(function (k) { tgUsed[k] += 1; });
      });
      const itemsCount = Object.keys(m).length;
      report[mName] = {
        items: itemsCount,
        오행커버: ohUsed,
        십신커버: tgUsed,
        구멍_오행: Object.keys(ohUsed).filter(function (k) { return ohUsed[k] === 0; }),
        구멍_십신: Object.keys(tgUsed).filter(function (k) { return tgUsed[k] === 0; }),
        커버율: {
          오행: Object.values(ohUsed).filter(function (v) { return v > 0; }).length + '/5',
          십신: Object.values(tgUsed).filter(function (v) { return v > 0; }).length + '/5'
        }
      };
    });
    // CAREER_JOBS는 배열이므로 별도 점검
    const jobOhUsed = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };
    const jobTgUsed = { sik: 0, in: 0, gwan: 0, jae: 0, bige: 0 };
    const jobFieldUsed = {};
    const jobEraUsed = {};
    CAREER_JOBS.forEach(function (j) {
      Object.keys(j.oh || {}).forEach(function (k) { jobOhUsed[k] += 1; });
      Object.keys(j.tg || {}).forEach(function (k) { jobTgUsed[k] += 1; });
      jobFieldUsed[j.field] = (jobFieldUsed[j.field] || 0) + 1;
      jobEraUsed[j.era] = (jobEraUsed[j.era] || 0) + 1;
    });
    // 분야별 직업 미보유 탐지
    const fieldsWithoutJobs = Object.keys(CAREER_FIELDS).filter(function (f) { return !jobFieldUsed[f]; });
    report.CAREER_JOBS = {
      items: CAREER_JOBS.length,
      오행커버: jobOhUsed,
      십신커버: jobTgUsed,
      분야별직업수: jobFieldUsed,
      시대별직업수: jobEraUsed,
      구멍_오행: Object.keys(jobOhUsed).filter(function (k) { return jobOhUsed[k] === 0; }),
      구멍_십신: Object.keys(jobTgUsed).filter(function (k) { return jobTgUsed[k] === 0; }),
      구멍_분야: fieldsWithoutJobs,
      커버율: {
        오행: Object.values(jobOhUsed).filter(function (v) { return v > 0; }).length + '/5',
        십신: Object.values(jobTgUsed).filter(function (v) { return v > 0; }).length + '/5',
        분야: (Object.keys(CAREER_FIELDS).length - fieldsWithoutJobs.length) + '/' + Object.keys(CAREER_FIELDS).length
      }
    };
    if (typeof console !== 'undefined' && console.table) {
      console.group('[SajuFormula.audit] 매트릭스 커버리지 점검');
      Object.keys(report).forEach(function (k) {
        console.log(k, report[k]);
      });
      console.groupEnd();
    }
    return report;
  }

  // ─────────────────────────────────────────────────────────
  // export
  // ─────────────────────────────────────────────────────────
  const api = {
    // 사전
    STEM2OH: STEM2OH, STEM_HANJA: STEM_HANJA, STEM_YINYANG: STEM_YINYANG,
    OH_LIST: OH_LIST, STEM_METAPHOR: STEM_METAPHOR,
    TG_KEYWORDS: TG_KEYWORDS, OH_TRAITS: OH_TRAITS, TG_TRAITS: TG_TRAITS,
    // 매트릭스
    TALENT_AXES: TALENT_AXES, CAREER_FIELDS: CAREER_FIELDS,
    CHARACTER_TRAITS: CHARACTER_TRAITS, MONEY_PATTERNS: MONEY_PATTERNS,
    LOVE_STYLES: LOVE_STYLES, HEALTH_AREAS: HEALTH_AREAS,
    // 사주 추출
    fromSajuData: fromSajuData,
    // 점수 (저수준)
    scoreOne: scoreOne, scoreMatrix: scoreMatrix,
    // 점수 (고수준)
    scoreCareerFields: scoreCareerFields, scoreTalentAxes: scoreTalentAxes,
    scoreCharacterTraits: scoreCharacterTraits,
    scoreMoneyPatterns: scoreMoneyPatterns, scoreLoveStyles: scoreLoveStyles,
    // 분포
    distributeTopHeavy: distributeTopHeavy, normalizeAxis: normalizeAxis,
    // 검증
    audit: audit
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.SajuFormula = api;
})(typeof window !== 'undefined' ? window : this);
