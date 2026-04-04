// PICO Lab 5대 운세 점수 엔진 — score.js
'use strict';

const SCORE_WORKER = 'https://fortuna.kkdmb7.workers.dev';

const SCORE_DOMAINS = ['money','love','health','wisdom','travel'];
const SCORE_DOMAIN_INFO = {
  money:  { emoji:'💼', label:'재물/사업' },
  love:   { emoji:'❤️', label:'관계/연애' },
  health: { emoji:'🏃', label:'건강/활력' },
  wisdom: { emoji:'🧠', label:'학업/창의' },
  travel: { emoji:'🌍', label:'이동/변화' },
};

function _clamp(v, lo=1, hi=100) { return Math.min(hi, Math.max(lo, Math.round(v))); }

function _angDist(a, b) { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; }

function _aspectScore(deg1, deg2) {
  const d = _angDist(deg1, deg2), orb = 10;
  if (d <= orb)                    return 78;  // conjunction
  if (Math.abs(d - 60)  <= orb)    return 75;  // sextile
  if (Math.abs(d - 120) <= orb)    return 82;  // trine
  if (Math.abs(d - 90)  <= orb)    return 28;  // square
  if (Math.abs(d - 180) <= orb)    return 22;  // opposition
  return 52;
}

// ── 사주 점수 ─────────────────────────────────────────────────
function _scoreSaju(data) {
  const base = { money:50, love:50, health:50, wisdom:50, travel:50 };
  if (!data || !data.five_pct) return base;

  const fp  = data.five_pct;
  const str = (data.summary && data.summary.strength) || '';
  const yn  = (data.yongshin && data.yongshin.primary) || '';

  // 분야별 오행 기여 가중치
  const W = {
    money:  { wood:0.2, fire:0.3, earth:0.3, metal:0.9, water:0.5 },
    love:   { wood:0.4, fire:0.9, earth:0.3, metal:0.1, water:0.4 },
    health: { wood:0.7, fire:0.4, earth:0.6, metal:0.2, water:0.8 },
    wisdom: { wood:0.3, fire:0.3, earth:0.2, metal:0.5, water:0.9 },
    travel: { wood:0.9, fire:0.6, earth:0.1, metal:0.3, water:0.5 },
  };
  const elems = ['wood','fire','earth','metal','water'];

  const out = {};
  for (const d of SCORE_DOMAINS) {
    const w = W[d];
    let sc = 0, tw = 0;
    for (const e of elems) { sc += (fp[e] || 0) * w[e]; tw += w[e]; }
    out[d] = _clamp(28 + sc / Math.max(1, tw) * 1.25);
  }

  // 신강/약 조정
  if (str.includes('신강'))      { out.money += 8; out.health += 8; out.love -= 5; }
  else if (str.includes('신약')) { out.wisdom += 7; out.love += 5; out.money -= 5; }

  // 용신 보너스
  const ynB = {
    fire:  { love:14, health:8 },
    water: { wisdom:14, health:8 },
    metal: { money:14, wisdom:6 },
    wood:  { travel:14, health:6 },
    earth: { money:8, health:8 },
  };
  if (yn && ynB[yn]) for (const [d, v] of Object.entries(ynB[yn])) out[d] += v;

  for (const d of SCORE_DOMAINS) out[d] = _clamp(out[d]);
  return out;
}

// ── 기문 점수 ─────────────────────────────────────────────────
const _DOOR_SC = {
  '休': { money:82, love:65, health:68, wisdom:58, travel:52 },
  '生': { money:62, love:72, health:92, wisdom:55, travel:60 },
  '傷': { money:30, love:36, health:22, wisdom:42, travel:48 },
  '杜': { money:26, love:30, health:28, wisdom:38, travel:26 },
  '景': { money:52, love:48, health:44, wisdom:84, travel:56 },
  '死': { money:16, love:20, health:12, wisdom:20, travel:14 },
  '驚': { money:20, love:26, health:18, wisdom:26, travel:22 },
  '開': { money:74, love:84, health:60, wisdom:66, travel:90 },
};
const _SHEN_BONUS = {
  '直符': { money:8, love:8, health:8, wisdom:8, travel:8 },
  '太陰': { love:12, wisdom:6 },
  '六合': { love:14, money:6 },
  '九地': { health:6, wisdom:10 },
  '九天': { travel:14, money:6 },
  '玄武': { money:-8, love:-6 },
  '騰蛇': { love:-8, travel:6 },
  '白虎': { money:8, health:-6 },
};

