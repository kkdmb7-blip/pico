(function() {
  'use strict';

  var PET_KEY   = 'yongsin_pet';
  var FOUND_KEY = 'yongsin_found_today';
  var HIDE_KEY  = 'yongsin_float_hidden';
  var ADVICE_KEY = 'yongsin_float_advice';

  var SB_URL = 'https://ymghmfkqctckxxysxkvy.supabase.co';
  var SB_KEY = 'sb_publishable_3-9zobXqx6Nv36LzmNMBpA_fohZqA5x';
  var PICO_PET_URL = 'https://picolab.kr/yongsin-pet.html';

  var IS_PICO = (window.location.hostname === 'picolab.kr' || window.location.hostname === 'localhost');

  // ── 상태 (picolab: localStorage / 외부: Supabase 후 주입) ──
  var _overrideState = null;

  function getTodayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  function getPetState() {
    if (_overrideState) return _overrideState;
    try { return JSON.parse(localStorage.getItem(PET_KEY)) || {}; } catch(e) { return {}; }
  }

  function getElement() {
    return getPetState().element || null;
  }

  var ELEM_STYLE = {
    wood:  { bg: '#1a6630', glow: 'rgba(26,102,48,0.5)',  emoji: '🌿' },
    fire:  { bg: '#c62828', glow: 'rgba(198,40,40,0.5)',  emoji: '🔥' },
    earth: { bg: '#6a4a10', glow: 'rgba(106,74,16,0.5)',  emoji: '🪨' },
    metal: { bg: '#5a5a4a', glow: 'rgba(90,90,74,0.5)',   emoji: '💎' },
    water: { bg: '#1565c0', glow: 'rgba(21,101,192,0.5)', emoji: '💧' },
  };

  var POSITIONS = [
    { x: 5,  y: 20,  hide: false },
    { x: 80, y: 15,  hide: false },
    { x: 10, y: 60,  hide: false },
    { x: 75, y: 55,  hide: false },
    { x: 40, y: 80,  hide: false },
    { x: 5,  y: 40,  hide: false },
    { x: 82, y: 70,  hide: false },
    { x: -3, y: 30,  hide: true  },
    { x: 88, y: 45,  hide: true  },
    { x: 30, y: -3,  hide: true  },
    { x: 50, y: 85,  hide: true,  partial: true },
  ];

  var pet, bubble, wrapper;
  var currentPos = 0;
  var moveTimer, hideTimer, bubbleTimer;
  var isHiding = false;
  var MOVE_TRANSITION = 'left 1.8s cubic-bezier(0.34,1.2,0.64,1), top 1.8s cubic-bezier(0.34,1.2,0.64,1)';

  // ── 이미지 ──
  function getPetStageIdx() {
    var lv = getPetState().level || 1;
    return Math.min(Math.floor(lv / 3), 5);
  }

  var IMG_BASE = IS_PICO ? '' : 'https://picolab.kr';

  function buildPetSVG(elem) {
    var s = ELEM_STYLE[elem] || ELEM_STYLE.water;
    if (elem === 'wood') {
      var stageIdx = getPetStageIdx();
      var _wfm = { 0:'pet_wood_1_rb.png', 1:'pet_wood_2-removebg-preview.png', 2:'pet_wood_3-removebg-preview.png', 3:'pet_wood_4-removebg-preview.png', 4:'pet_wood_5_rb.png', 5:'pet_wood_9.png' };
      var src = IMG_BASE + '/img/' + (_wfm[stageIdx] || _wfm[4]);
      return '<img src="' + src + '" alt="목 용신" style="width:48px;height:48px;object-fit:contain;" crossorigin="anonymous">';
    }
    if (elem === 'fire') {
      var fn = getPetStageIdx() + 1;
      return '<img src="' + IMG_BASE + '/img/pet_fire_' + fn + '.png" alt="화 용신" style="width:48px;height:48px;object-fit:contain;" crossorigin="anonymous">';
    }
    if (elem === 'earth') {
      var en = getPetStageIdx() + 1;
      return '<img src="' + IMG_BASE + '/img/pet_earth_' + en + '.png" alt="토 용신" style="width:48px;height:48px;object-fit:contain;" crossorigin="anonymous">';
    }
    if (elem === 'metal') {
      var mn = Math.min(getPetStageIdx() + 1, 2);
      return '<img src="' + IMG_BASE + '/img/pet_metal_' + mn + '.png" alt="금 용신" style="width:48px;height:48px;object-fit:contain;" crossorigin="anonymous">';
    }
    return `
      <svg width="40" height="50" viewBox="0 0 40 50" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 2 C20 2 36 20 36 32 C36 42 29 50 20 50 C11 50 4 42 4 32 C4 20 20 2 20 2Z" fill="#1976d2"/>
        <path d="M20 2 C20 2 36 20 36 32 C36 42 29 50 20 50 C11 50 4 42 4 32 C4 20 20 2 20 2Z" fill="url(#wg)"/>
        <defs><linearGradient id="wg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#64b5f6" stop-opacity="0.6"/><stop offset="100%" stop-color="#0d47a1" stop-opacity="0"/></linearGradient></defs>
        <ellipse cx="14" cy="22" rx="5" ry="6" fill="white" opacity="0.25"/>
        <circle cx="15" cy="33" r="3.5" fill="white"/>
        <circle cx="25" cy="33" r="3.5" fill="white"/>
        <circle cx="16" cy="34" r="2" fill="#0d1a3a"/>
        <circle cx="26" cy="34" r="2" fill="#0d1a3a"/>
        <path d="M16 40 Q20 43 24 40" stroke="white" stroke-width="1.5" fill="none" stroke-linecap="round"/>
      </svg>`;
  }

  // ── 위치 ──
  function moveTo(pos) {
    var vw = window.innerWidth, vh = window.innerHeight;
    var x = Math.round(vw * pos.x / 100) + window.scrollX;
    var y = Math.round(vh * pos.y / 100) + window.scrollY;
    x = Math.max(-20, Math.min(vw - 30 + window.scrollX, x));
    y = Math.max(-20, Math.min(document.body.scrollHeight - 30, y));
    wrapper.style.left = x + 'px';
    wrapper.style.top  = y + 'px';
    isHiding = !!pos.hide;
    var hint = document.getElementById('yongsin-float-hint');
    if (hint) hint.style.opacity = isHiding ? '1' : '0';
  }

  function pickNextPos() {
    var visible = POSITIONS.filter(function(p) { return !p.hide; });
    var hidden  = POSITIONS.filter(function(p) { return p.hide; });
    var pool = Math.random() < 0.3 ? hidden : visible;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function scheduleMove() {
    clearTimeout(moveTimer);
    var delay = 8000 + Math.random() * 12000;
    moveTimer = setTimeout(function() {
      var pos = pickNextPos();
      moveTo(pos);
      if (pos.hide) showBubble('...', 1500);
      scheduleMove();
    }, delay);
  }

  // ── 말풍선 ──
  function positionBubble() {
    var rect = pet.getBoundingClientRect();
    var bw = bubble.offsetWidth || 200;
    var left = Math.max(8, Math.min(window.innerWidth - bw - 8, rect.left + rect.width / 2 - bw / 2));
    var top = rect.top - bubble.offsetHeight - 10;
    if (top < 8) top = rect.bottom + 10;
    bubble.style.left = left + 'px';
    bubble.style.top  = top + 'px';
  }

  function showBubble(text, duration) {
    var boldColors = { wood:'#7dff8a', fire:'#ffaa44', earth:'#ffd700', metal:'#c8e6ff', water:'#66d4ff' };
    var bc = boldColors[getElement()] || '#ffd700';
    var lines = text.split('\n');
    var textDiv = bubble.firstChild;
    textDiv.innerHTML = lines.map(function(l, i) {
      var esc = l.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      return i === 0 ? '<b style="color:' + bc + '">' + esc + '</b>' : esc;
    }).join('<br>');
    positionBubble();
    bubble.style.opacity = '1';
    clearTimeout(bubbleTimer);
    if (duration > 0) bubbleTimer = setTimeout(function() { bubble.style.opacity = '0'; }, duration);
  }

  // ── 파티클 ──
  var PARTICLE_MAP = {
    wood:  ['🌿','🍃','🌱','🍀','✨','🌿'],
    fire:  ['🔥','💥','✨','🌟','⚡','🔥'],
    earth: ['⛰️','⭐','🌰','✨','💛','🌍'],
    metal: ['💎','✨','⭐','💫','🌟','💎'],
    water: ['💧','🌊','❄️','✨','💙','💧'],
  };

  function spawnParticles() {
    var elem = getElement() || 'water';
    var emojis = PARTICLE_MAP[elem] || PARTICLE_MAP.water;
    var rect = pet.getBoundingClientRect();
    var cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    for (var i = 0; i < 12; i++) {
      (function(idx) {
        setTimeout(function() {
          var p = document.createElement('div');
          p.textContent = emojis[Math.floor(Math.random() * emojis.length)];
          var angle = Math.random() * 360 * Math.PI / 180;
          var dist = 70 + Math.random() * 80;
          var tx = Math.cos(angle) * dist, ty = -Math.abs(Math.sin(angle) * dist) - 30;
          var size = 14 + Math.random() * 12, dur = (1.1 + Math.random() * 0.4).toFixed(2);
          p.style.cssText = 'position:fixed;left:'+cx+'px;top:'+cy+'px;font-size:'+size+'px;pointer-events:none;z-index:10001;transform:translate(-50%,-50%);transition:transform '+dur+'s cubic-bezier(0.2,0.8,0.4,1),opacity '+dur+'s ease-out;opacity:1;';
          document.body.appendChild(p);
          requestAnimationFrame(function() { requestAnimationFrame(function() {
            p.style.transform = 'translate(calc(-50% + '+tx+'px),calc(-50% + '+ty+'px)) scale(0.6)';
            p.style.opacity = '0';
          }); });
          setTimeout(function() { if (p.parentNode) p.parentNode.removeChild(p); }, 1600);
        }, idx * 55);
      })(i);
    }
  }

  // ── 클릭 콘텐츠 ──
  var TAP_MODES = ['fortune', 'pet_status', 'yongsin_tip', 'lucky_draw'];
  var tapModeIdx = 0;

  var ELEM_TIPS = {
    wood:  ['초록색 옷이 오늘 행운을 불러요 🌿', '동쪽 방향이 유리해요 🧭', '나무 소재 물건이 좋아요 🪵', '채소 먹으면 기운 올라요 🥗', '오전에 중요한 일 처리해요 ☀️'],
    fire:  ['빨간색 아이템 챙겨봐요 🔴', '남쪽이 오늘의 방향이에요 🌞', '따뜻한 음료가 좋아요 ☕', '밝은 조명 아래서 일해요 💡', '오후 2~4시가 집중력 피크예요 ⚡'],
    earth: ['노란색이 오늘 행운색이에요 🟡', '실내·중앙이 안정적이에요 🏠', '뿌리채소가 좋아요 🥕', '묵직한 가방이 행운이에요 👜', '규칙적인 식사가 중요해요 🍱'],
    metal: ['흰색 또는 금색이 좋아요 ⚪', '서쪽 방향을 주목하세요 🧭', '견과류가 에너지를 줘요 🥜', '금속 소품이 행운이에요 💍', '오전 일정이 잘 풀려요 📋'],
    water: ['검정·파란색이 행운이에요 💙', '북쪽이 유리한 방향이에요 🧭', '물을 많이 마셔요 💧', '해산물이 기운을 북돋아요 🐟', '밤 시간 집중력이 올라요 🌙'],
  };

  var LUCK_TABLE = [
    { label: '대길 🎉', msg: '오늘은 뭘 해도 잘 풀려요!', w: 8 },
    { label: '길 ✨',   msg: '순조로운 하루가 될 거예요',  w: 22 },
    { label: '소길 🌟', msg: '작은 행운들이 찾아올 거예요', w: 30 },
    { label: '평 😌',   msg: '무난하게 흘러가는 하루예요',  w: 22 },
    { label: '소흉 😅', msg: '서두르지 말고 신중하게 가요', w: 12 },
    { label: '흉 😬',   msg: '오늘은 조용히 내실을 다져요', w: 6  },
  ];

  function weightedRandom(table) {
    var total = table.reduce(function(s, t) { return s + t.w; }, 0);
    var r = Math.random() * total;
    for (var i = 0; i < table.length; i++) { r -= table[i].w; if (r <= 0) return table[i]; }
    return table[0];
  }

  function fetchTodayAdvice(cb) {
    var today = getTodayStr();
    try {
      var cached = JSON.parse(localStorage.getItem(ADVICE_KEY) || '{}');
      if (cached.date === today && cached.advice && !cached.advice.includes('{')) { cb(cached); return; }
    } catch(e) {}
    var ps = getPetState();
    var profile = {};
    try { profile = JSON.parse(localStorage.getItem('pico_profile') || '{}'); } catch(e) {}
    var yongsin = localStorage.getItem('pico_yongsin') || localStorage.getItem('_yongsin_cached') || ps.element || '';
    fetch('https://fortuna-silk.vercel.app/api/pet-advice', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ yongsin: yongsin, element: ps.element, profile: profile })
    }).then(function(r) { return r.json(); }).then(function(data) {
      var result = { date: today, advice: data.advice || '', keyword: data.keyword || '', lucky: data.lucky || '' };
      try { localStorage.setItem(ADVICE_KEY, JSON.stringify(result)); } catch(e) {}
      cb(result);
    }).catch(function() { cb(null); });
  }

  function showPetStatus() {
    var state = getPetState();
    var lv = state.level || 1;
    showBubble([
      'Lv.' + lv + ' 상태 보고 📊',
      '🍖 ' + ((state.hunger||0) < 30 ? '배고파요 😢' : (state.hunger||0) > 75 ? '배불러요 😊' : '보통이에요'),
      '😊 ' + ((state.happy||0) < 30 ? '심심해요 🥺' : (state.happy||0) > 75 ? '너무 행복해요 🥰' : '괜찮아요'),
      '⚡ ' + ((state.energy||0) < 30 ? '피곤해요 😴' : (state.energy||0) > 75 ? '에너지 넘쳐요 💪' : '적당해요'),
    ].join('\n'), 0);
  }

  function showYongsinTip() {
    var elem = getElement() || 'water';
    var tips = ELEM_TIPS[elem] || ELEM_TIPS.water;
    showBubble('오늘의 용신 팁 💫\n' + tips[Math.floor(Math.random() * tips.length)], 0);
  }

  function showLuckyDraw() {
    var frames = ['🎲 뽑는 중...', '🎰 두근두근...', '✨ 거의 다 됐어요...'];
    var fi = 0; showBubble(frames[fi], 0);
    var interval = setInterval(function() {
      fi++;
      if (fi < frames.length) { showBubble(frames[fi], 0); }
      else { clearInterval(interval); var r = weightedRandom(LUCK_TABLE); showBubble('오늘의 운 뽑기!\n' + r.label + '\n' + r.msg, 0); }
    }, 600);
  }

  function onPetClick() {
    var today = getTodayStr();
    var found = IS_PICO ? localStorage.getItem(FOUND_KEY) : null;

    pet.style.animation = 'none'; void pet.offsetWidth;
    pet.style.animation = 'pet-found 0.6s ease';
    setTimeout(function() { pet.style.animation = 'pet-idle 2.5s ease-in-out infinite'; }, 700);
    spawnParticles();

    // EXP 지급 (picolab에서만, 오늘 처음)
    if (IS_PICO && found !== today) {
      localStorage.setItem(FOUND_KEY, today);
      var state = getPetState();
      state.hunger = Math.min(100, (state.hunger || 20) + 15);
      state.happy  = Math.min(100, (state.happy  || 20) + 20);
      state.exp    = (state.exp || 0) + 10;
      var needed = Math.pow(state.level || 1, 2) * 100;
      if (state.exp >= needed) { state.exp -= needed; state.level = (state.level || 1) + 1; }
      state.lastVisit = Date.now();
      try { localStorage.setItem(PET_KEY, JSON.stringify(state)); } catch(e) {}
      var lvEl = document.getElementById('yongsin-float-lv');
      var fillEl = document.getElementById('yongsin-float-efill');
      if (lvEl) lvEl.textContent = 'Lv.' + (state.level || 1);
      if (fillEl) fillEl.style.width = Math.round(state.energy || 0) + '%';
    }

    var mode = TAP_MODES[tapModeIdx % TAP_MODES.length]; tapModeIdx++;
    if (mode === 'fortune') {
      showBubble('운세 읽는 중... ✨', 0);
      fetchTodayAdvice(function(data) {
        if (!data || !data.advice) { showBubble('오늘도 용신 기운을 잘 활용해요! 🌟', 0); return; }
        var text = (data.keyword ? '✦ ' + data.keyword + '\n' : '') + data.advice + (data.lucky ? '\n🍀 ' + data.lucky : '');
        showBubble(text, 0);
      });
    } else if (mode === 'pet_status') { showPetStatus();
    } else if (mode === 'yongsin_tip') { showYongsinTip();
    } else if (mode === 'lucky_draw')  { showLuckyDraw(); }
  }

  // ── 펫 빌드 ──
  function buildPet() {
    var elem = getElement();
    var s = ELEM_STYLE[elem] || ELEM_STYLE.water;
    var ps = getPetState();

    wrapper = document.createElement('div');
    wrapper.id = 'yongsin-float-wrapper';
    wrapper.style.cssText = [
      'position:absolute', 'z-index:9999', 'pointer-events:none',
      'transition:left 1.8s cubic-bezier(0.34,1.2,0.64,1), top 1.8s cubic-bezier(0.34,1.2,0.64,1)',
      'left:10px', 'top:20%', 'width:64px',
    ].join(';');

    // 말풍선
    bubble = document.createElement('div');
    bubble.style.cssText = [
      'position:fixed', 'background:rgba(26,18,10,0.92)', 'color:#fcf7ea',
      'padding:10px 30px 10px 14px', 'border-radius:14px', 'font-size:13px', 'font-weight:500',
      'white-space:normal', 'max-width:200px', 'width:max-content', 'text-align:center',
      'line-height:1.55', 'opacity:0', 'transition:opacity 0.3s', 'pointer-events:auto',
      'z-index:10000', "font-family:'Pretendard Variable',Pretendard,'Noto Sans KR',sans-serif",
      'box-shadow:0 4px 16px rgba(0,0,0,0.3)',
    ].join(';');
    var bubbleText = document.createElement('div');
    bubble.appendChild(bubbleText);
    var bubbleClose = document.createElement('button');
    bubbleClose.textContent = '✕';
    bubbleClose.style.cssText = 'position:absolute;top:5px;right:7px;background:none;border:none;color:rgba(252,247,234,0.7);font-size:14px;cursor:pointer;padding:4px;line-height:1;min-width:22px;min-height:22px;';
    bubbleClose.addEventListener('pointerdown', function(e) {
      e.stopPropagation(); clearTimeout(bubbleTimer); bubble.style.opacity = '0';
    });
    bubble.appendChild(bubbleClose);
    document.body.appendChild(bubble);

    // 레벨 뱃지 (wrapper에 → overflow 잘림 없음)
    var lvBadge = document.createElement('div');
    lvBadge.id = 'yongsin-float-lv';
    lvBadge.style.cssText = [
      'position:absolute', 'top:2px', 'right:2px',
      'background:' + s.bg, 'color:#fff', 'font-size:9px', 'font-weight:700', 'line-height:1',
      'padding:2px 5px', 'border-radius:6px', 'border:1.5px solid #f9f1de',
      'pointer-events:none', "font-family:'Pretendard Variable',Pretendard,sans-serif", 'z-index:2',
    ].join(';');
    lvBadge.textContent = 'Lv.' + (ps.level || 1);
    wrapper.appendChild(lvBadge);

    // 펫 버튼
    pet = document.createElement('button');
    pet.style.cssText = [
      'width:52px', 'height:52px', 'border-radius:50%', 'border:2px solid ' + s.bg,
      'background:#f9f1de', 'cursor:pointer', 'padding:0',
      'display:flex', 'align-items:center', 'justify-content:center',
      'box-shadow:0 0 12px ' + s.glow + ', 0 3px 10px rgba(0,0,0,0.15)',
      'pointer-events:auto', 'touch-action:none', '-webkit-touch-callout:none',
      '-webkit-user-select:none', 'user-select:none',
      'transition:transform 0.2s, box-shadow 0.2s',
      'animation:pet-idle 2.5s ease-in-out infinite',
      'position:relative', 'overflow:hidden', 'margin:6px auto 0',
    ].join(';');
    pet.setAttribute('aria-label', '용신 찾기');
    pet.innerHTML = buildPetSVG(elem);

    // 숨김 힌트
    var hint = document.createElement('div');
    hint.id = 'yongsin-float-hint';
    hint.style.cssText = [
      'position:absolute', 'width:24px', 'height:24px', 'border-radius:50%',
      'background:' + s.bg, 'border:2px solid white', 'bottom:-8px', 'right:-8px',
      'display:flex', 'align-items:center', 'justify-content:center',
      'font-size:12px', 'opacity:0', 'transition:opacity 0.3s',
    ].join(';');
    hint.textContent = s.emoji;
    pet.appendChild(hint);

    pet.addEventListener('click', onPetClick);
    pet.addEventListener('mouseenter', function() {
      pet.style.transform = 'scale(1.15)';
      pet.style.boxShadow = '0 0 20px ' + s.glow + ', 0 4px 16px rgba(0,0,0,0.2)';
    });
    pet.addEventListener('mouseleave', function() {
      pet.style.transform = '';
      pet.style.boxShadow = '0 0 12px ' + s.glow + ', 0 3px 10px rgba(0,0,0,0.15)';
    });

    wrapper.appendChild(pet);

    // 에너지 바 (원형 아래 살짝 겹치게, wrapper에 배치)
    var energyBar = document.createElement('div');
    energyBar.id = 'yongsin-float-ebar';
    energyBar.style.cssText = 'width:48px;height:7px;background:rgba(255,255,255,0.25);border-radius:4px;margin:-4px auto 0;overflow:hidden;border:1px solid rgba(255,255,255,0.18);box-shadow:0 1px 4px rgba(0,0,0,0.25);';
    var energyFill = document.createElement('div');
    energyFill.id = 'yongsin-float-efill';
    var energyPct = Math.round(ps.energy || 0);
    energyFill.style.cssText = 'height:100%;width:' + energyPct + '%;background:' + s.bg + ';border-radius:4px;transition:width 0.6s;box-shadow:0 0 4px ' + s.glow + ';';
    energyBar.appendChild(energyFill);
    wrapper.appendChild(energyBar);

    // CSS 애니메이션
    var style = document.createElement('style');
    style.textContent = `
      @keyframes pet-idle {
        0%,100% { transform: translateY(0) rotate(0deg); }
        30% { transform: translateY(-5px) rotate(-3deg); }
        70% { transform: translateY(-3px) rotate(3deg); }
      }
      @keyframes pet-found {
        0% { transform: scale(1); }
        30% { transform: scale(1.3) rotate(-10deg); }
        60% { transform: scale(1.2) rotate(10deg); }
        100% { transform: scale(1); }
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(wrapper);
  }

  // ── 더블클릭 ──
  function setupDoubleClick() {
    var clickCount = 0, clickTimer;
    pet.addEventListener('click', function() {
      clickCount++;
      if (clickCount === 1) {
        clickTimer = setTimeout(function() { clickCount = 0; }, 400);
      } else if (clickCount >= 2) {
        clearTimeout(clickTimer); clickCount = 0;
        if (IS_PICO) { window.location.href = '/yongsin-pet.html'; }
        else { window.open(PICO_PET_URL, '_blank'); }
      }
    });
  }

  // ── 드래그 (500ms 길게 누르기) ──
  function setupDrag() {
    var longPressTimer = null, dragging = false;
    var dragOffX = 0, dragOffY = 0, didDrag = false;
    var startX = 0, startY = 0, activePointerId = null;
    var s = ELEM_STYLE[getElement()] || ELEM_STYLE.water;

    pet.addEventListener('pointerdown', function(e) {
      if (e.button && e.button !== 0) return;
      startX = e.clientX; startY = e.clientY; didDrag = false; activePointerId = e.pointerId;
      longPressTimer = setTimeout(function() {
        longPressTimer = null; dragging = true;
        try { pet.setPointerCapture(activePointerId); } catch(ev) {}
        clearTimeout(moveTimer);
        wrapper.style.transition = 'none'; wrapper.style.willChange = 'left, top';
        pet.style.transform = 'scale(1.25)';
        pet.style.boxShadow = '0 0 28px ' + s.glow + ', 0 8px 24px rgba(0,0,0,0.3)';
        var rect = wrapper.getBoundingClientRect();
        dragOffX = e.clientX - rect.left; dragOffY = e.clientY - rect.top;
        showBubble('잡았다! 🫴', 1200);
        try { navigator.vibrate && navigator.vibrate(50); } catch(ev) {}
      }, 500);
    });

    pet.addEventListener('pointermove', function(e) {
      if (longPressTimer && (Math.abs(e.clientX - startX) > 8 || Math.abs(e.clientY - startY) > 8)) {
        clearTimeout(longPressTimer); longPressTimer = null;
      }
      if (!dragging) return;
      e.preventDefault(); didDrag = true;
      var x = e.clientX + window.scrollX - dragOffX;
      var y = e.clientY + window.scrollY - dragOffY;
      x = Math.max(0, Math.min(document.documentElement.scrollWidth - 64, x));
      y = Math.max(0, Math.min(document.body.scrollHeight - 64, y));
      wrapper.style.left = x + 'px'; wrapper.style.top = y + 'px';
    }, { passive: false });

    function endDrag(e) {
      if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
      if (!dragging) return;
      dragging = false;
      try { pet.releasePointerCapture(activePointerId); } catch(ev) {}
      wrapper.style.transition = MOVE_TRANSITION; wrapper.style.willChange = '';
      pet.style.transform = '';
      pet.style.boxShadow = '0 0 12px ' + s.glow + ', 0 3px 10px rgba(0,0,0,0.15)';
      showBubble('여기 놔둘게요 😊', 1500);
      scheduleMove();
      if (didDrag) {
        var stopClick = function(ev) { ev.stopImmediatePropagation(); pet.removeEventListener('click', stopClick, true); };
        pet.addEventListener('click', stopClick, true);
      }
    }
    pet.addEventListener('pointerup', endDrag);
    pet.addEventListener('pointercancel', endDrag);
  }

  function setupContextMenu() {
    pet.addEventListener('contextmenu', function(e) { e.preventDefault(); });
  }

  // ── 등장 ──
  function init() {
    buildPet();
    setupDoubleClick();
    setupDrag();
    setupContextMenu();

    var startPos = POSITIONS[Math.floor(Math.random() * 5)];
    moveTo(startPos);
    wrapper.style.opacity = '0'; wrapper.style.transform = 'scale(0)';
    wrapper.style.transition += ', opacity 0.5s, transform 0.5s';
    setTimeout(function() {
      wrapper.style.opacity = '1'; wrapper.style.transform = 'scale(1)';
      showBubble('여기 있어요 👀', 2000);
    }, 1500);
    scheduleMove();
  }

  // ── 실행 ──
  if (window.location.pathname.indexOf('yongsin-pet') !== -1) return;

  if (IS_PICO) {
    // picolab: localStorage에서 직접 읽기
    if (!getElement()) return;
    try { if (localStorage.getItem(HIDE_KEY) === getTodayStr()) return; } catch(e) {}
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      setTimeout(init, 500);
    }
  } else {
    // 외부 도메인 (memox 등): Supabase에서 펫 상태 조회
    var uid = null;
    try {
      var ku = JSON.parse(localStorage.getItem('fortuna_kakao_user') || '{}');
      uid = ku.id || (ku.kakao_id ? 'kakao_' + ku.kakao_id : null);
    } catch(e) {}
    if (!uid) return;

    function fetchAndApply(onNew) {
      fetch(SB_URL + '/rest/v1/reports?user_id=eq.' + encodeURIComponent(uid) + '&report_type=eq.pet_state&select=content&order=created_at.desc&limit=1', {
        headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY }
      }).then(function(r) { return r.json(); }).then(function(rows) {
        if (!rows || !rows[0] || !rows[0].content || !rows[0].content[0]) return;
        try {
          var raw = JSON.parse(rows[0].content[0]);
          var elem = raw.element;
          if (!elem) return;
          var stats = (raw.all && raw.all[elem]) ? raw.all[elem] : raw;
          var newState = Object.assign({ element: elem }, stats);
          // 원소가 바뀌었으면 펫 재생성
          var prevElem = _overrideState ? _overrideState.element : null;
          _overrideState = newState;
          if (onNew) { onNew(); }
          else if (prevElem && prevElem !== elem && wrapper) {
            // 원소 변경 → 기존 펫 제거 후 재생성
            clearTimeout(moveTimer);
            if (bubble && bubble.parentNode) bubble.parentNode.removeChild(bubble);
            if (wrapper && wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
            pet = null; bubble = null; wrapper = null;
            init();
          } else if (wrapper) {
            // 같은 원소 → 레벨/에너지 바만 갱신
            var lvEl = document.getElementById('yongsin-float-lv');
            var fillEl = document.getElementById('yongsin-float-efill');
            if (lvEl) lvEl.textContent = 'Lv.' + (newState.level || 1);
            if (fillEl) fillEl.style.width = Math.round(newState.energy || 0) + '%';
          }
        } catch(e) {}
      }).catch(function() {});
    }

    // 용신 미각성 유저용 알 버튼
    function showEggButton() {
      if (document.getElementById('yongsin-egg-btn')) return;
      var egg = document.createElement('button');
      egg.id = 'yongsin-egg-btn';
      egg.style.cssText = [
        'position:fixed','bottom:80px','right:16px',
        'width:52px','height:60px',
        'background:linear-gradient(160deg,#fff9f0,#f0e8d8)',
        'border:2px solid rgba(180,140,80,0.4)',
        'border-radius:50% 50% 48% 48% / 55% 55% 45% 45%',
        'box-shadow:0 4px 16px rgba(0,0,0,0.15),inset 0 2px 4px rgba(255,255,255,0.8)',
        'cursor:pointer','z-index:9990','pointer-events:auto',
        'display:flex','align-items:center','justify-content:center',
        'font-size:22px','animation:egg-idle 3s ease-in-out infinite',
        'transition:transform 0.2s',
      ].join(';');
      egg.textContent = '🥚';
      egg.setAttribute('aria-label', '용신 깨우기');

      var eggStyle = document.createElement('style');
      eggStyle.textContent = '@keyframes egg-idle{0%,100%{transform:rotate(-4deg) scale(1)}40%{transform:rotate(4deg) scale(1.05)}70%{transform:rotate(-2deg) scale(0.97)}}';
      document.head.appendChild(eggStyle);

      var eggBubble = document.createElement('div');
      eggBubble.style.cssText = 'position:fixed;bottom:148px;right:12px;background:rgba(26,18,10,0.92);color:#fcf7ea;padding:10px 14px;border-radius:14px;font-size:13px;font-weight:500;line-height:1.55;max-width:190px;text-align:center;opacity:0;transition:opacity 0.3s;pointer-events:none;z-index:9991;font-family:\'Pretendard Variable\',Pretendard,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,0.25);';
      eggBubble.innerHTML = '<b style="color:#f5c842;">용신이 기다리고 있어요!</b><br>피코에서 나만의 용신을<br>깨워보세요 🥚✨';
      document.body.appendChild(eggBubble);
      document.body.appendChild(egg);

      var bubTimer;
      egg.addEventListener('click', function() {
        egg.style.animation = 'none'; void egg.offsetWidth;
        egg.style.animation = 'egg-idle 3s ease-in-out infinite';
        eggBubble.style.opacity = '1';
        clearTimeout(bubTimer);
        bubTimer = setTimeout(function() { eggBubble.style.opacity = '0'; }, 3500);
      });
      egg.addEventListener('dblclick', function() {
        window.open(PICO_PET_URL, '_blank');
      });

      // 3초 후 자동으로 한 번 말풍선 표시
      setTimeout(function() {
        eggBubble.style.opacity = '1';
        bubTimer = setTimeout(function() { eggBubble.style.opacity = '0'; }, 4000);
      }, 2500);
    }

    // 첫 로드
    fetchAndApply(function() {
      if (!_overrideState || !_overrideState.element) {
        // 용신 없음 → 알 버튼 표시
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', showEggButton);
        } else {
          setTimeout(showEggButton, 1200);
        }
        return;
      }
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
      } else {
        setTimeout(init, 1000);
      }
    });

    // 탭이 다시 활성화될 때마다 Supabase 재조회
    document.addEventListener('visibilitychange', function() {
      if (document.visibilityState === 'visible') {
        fetchAndApply(null);
      }
    });

    // 60초 주기 폴링 (Realtime 연결 끊김 백업)
    var _pollTimer = setInterval(function() {
      if (document.visibilityState === 'visible') {
        fetchAndApply(null);
      }
    }, 60000);

    // Supabase Realtime — 피코에서 저장되는 즉시 반영
    try {
      var _realtimeUrl = SB_URL.replace('https://', 'wss://') + '/realtime/v1/websocket?apikey=' + SB_KEY + '&vsn=1.0.0';
      var _ws = new WebSocket(_realtimeUrl);
      var _wsHb;

      _ws.onopen = function() {
        // 채널 구독 (reports 테이블, pet_state, 해당 user_id만)
        _ws.send(JSON.stringify({
          topic: 'realtime:public:reports:user_id=eq.' + uid,
          event: 'phx_join',
          payload: { config: { broadcast: { self: false }, presence: { key: '' }, postgres_changes: [{ event: '*', schema: 'public', table: 'reports', filter: 'user_id=eq.' + uid }] } },
          ref: '1'
        }));
        // 30초마다 heartbeat (연결 유지)
        _wsHb = setInterval(function() {
          if (_ws.readyState === WebSocket.OPEN) {
            _ws.send(JSON.stringify({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: 'hb' }));
          }
        }, 30000);
      };

      _ws.onmessage = function(e) {
        try {
          var msg = JSON.parse(e.data);
          // postgres_changes 이벤트 수신 시 즉시 재조회
          if (msg.event === 'postgres_changes' || (msg.payload && msg.payload.data && msg.payload.data.table === 'reports')) {
            fetchAndApply(null);
          }
        } catch(ex) {}
      };

      _ws.onclose = function() {
        clearInterval(_wsHb);
        // 연결 끊기면 폴링이 백업으로 동작 (이미 위에서 설정됨)
      };

      _ws.onerror = function() { _ws.close(); };
    } catch(ex) {}
  }

})();
