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