function _scoreQimen(data) {
  const out = { money:50, love:50, health:50, wisdom:50, travel:50 };
  if (!data || !data.palaces) return out;

  const zjm = data['직사문'];
  if (zjm && _DOOR_SC[zjm]) {
    for (const d of SCORE_DOMAINS) out[d] = _DOOR_SC[zjm][d] || 50;
  }

  // 직부궁 팔신 보너스
  const zfg  = data['직부궁'];
  const pal  = zfg && data.palaces[String(zfg)];
  const shen = pal && pal['팔신'];
  if (shen && _SHEN_BONUS[shen]) {
    for (const d of SCORE_DOMAINS) out[d] = _clamp(out[d] + (_SHEN_BONUS[shen][d] || 0));
  }

  for (const d of SCORE_DOMAINS) out[d] = _clamp(out[d]);
  return out;
}

// ── 점성술 점수 ───────────────────────────────────────────────
function _scoreAstro(data) {
  const out = { money:50, love:50, health:50, wisdom:50, travel:50 };
  if (!Array.isArray(data) || data.length === 0) return out;

  const byName = {};
  data.forEach(p => { if (p.name) byName[p.name] = p; });
  const { Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn } = byName;

  function asp(a, b) {
    if (!a || !b) return 52;
    return _aspectScore(a.fullDegree, b.fullDegree);
  }

  // 분야별 핵심 각도 평균
  out.money  = _clamp((asp(Jupiter, Venus) + asp(Venus, Sun))   / 2 + 4);
  out.love   = _clamp((asp(Venus, Moon)   + asp(Moon, Mars))    / 2 + 4);
  out.health = _clamp((asp(Sun, Mars)     + asp(Sun, Moon))     / 2 + 4);
  out.wisdom = _clamp((asp(Mercury, Jupiter) + asp(Mercury, Sun)) / 2 + 4);
  out.travel = _clamp((asp(Jupiter, Mercury) + asp(Jupiter, Moon)) / 2 + 4);

  // 토성 역행 전체 디버프
  if (Saturn && Saturn.isRetro === 'true') {
    for (const d of SCORE_DOMAINS) out[d] = _clamp(out[d] - 6);
  }

  return out;
}

// ── 베딕 점수 ─────────────────────────────────────────────────
const _DASHA_INF = {
  '목성': { money:+18, wisdom:+15, health:+6, love:+8 },
  '금성': { love:+20, money:+12, travel:+8 },
  '태양': { health:+16, wisdom:+10, money:+5 },
  '달':   { love:+13, health:+8, wisdom:+5 },
  '화성': { health:+12, travel:+12, money:+6 },
  '수성': { wisdom:+18, travel:+10, money:+5 },
  '토성': { money:-10, love:-8, health:-6, wisdom:+5, travel:-4 },
  '라후': { travel:+15, money:-8, love:-6 },
  '케투': { wisdom:+10, travel:+8, money:-8, love:-8 },
};
const _YOGA_EFF = { '길':+12, '흉':-12, '강화':+6 };

function _scoreVedic(data) {
  const out = { money:50, love:50, health:50, wisdom:50, travel:50 };
  if (!data) return out;

  // 아시타카바르가 (0-8 → 0-100)
  const akv = data.ashtakavarga || {};
  const get = k => (akv[k] || 4) * 12.5;

  out.money  = _clamp((get('목성') + get('금성'))  / 2);
  out.love   = _clamp((get('금성') + get('달'))    / 2);
  out.health = _clamp((get('태양') + get('화성'))  / 2);
  out.wisdom = _clamp((get('수성') + get('목성'))  / 2);
  out.travel = _clamp((get('목성') + get('수성'))  / 2);

  // 대운 보너스
  const maha  = data.currentDasha  && data.currentDasha.planet;
  const antar = data.antardasha    && data.antardasha.planet;

  if (maha && _DASHA_INF[maha]) {
    for (const [d, v] of Object.entries(_DASHA_INF[maha]))
      if (SCORE_DOMAINS.includes(d)) out[d] = _clamp(out[d] + v);
  }
  if (antar && _DASHA_INF[antar]) {
    for (const [d, v] of Object.entries(_DASHA_INF[antar]))
      if (SCORE_DOMAINS.includes(d)) out[d] = _clamp(out[d] + Math.round(v * 0.5));
  }

  // 요가
  (data.yogas || []).forEach(y => {
    const eff = _YOGA_EFF[y.effect] || 0;
    for (const d of SCORE_DOMAINS) out[d] = _clamp(out[d] + eff);
  });

  for (const d of SCORE_DOMAINS) out[d] = _clamp(out[d]);
  return out;
}

