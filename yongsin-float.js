(function() {
  'use strict';

  var PET_KEY = 'yongsin_pet';
  var FOUND_KEY = 'yongsin_found_today';
  var HIDE_KEY = 'yongsin_float_hidden';

  // 오늘 이미 찾았으면 스킵
  function getTodayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  function getPetState() {
    try { return JSON.parse(localStorage.getItem(PET_KEY)) || {}; } catch(e) { return {}; }
  }

  function getElement() {
    var s = getPetState();
    return s.element || 'water'; // 기본값 수(水)
  }

  var ELEM_STYLE = {
    wood:  { bg: '#1a6630', glow: 'rgba(26,102,48,0.5)',  emoji: '🌿' },
    fire:  { bg: '#c62828', glow: 'rgba(198,40,40,0.5)',  emoji: '🔥' },
    earth: { bg: '#6a4a10', glow: 'rgba(106,74,16,0.5)',  emoji: '🪨' },
    metal: { bg: '#5a5a4a', glow: 'rgba(90,90,74,0.5)',   emoji: '💎' },
    water: { bg: '#1565c0', glow: 'rgba(21,101,192,0.5)', emoji: '💧' },
  };

  // 위치 후보 (뷰포트 기준 %, 가끔 음수로 숨김)
  var POSITIONS = [
    { x: 5,  y: 20,  hide: false },
    { x: 80, y: 15,  hide: false },
    { x: 10, y: 60,  hide: false },
    { x: 75, y: 55,  hide: false },
    { x: 40, y: 80,  hide: false },
    { x: 5,  y: 40,  hide: false },
    { x: 82, y: 70,  hide: false },
    // 숨기 위치 (화면 밖으로 반쯤)
    { x: -3, y: 30,  hide: true },
    { x: 88, y: 45,  hide: true },
    { x: 30, y: -3,  hide: true },
    { x: 50, y: 85,  hide: true, partial: true },
  ];

  var pet, bubble, wrapper;
  var currentPos = 0;
  var moveTimer, hideTimer, bubbleTimer;
  var isHiding = false;
  var MOVE_TRANSITION = 'left 1.8s cubic-bezier(0.34,1.2,0.64,1), top 1.8s cubic-bezier(0.34,1.2,0.64,1)';

  // ── 캐릭터 SVG (원소별 미니 버전) ──
  function buildPetSVG(elem) {
    var s = ELEM_STYLE[elem] || ELEM_STYLE.water;
    if (elem === 'wood') return `
      <svg width="44" height="50" viewBox="0 0 44 50" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="22" cy="32" rx="16" ry="14" fill="#1a8a40"/>
        <ellipse cx="22" cy="26" rx="11" ry="10" fill="#2aaa50"/>
        <ellipse cx="14" cy="20" rx="8" ry="6" fill="#3aba60" transform="rotate(-20,14,20)"/>
        <ellipse cx="30" cy="21" rx="7" ry="5" fill="#3aba60" transform="rotate(20,30,21)"/>
        <rect x="19" y="42" width="6" height="8" rx="2" fill="#6a3a10"/>
        <circle cx="17" cy="30" r="3" fill="white"/>
        <circle cx="27" cy="30" r="3" fill="white"/>
        <circle cx="18" cy="31" r="1.8" fill="#1a3a10"/>
        <circle cx="28" cy="31" r="1.8" fill="#1a3a10"/>
        <path d="M18 36 Q22 39 26 36" stroke="white" stroke-width="1.5" fill="none" stroke-linecap="round"/>
      </svg>`;
    if (elem === 'fire') return `
      <svg width="40" height="52" viewBox="0 0 40 52" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="20" cy="38" rx="14" ry="12" fill="#e53935"/>
        <ellipse cx="20" cy="28" rx="10" ry="14" fill="#ef5350"/>
        <ellipse cx="20" cy="20" rx="7" ry="10" fill="#ffcc02"/>
        <ellipse cx="20" cy="14" rx="4" ry="6" fill="white" opacity="0.9"/>
        <circle cx="15" cy="34" r="3" fill="white"/>
        <circle cx="25" cy="34" r="3" fill="white"/>
        <circle cx="16" cy="35" r="1.8" fill="#3a0a00"/>
        <circle cx="26" cy="35" r="1.8" fill="#3a0a00"/>
        <path d="M16 40 Q20 43 24 40" stroke="white" stroke-width="1.5" fill="none" stroke-linecap="round"/>
      </svg>`;
    if (elem === 'earth') return `
      <svg width="48" height="44" viewBox="0 0 48 44" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="24" cy="26" rx="20" ry="16" fill="#8a5a2a"/>
        <ellipse cx="24" cy="22" rx="14" ry="10" fill="#a07040"/>
        <ellipse cx="24" cy="28" rx="12" ry="8" fill="#c89060"/>
        <circle cx="18" cy="22" r="3.5" fill="white"/>
        <circle cx="30" cy="22" r="3.5" fill="white"/>
        <circle cx="19" cy="23" r="2" fill="#2a1a08"/>
        <circle cx="31" cy="23" r="2" fill="#2a1a08"/>
        <ellipse cx="13" cy="23" rx="4" ry="2.5" fill="rgba(200,100,80,0.35)"/>
        <ellipse cx="35" cy="23" rx="4" ry="2.5" fill="rgba(200,100,80,0.35)"/>
        <path d="M19 29 Q24 32 29 29" stroke="white" stroke-width="1.5" fill="none" stroke-linecap="round"/>
      </svg>`;
    if (elem === 'metal') return `
      <svg width="42" height="50" viewBox="0 0 42 50" xmlns="http://www.w3.org/2000/svg">
        <polygon points="21,2 40,16 40,36 21,50 2,36 2,16" fill="#a09070"/>
        <polygon points="21,2 40,16 40,36 21,50 2,36 2,16" fill="url(#mg)" opacity="0.8"/>
        <defs><linearGradient id="mg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="white" stop-opacity="0.4"/><stop offset="100%" stop-color="black" stop-opacity="0.1"/></linearGradient></defs>
        <polygon points="21,8 36,18 21,16" fill="white" opacity="0.3"/>
        <circle cx="15" cy="28" r="3" fill="white"/>
        <circle cx="27" cy="28" r="3" fill="white"/>
        <circle cx="16" cy="29" r="1.8" fill="#1a1a2a"/>
        <circle cx="28" cy="29" r="1.8" fill="#1a1a2a"/>
        <path d="M16 35 Q21 38 26 35" stroke="white" stroke-width="1.5" fill="none" stroke-linecap="round"/>
      </svg>`;
    // water (default)
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

  function buildPet() {
    var elem = getElement();
    var s = ELEM_STYLE[elem] || ELEM_STYLE.water;

    wrapper = document.createElement('div');
    wrapper.id = 'yongsin-float-wrapper';
    wrapper.style.cssText = [
      'position:absolute',
      'z-index:9999',
      'pointer-events:none',
      'transition:left 1.8s cubic-bezier(0.34,1.2,0.64,1), top 1.8s cubic-bezier(0.34,1.2,0.64,1)',
      'left:10px', 'top:20%',
    ].join(';');

    // 말풍선
    bubble = document.createElement('div');
    bubble.style.cssText = [
      'position:absolute',
      'bottom:58px', 'left:50%',
      'transform:translateX(-50%)',
      'background:rgba(26,18,10,0.88)',
      'color:#fcf7ea',
      'padding:6px 12px',
      'border-radius:12px',
      'font-size:12px',
      'font-weight:700',
      'white-space:nowrap',
      'opacity:0',
      'transition:opacity 0.3s',
      'pointer-events:none',
      'font-family:\'Pretendard Variable\',Pretendard,\'Noto Sans KR\',sans-serif',
    ].join(';');
    bubble.style.setProperty('--arrow','');
    wrapper.appendChild(bubble);

    // 펫 버튼
    pet = document.createElement('button');
    pet.style.cssText = [
      'width:52px', 'height:52px',
      'border-radius:50%',
      'border:2px solid ' + s.bg,
      'background:#f9f1de',
      'cursor:pointer',
      'padding:0',
      'display:flex', 'align-items:center', 'justify-content:center',
      'box-shadow:0 0 12px ' + s.glow + ', 0 3px 10px rgba(0,0,0,0.15)',
      'pointer-events:auto',
      'transition:transform 0.2s, box-shadow 0.2s',
      'animation:pet-idle 2.5s ease-in-out infinite',
      'position:relative',
      'overflow:hidden',
    ].join(';');
    pet.setAttribute('aria-label', '용신 찾기');
    pet.innerHTML = buildPetSVG(elem);

    // 숨김 힌트 (반쯤 튀어나온 눈)
    var hint = document.createElement('div');
    hint.id = 'yongsin-float-hint';
    hint.style.cssText = [
      'position:absolute',
      'width:24px', 'height:24px',
      'border-radius:50%',
      'background:' + s.bg,
      'border:2px solid white',
      'bottom:-8px', 'right:-8px',
      'display:flex', 'align-items:center', 'justify-content:center',
      'font-size:12px',
      'opacity:0',
      'transition:opacity 0.3s',
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

  function showBubble(text, duration) {
    bubble.textContent = text;
    bubble.style.opacity = '1';
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(function() {
      bubble.style.opacity = '0';
    }, duration || 2000);
  }

  function moveTo(pos) {
    var vw = window.innerWidth;
    var vh = window.innerHeight;
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
    // 30% 확률로 숨기
    var pool = Math.random() < 0.3 ? hidden : visible;
    var next;
    do {
      next = Math.floor(Math.random() * pool.length);
    } while (pool[next] === POSITIONS[currentPos]);
    return pool[next];
  }

  function scheduleMove() {
    clearTimeout(moveTimer);
    // 8~20초마다 이동
    var delay = 8000 + Math.random() * 12000;
    moveTimer = setTimeout(function() {
      var pos = pickNextPos();
      moveTo(pos);
      if (pos.hide) {
        showBubble('...', 1500);
      }
      scheduleMove();
    }, delay);
  }

  function onPetClick() {
    var today = getTodayStr();
    var found = localStorage.getItem(FOUND_KEY);

    pet.style.animation = 'none';
    pet.style.animation = 'pet-found 0.6s ease';
    setTimeout(function() { pet.style.animation = 'pet-idle 2.5s ease-in-out infinite'; }, 700);

    if (found !== today) {
      // 오늘 처음 발견
      localStorage.setItem(FOUND_KEY, today);
      var state = getPetState();
      state.hunger = Math.min(100, (state.hunger || 70) + 15);
      state.happy  = Math.min(100, (state.happy  || 70) + 20);
      state.exp    = (state.exp || 0) + 30;
      // 레벨업 체크
      var needed = (state.level || 1) * 100;
      if (state.exp >= needed) { state.exp -= needed; state.level = (state.level || 1) + 1; }
      state.lastVisit = Date.now();
      try { localStorage.setItem(PET_KEY, JSON.stringify(state)); } catch(e) {}

      showBubble('찾았다! +30 EXP 🎉', 2500);
      // 이동
      setTimeout(function() {
        var pos = pickNextPos();
        moveTo(pos);
      }, 1000);
    } else {
      var msgs = ['또 찾았어요! 😊', '여기 있었어요 ✨', '안녕하세요~ 🌟', '오늘 운이 좋아요 💫'];
      showBubble(msgs[Math.floor(Math.random() * msgs.length)], 1800);
    }

    // 펫 페이지 열기 (길게 탭 or 더블클릭은 페이지 이동)
  }

  // 더블클릭 → 펫 페이지
  pet && (function() {})(); // placeholder
  var clickCount = 0, clickTimer;
  function setupDoubleClick() {
    pet.addEventListener('click', function() {
      clickCount++;
      if (clickCount === 1) {
        clickTimer = setTimeout(function() { clickCount = 0; }, 400);
      } else if (clickCount >= 2) {
        clearTimeout(clickTimer);
        clickCount = 0;
        window.location.href = '/yongsin-pet.html';
      }
    });
  }

  // 길게 누르면 드래그
  function setupDrag() {
    var longPressTimer = null;
    var dragging = false;
    var dragOffX = 0, dragOffY = 0;
    var didDrag = false;
    var startX = 0, startY = 0;

    pet.addEventListener('pointerdown', function(e) {
      if (e.button && e.button !== 0) return;
      startX = e.clientX; startY = e.clientY;
      didDrag = false;
      longPressTimer = setTimeout(function() {
        longPressTimer = null;
        dragging = true;
        clearTimeout(moveTimer);
        wrapper.style.transition = 'none';
        var sg = ELEM_STYLE[getElement()] || ELEM_STYLE.water;
        pet.style.transform = 'scale(1.25)';
        pet.style.boxShadow = '0 0 28px ' + sg.glow + ', 0 8px 24px rgba(0,0,0,0.3)';
        var rect = wrapper.getBoundingClientRect();
        dragOffX = e.clientX - rect.left;
        dragOffY = e.clientY - rect.top;
        showBubble('잡았다! 🫴', 1200);
        try { navigator.vibrate && navigator.vibrate(50); } catch(ev) {}
      }, 500);
    });

    document.addEventListener('pointermove', function(e) {
      if (longPressTimer) {
        if (Math.abs(e.clientX - startX) > 8 || Math.abs(e.clientY - startY) > 8) {
          clearTimeout(longPressTimer); longPressTimer = null;
        }
      }
      if (!dragging) return;
      e.preventDefault();
      didDrag = true;
      var x = e.clientX + window.scrollX - dragOffX;
      var y = e.clientY + window.scrollY - dragOffY;
      x = Math.max(0, Math.min(document.documentElement.scrollWidth - 60, x));
      y = Math.max(0, Math.min(document.body.scrollHeight - 60, y));
      wrapper.style.left = x + 'px';
      wrapper.style.top  = y + 'px';
    }, { passive: false });

    function endDrag() {
      if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
      if (!dragging) return;
      dragging = false;
      wrapper.style.transition = MOVE_TRANSITION;
      var sg = ELEM_STYLE[getElement()] || ELEM_STYLE.water;
      pet.style.transform = '';
      pet.style.boxShadow = '0 0 12px ' + sg.glow + ', 0 3px 10px rgba(0,0,0,0.15)';
      showBubble('여기 놔둘게요 😊', 1500);
      scheduleMove();
      if (didDrag) {
        var stopClick = function(ev) { ev.stopImmediatePropagation(); pet.removeEventListener('click', stopClick, true); };
        pet.addEventListener('click', stopClick, true);
      }
    }
    document.addEventListener('pointerup', endDrag);
    document.addEventListener('pointercancel', endDrag);
  }

  // 닫기 (오른쪽 클릭)
  function setupContextMenu() {
    pet.addEventListener('contextmenu', function(e) {
      e.preventDefault();
      wrapper.style.opacity = '0';
      wrapper.style.pointerEvents = 'none';
      try { localStorage.setItem(HIDE_KEY, getTodayStr()); } catch(e2) {}
      setTimeout(function() { wrapper.remove(); }, 400);
    });
  }

  // 현재 페이지가 yongsin-pet.html이면 띄우지 않음
  if (window.location.pathname.indexOf('yongsin-pet') !== -1) return;
  // 오늘 숨겼으면 모든 페이지에서 띄우지 않음 (하루 지나면 다시 등장)
  try { if (localStorage.getItem(HIDE_KEY) === getTodayStr()) return; } catch(e) {}

  // DOM 준비 후 실행
  function init() {
    buildPet();
    setupDoubleClick();
    setupDrag();
    setupContextMenu();

    // 첫 등장: 랜덤 위치
    var startPos = POSITIONS[Math.floor(Math.random() * 5)]; // 처음엔 화면 안에만
    moveTo(startPos);

    // 등장 애니메이션
    wrapper.style.opacity = '0';
    wrapper.style.transform = 'scale(0)';
    wrapper.style.transition += ', opacity 0.5s, transform 0.5s';
    setTimeout(function() {
      wrapper.style.opacity = '1';
      wrapper.style.transform = 'scale(1)';
      showBubble('여기 있어요 👀', 2000);
    }, 1500);

    scheduleMove();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 500);
  }

})();