// ── 자미두수 점수 ─────────────────────────────────────────────
const _GOOD_STARS = new Set(['자미','천부','태양','태음','천동','천기','천량','천상','문창','문곡','좌보','우필','화록','화권','화과','천괴','천월','삼태','팔좌','천관','천복']);
const _BAD_STARS  = new Set(['칠살','파군','화기','경양','타라','천형','천요','음살']);
const _ZW_PAL_MAP = { money:'재백', love:'부처', health:'질액', wisdom:'관록', travel:'천이' };

function _scoreZiwei(data) {
  const out = { money:50, love:50, health:50, wisdom:50, travel:50 };
  if (!data || !Array.isArray(data.palaces)) return out;

  for (const [domain, palName] of Object.entries(_ZW_PAL_MAP)) {
    const palace = data.palaces.find(p => p.name && p.name.includes(palName));
    if (!palace) continue;
    let sc = 50;
    const all = [...(palace.majorStars||[]), ...(palace.minorStars||[]), ...(palace.adjStars||[])];
    all.forEach(s => {
      if (_GOOD_STARS.has(s)) sc += 14;
      else if (_BAD_STARS.has(s)) sc -= 12;
    });
    out[domain] = _clamp(sc);
  }

  // 현재 대운 궁 보너스
  const decName = data.currentDecade && data.currentDecade.name;
  if (decName) {
    for (const [domain, palName] of Object.entries(_ZW_PAL_MAP)) {
      if (decName.includes(palName)) out[domain] = _clamp(out[domain] + 18);
    }
  }

  return out;
}

// ── 종합 가중 합산 ────────────────────────────────────────────
const _WEIGHTS = { saju:0.30, qimen:0.25, astro:0.20, vedic:0.15, ziwei:0.10 };

function _combine(scores) {
  const out = {};
  for (const d of SCORE_DOMAINS) {
    let total = 0;
    for (const [src, w] of Object.entries(_WEIGHTS))
      total += (scores[src] && scores[src][d] != null ? scores[src][d] : 50) * w;
    out[d] = _clamp(total);
  }
  return out;
}

// ── 한줄 요약 ─────────────────────────────────────────────────
function _makeSummary(final, overall) {
  const best  = SCORE_DOMAINS.reduce((a, b) => final[a] >= final[b] ? a : b);
  const worst = SCORE_DOMAINS.reduce((a, b) => final[a] <= final[b] ? a : b);
  const bi = SCORE_DOMAIN_INFO[best], wi = SCORE_DOMAIN_INFO[worst];

  if (overall >= 78) return `오늘은 매우 좋은 흐름입니다. 특히 ${bi.emoji} ${bi.label}(${final[best]}점)에서 강한 기운이 흐릅니다. 적극적으로 행동하기 좋은 날!`;
  if (overall >= 65) return `긍정적인 에너지가 흐르는 날입니다. ${bi.emoji} ${bi.label}을 중심으로 움직이면 성과를 낼 수 있습니다.`;
  if (overall >= 52) return `평온한 하루입니다. ${bi.emoji} ${bi.label}(${final[best]}점)은 양호하지만 ${wi.emoji} ${wi.label}(${final[worst]}점) 쪽은 무리하지 않는 게 좋습니다.`;
  if (overall >= 40) return `다소 조심스러운 날입니다. ${wi.emoji} ${wi.label}(${final[worst]}점) 분야에서는 신중히 판단하세요.`;
  return `오늘은 차분하게 지내는 것이 좋습니다. 중요한 결정이나 도전적인 행동은 내일로 미루는 것을 권장합니다.`;
}

// ── 점수 색상 ─────────────────────────────────────────────────
function scoreColor(score) {
  if (score >= 80) return '#e8b86d'; // 금
  if (score >= 60) return '#4caf82'; // 초록
  if (score >= 40) return '#5b8dee'; // 파랑
  return '#e05c6a';                  // 빨강
}

function scoreLabel(score) {
  if (score >= 80) return '매우 좋음';
  if (score >= 65) return '좋음';
  if (score >= 50) return '보통';
  if (score >= 35) return '주의';
  return '어려움';
}

// ── 메인 함수 ─────────────────────────────────────────────────
async function calcFortuneScore(profile) {
  const { year, month, day, hour, minute, gender } = profile;
  const now  = new Date();
  const ny   = now.getFullYear(), nm = now.getMonth() + 1, nd = now.getDate();
  const nh   = now.getHours(), nmin = now.getMinutes();
  const todayStr = `${ny}.${String(nm).padStart(2,'0')}.${String(nd).padStart(2,'0')}`;

  // 오늘 캐시 확인
  const genderKey = (gender === 'M' || gender === 'male') ? 'M' : 'F';
  const cacheKey = `pico_score_${year}_${month}_${day}_${genderKey}_${todayStr}`;
  try {
    const cached = JSON.parse(localStorage.getItem(cacheKey));
    if (cached && cached.today === todayStr) return cached;
  } catch(e) {}

  const g    = (gender === 'M' || gender === 'male') ? 'male' : 'female';
  const hNum = (hour === 'unknown' || hour == null || hour === '') ? 12 : parseInt(hour);
  const mNum = parseInt(minute) || 0;
  const birthISO = `${year}-${String(parseInt(month)).padStart(2,'0')}-${String(parseInt(day)).padStart(2,'0')}T${String(hNum).padStart(2,'0')}:${String(mNum).padStart(2,'0')}:00`;

  const [sajuR, qimenR, astroR, vedicR, ziweiR] = await Promise.allSettled([
    fetch(`${SCORE_WORKER}/saju-test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ birth: birthISO, gender: g, calendar: 'solar', midnightType: 0 })
    }).then(r => r.json()),
    fetch(`${SCORE_WORKER}/qimen?year=${ny}&month=${nm}&day=${nd}&hour=${nh}&minute=${nmin}&type=siga`).then(r => r.json()),
    fetch(`${SCORE_WORKER}/astro`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year: parseInt(year), month: parseInt(month), day: parseInt(day), hour: hNum, min: mNum, tzone: 9 })
    }).then(r => r.json()),
    fetch(`${SCORE_WORKER}/vedic?year=${year}&month=${month}&day=${day}&hour=${hNum}&minute=${mNum}`).then(r => r.json()),
    fetch(`${SCORE_WORKER}/ziwei?year=${year}&month=${month}&day=${day}&hour=${hNum}&gender=${g}`).then(r => r.json()),
  ]);

  const saju  = sajuR.status  === 'fulfilled' ? sajuR.value  : null;
  const qimen = qimenR.status === 'fulfilled' ? qimenR.value : null;
  const astro = astroR.status === 'fulfilled' ? astroR.value : null;
  const vedic = vedicR.status === 'fulfilled' ? vedicR.value : null;
  const ziwei = ziweiR.status === 'fulfilled' ? ziweiR.value : null;

  const scores = {
    saju:  _scoreSaju(saju),
    qimen: _scoreQimen(qimen),
    astro: _scoreAstro(astro),
    vedic: _scoreVedic(vedic),
    ziwei: _scoreZiwei(ziwei),
  };

  const final   = _combine(scores);
  const overall = _clamp(Object.values(final).reduce((a, b) => a + b, 0) / SCORE_DOMAINS.length);
  const summary = _makeSummary(final, overall);
  const result  = { final, scores, overall, summary, today: todayStr, rawData: { saju, qimen, astro, vedic, ziwei } };

  // 오늘 결과 캐싱
  try { localStorage.setItem(cacheKey, JSON.stringify(result)); } catch(e) {}

  return result;
}
