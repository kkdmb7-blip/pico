/**
 * profile-bar.js
 * 공통 프로필 선택 바 — saju.html / qimen.html / astro.html / vedic.html 에 포함
 *
 * 사용법:
 *   <script src="profile-bar.js"></script>
 *   <div id="profile-bar-root"></div>  (nav 바로 아래)
 */
(function () {
  'use strict';

  // ── Helpers ────────────────────────────────────────────
  function getMyProfile() {
    try { return JSON.parse(localStorage.getItem('pico_profile')) || null; } catch (e) { return null; }
  }
  function getProfiles() {
    try { return JSON.parse(localStorage.getItem('pico_profiles')) || []; } catch (e) { return []; }
  }

  /**
   * pico_profile 포맷 또는 pico_profiles 포맷 → URL 파라미터 객체
   */
  function profileToParams(p) {
    var r = {};
    if (!p) return r;
    if (p.name) r.name = p.name;
    if (p.year) {
      // pico_profile format: {year, month, day, hour, minute, gender:'M'|'F'}
      r.year   = p.year;
      r.month  = p.month;
      r.day    = p.day;
      if (p.hour !== 'unknown' && p.hour != null) r.hour = p.hour;
      r.minute = p.minute != null ? p.minute : 0;
      r.gender = p.gender === 'M' ? 'male' : p.gender === 'F' ? 'female' : (p.gender || 'male');
    } else if (p.birth_date) {
      // pico_profiles format: {birth_date:'YYYY-MM-DD', birth_time:'HH:MM'|'unknown', gender:'male'|'female'}
      var parts = p.birth_date.split('-');
      r.year  = parseInt(parts[0]);
      r.month = parseInt(parts[1]);
      r.day   = parseInt(parts[2]);
      if (p.birth_time && p.birth_time !== 'unknown') {
        var t = p.birth_time.split(':');
        r.hour   = parseInt(t[0]);
        r.minute = parseInt(t[1]) || 0;
      }
      r.gender = p.gender || 'male';
    }
    return r;
  }

  /**
   * 현재 URL 파라미터에서 date/time/gender 를 교체해 새 URL 반환
   */
  function buildUrl(profileParams) {
    var cur = new URLSearchParams(window.location.search);
    ['year', 'month', 'day', 'hour', 'minute', 'gender', 'name'].forEach(function (k) {
      if (profileParams[k] != null && profileParams[k] !== '') cur.set(k, profileParams[k]);
      else cur.delete(k);
    });
    return window.location.pathname + '?' + cur.toString();
  }

  function displayName(p) {
    if (!p) return '없음';
    var name = p.name || '이름없음';
    var date = '';
    if (p.year) {
      date = p.year + '.' + String(p.month).padStart(2, '0') + '.' + String(p.day).padStart(2, '0');
    } else if (p.birth_date) {
      date = p.birth_date.replace(/-/g, '.');
    }
    return name + (date ? ' · ' + date : '');
  }

  // ── Bar Styles (cream theme) ───────────────────────────
  var BAR_STYLE = [
    'background:rgba(249,241,222,0.97)',
    'border-bottom:1px solid rgba(154,138,96,0.25)',
    'padding:10px 20px',
    'display:flex',
    'align-items:center',
    'gap:8px',
    'flex-wrap:wrap',
    'position:sticky',
    'top:64px',
    'z-index:99',
    'backdrop-filter:blur(10px)',
    '-webkit-backdrop-filter:blur(10px)'
  ].join(';');

  var BTN_BASE = [
    'border:1px solid rgba(154,138,96,0.35)',
    'border-radius:10px',
    'padding:7px 14px',
    'font-size:12.5px',
    'font-weight:700',
    'cursor:pointer',
    'font-family:\'Pretendard Variable\',Pretendard,\'Noto Sans KR\',sans-serif',
    'transition:all 0.15s',
    'white-space:nowrap'
  ].join(';');

  var BTN_ACCENT = BTN_BASE + ';background:#fcf7ea;color:#1a120a;border:1.5px solid rgba(26,18,10,0.4);';
  var BTN_GHOST  = BTN_BASE + ';background:#fcf7ea;color:#5a4830;';
  var BTN_NEW    = BTN_BASE + ';background:#fcf7ea;color:#5a4830;border:1px solid rgba(154,138,96,0.35);';

  // ── Dropdown ───────────────────────────────────────────
  var DD_STYLE = [
    'position:absolute',
    'top:calc(100% + 4px)',
    'left:0',
    'min-width:220px',
    'background:#fcf7ea',
    'border:1px solid rgba(154,138,96,0.35)',
    'border-radius:12px',
    'box-shadow:0 8px 24px rgba(60,40,20,0.18)',
    'z-index:300',
    'overflow:hidden',
    'display:none'
  ].join(';');

  var DD_ITEM = [
    'padding:11px 14px',
    'font-size:13px',
    'color:#4a3a2a',
    'cursor:pointer',
    'border-bottom:1px solid rgba(154,138,96,0.18)',
    'font-family:\'Pretendard Variable\',Pretendard,\'Noto Sans KR\',sans-serif'
  ].join(';');

  // ── New-input overlay ──────────────────────────────────
  var OVERLAY_STYLE = [
    'position:fixed',
    'inset:0',
    'background:rgba(0,0,0,0.72)',
    'backdrop-filter:blur(8px)',
    'z-index:400',
    'display:none',
    'align-items:center',
    'justify-content:center'
  ].join(';');

  // ── Main: inject bar ───────────────────────────────────
  function inject() {
    // Mount point — after nav
    var mount = document.getElementById('profile-bar-root');
    if (!mount) return;

    var me       = getMyProfile();
    var profiles = getProfiles().filter(function (p) { return !p.isMe; });
    var hasMe    = !!(me && me.year);

    // ── Bar container
    var bar = document.createElement('div');
    bar.style.cssText = BAR_STYLE;

    // Label
    var lbl = document.createElement('span');
    lbl.style.cssText = 'font-size:11.5px;color:#7a6850;margin-right:2px;white-space:nowrap;font-weight:600;letter-spacing:0.02em;';
    lbl.textContent = '조회';
    bar.appendChild(lbl);

    // ── "내 정보" button
    var meBtn = document.createElement('button');
    meBtn.style.cssText = hasMe ? BTN_ACCENT : BTN_GHOST;
    meBtn.textContent = hasMe ? ('👤 ' + (me.name || '내 정보')) : '👤 내 정보 (미설정)';
    meBtn.title = hasMe ? displayName(me) : '로그인 후 프로필 설정 필요';
    meBtn.addEventListener('click', function () {
      if (!hasMe) { alert('index.html에서 프로필을 먼저 설정해주세요.'); return; }
      window.location.href = buildUrl(profileToParams(me));
    });
    bar.appendChild(meBtn);

    // ── "다른 사람" dropdown
    var ddWrap = document.createElement('div');
    ddWrap.style.cssText = 'position:relative;';

    var othersBtn = document.createElement('button');
    othersBtn.style.cssText = profiles.length > 0 ? BTN_GHOST : BTN_GHOST + ';opacity:0.5;';
    othersBtn.textContent = '👥 저장된 프로필 ' + (profiles.length > 0 ? '▾' : '(없음)');

    var dd = document.createElement('div');
    dd.style.cssText = DD_STYLE;

    if (profiles.length === 0) {
      var noItem = document.createElement('div');
      noItem.style.cssText = DD_ITEM + ';color:#7a6850;cursor:default;';
      noItem.textContent = '저장된 프로필이 없습니다';
      dd.appendChild(noItem);
    } else {
      profiles.forEach(function (p) {
        var item = document.createElement('div');
        item.style.cssText = DD_ITEM;
        item.textContent = displayName(p) + ' · ' + (p.gender === 'male' ? '남' : '여');
        item.addEventListener('mouseenter', function () { item.style.background = 'rgba(138,106,21,0.10)'; item.style.color = '#3a2a10'; });
        item.addEventListener('mouseleave', function () { item.style.background = ''; item.style.color = '#4a3a2a'; });
        item.addEventListener('click', function () {
          dd.style.display = 'none';
          window.location.href = buildUrl(profileToParams(p));
        });
        dd.appendChild(item);
      });
    }
    dd.lastChild && (dd.lastChild.style.borderBottom = 'none');

    var ddOpen = false;
    othersBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      ddOpen = !ddOpen;
      dd.style.display = ddOpen ? 'block' : 'none';
    });
    document.addEventListener('click', function () { ddOpen = false; dd.style.display = 'none'; });

    ddWrap.appendChild(othersBtn);
    ddWrap.appendChild(dd);
    bar.appendChild(ddWrap);

    // ── "새로 입력" button
    var newBtn = document.createElement('button');
    newBtn.style.cssText = BTN_NEW;
    newBtn.textContent = '➕ 새로 입력';
    newBtn.addEventListener('click', function () { openNewInputOverlay(); });
    bar.appendChild(newBtn);

    // Current info display
    var urlP = new URLSearchParams(window.location.search);
    if (urlP.get('year')) {
      var infoSpan = document.createElement('span');
      infoSpan.style.cssText = 'margin-left:auto;font-size:11px;color:#7a6850;white-space:nowrap;';
      infoSpan.textContent = urlP.get('year') + '.' + String(urlP.get('month')).padStart(2,'0') + '.' + String(urlP.get('day')).padStart(2,'0');
      if (urlP.get('hour')) infoSpan.textContent += ' ' + String(urlP.get('hour')).padStart(2,'0') + ':' + String(urlP.get('minute')||0).padStart(2,'0');
      bar.appendChild(infoSpan);
    }

    mount.appendChild(bar);

    // ── New Input Overlay ──────────────────────────────────
    buildNewInputOverlay();
  }

  // ── New Input Overlay builder ─────────────────────────
  var _overlay = null;
  var _niGender = 'male';

  function buildNewInputOverlay() {
    var ov = document.createElement('div');
    ov.id = 'pb-new-overlay';
    ov.style.cssText = OVERLAY_STYLE;
    _overlay = ov;

    var modal = document.createElement('div');
    modal.style.cssText = [
      'background:#f9f1de',
      'border:1px solid rgba(154,138,96,0.35)',
      'border-radius:16px',
      'padding:28px 24px',
      'width:90%',
      'max-width:340px',
      'max-height:90vh',
      'overflow-y:auto',
      'color:#3a2a10',
      'box-shadow:0 20px 60px rgba(60,40,20,0.25)'
    ].join(';');

    modal.innerHTML = [
      '<h3 style="font-family:\'Cinzel\',\'Noto Serif KR\',serif;font-size:18px;margin-bottom:6px;letter-spacing:0.15em;color:#3a2a10;">새로 입력</h3>',
      '<p style="font-size:13px;color:#7a6850;margin-bottom:20px;">직접 생년월일을 입력하여 조회합니다</p>',

      '<div style="margin-bottom:14px;">',
        '<label style="font-size:12px;color:#5a4830;display:block;margin-bottom:6px;font-weight:600;">이름 (선택)</label>',
        '<input id="pb-name" type="text" placeholder="홍길동" style="width:100%;box-sizing:border-box;' + selectStyle() + '" />',
      '</div>',

      '<div style="margin-bottom:14px;">',
        '<label style="font-size:12px;color:#5a4830;display:block;margin-bottom:6px;font-weight:600;">생년월일</label>',
        '<div style="display:flex;gap:6px;">',
          '<select id="pb-year" style="flex:1.2;' + selectStyle() + '"><option value="">년</option></select>',
          '<select id="pb-month" style="flex:0.9;' + selectStyle() + '"><option value="">월</option></select>',
          '<select id="pb-day" style="flex:0.9;' + selectStyle() + '"><option value="">일</option></select>',
        '</div>',
      '</div>',

      '<div style="margin-bottom:14px;">',
        '<label style="font-size:12px;color:#5a4830;display:block;margin-bottom:6px;font-weight:600;">태어난 시간</label>',
        '<div style="display:flex;gap:6px;">',
          '<select id="pb-hour" style="flex:1.1;' + selectStyle() + '">',
            '<option value="unknown" selected>시 모름</option>',
            Array.from({length:24},function(_,i){return '<option value="'+i+'">'+i+'시</option>';}).join(''),
          '</select>',
          '<select id="pb-minute" style="flex:0.9;' + selectStyle() + '">',
            Array.from({length:60},function(_,i){return '<option value="'+i+'"'+(i===0?' selected':'')+'>'+String(i).padStart(2,'0')+'분</option>';}).join(''),
          '</select>',
        '</div>',
      '</div>',

      '<div style="margin-bottom:20px;">',
        '<label style="font-size:12px;color:#5a4830;display:block;margin-bottom:6px;font-weight:600;">성별</label>',
        '<div style="display:flex;gap:8px;">',
          '<button id="pb-gM" onclick="window._pbSelectGender(\'male\')" style="flex:1;padding:10px;border-radius:8px;border:1.5px solid #1a120a;background:#1a120a;color:#fcf7ea;font-size:13px;cursor:pointer;font-weight:700;font-family:\'Pretendard Variable\',Pretendard,\'Noto Sans KR\',sans-serif;">남성 ♂</button>',
          '<button id="pb-gF" onclick="window._pbSelectGender(\'female\')" style="flex:1;padding:10px;border-radius:8px;border:1.5px solid rgba(26,18,10,0.2);background:#fcf7ea;color:#7a6850;font-size:13px;cursor:pointer;font-weight:700;font-family:\'Pretendard Variable\',Pretendard,\'Noto Sans KR\',sans-serif;">여성 ♀</button>',
        '</div>',
      '</div>',

      '<div style="display:flex;gap:8px;">',
        '<button onclick="window._pbSubmitNew()" style="flex:1;padding:13px;border-radius:10px;background:#1a120a;color:#fcf7ea;border:none;font-size:14px;font-weight:700;cursor:pointer;font-family:\'Pretendard Variable\',Pretendard,\'Noto Sans KR\',sans-serif;box-shadow:0 2px 10px rgba(0,0,0,0.18);">조회하기</button>',
        '<button onclick="window._pbCloseNew()" style="flex:0.5;padding:13px;border-radius:10px;background:#fcf7ea;border:1.5px solid rgba(26,18,10,0.15);color:#7a6850;font-size:13px;font-weight:700;cursor:pointer;font-family:\'Pretendard Variable\',Pretendard,\'Noto Sans KR\',sans-serif;">취소</button>',
      '</div>'
    ].join('');

    ov.appendChild(modal);
    ov.addEventListener('click', function (e) { if (e.target === ov) window._pbCloseNew(); });
    document.body.appendChild(ov);
  }

  function selectStyle() {
    return 'background:#fcf7ea;border:1px solid rgba(154,138,96,0.35);border-radius:8px;padding:10px 10px;color:#3a2a10;font-size:14px;outline:none;font-family:\'Pretendard Variable\',Pretendard,\'Noto Sans KR\',sans-serif;';
  }

  function openNewInputOverlay() {
    if (!_overlay) return;
    _niGender = 'male';
    updateGenderBtns();
    _overlay.style.display = 'flex';
    initNewInputSelects();
    // Reset all fields
    var nameEl = document.getElementById('pb-name');
    if (nameEl) nameEl.value = '';
    var yEl = document.getElementById('pb-year');
    var mEl = document.getElementById('pb-month');
    var dEl = document.getElementById('pb-day');
    if (yEl) yEl.value = '';
    if (mEl) mEl.value = '';
    if (dEl) { dEl.innerHTML = '<option value="">일</option>'; }
    var hEl = document.getElementById('pb-hour');
    if (hEl) hEl.selectedIndex = 0;
    var minEl = document.getElementById('pb-minute');
    if (minEl) minEl.selectedIndex = 0;
    document.body.style.overflow = 'hidden';
  }

  window._pbCloseNew = function () {
    if (_overlay) _overlay.style.display = 'none';
    document.body.style.overflow = '';
  };

  window._pbSelectGender = function (g) {
    _niGender = g;
    updateGenderBtns();
  };

  function updateGenderBtns() {
    var mBtn = document.getElementById('pb-gM');
    var fBtn = document.getElementById('pb-gF');
    if (!mBtn || !fBtn) return;
    var activeBase = 'flex:1;padding:10px;border-radius:8px;border:1.5px solid #1a120a;background:#1a120a;color:#fcf7ea;font-size:13px;cursor:pointer;font-weight:700;font-family:\'Pretendard Variable\',Pretendard,\'Noto Sans KR\',sans-serif;';
    var ghostBase  = 'flex:1;padding:10px;border-radius:8px;border:1.5px solid rgba(26,18,10,0.2);background:#fcf7ea;color:#7a6850;font-size:13px;cursor:pointer;font-weight:700;font-family:\'Pretendard Variable\',Pretendard,\'Noto Sans KR\',sans-serif;';
    if (_niGender === 'male') {
      mBtn.style.cssText = activeBase;
      fBtn.style.cssText = ghostBase;
    } else {
      fBtn.style.cssText = activeBase;
      mBtn.style.cssText = ghostBase;
    }
  }

  var _niInited = false;
  function initNewInputSelects() {
    if (_niInited) return;
    _niInited = true;
    var yEl = document.getElementById('pb-year');
    var mEl = document.getElementById('pb-month');
    var dEl = document.getElementById('pb-day');
    var curY = new Date().getFullYear();
    for (var y = curY; y >= 1930; y--) {
      var o = document.createElement('option'); o.value = y; o.textContent = y + '년'; yEl.appendChild(o);
    }
    for (var mo = 1; mo <= 12; mo++) {
      var o = document.createElement('option'); o.value = mo; o.textContent = mo + '월'; mEl.appendChild(o);
    }
    function updateDays() {
      var yv = parseInt(yEl.value) || 2000, mv = parseInt(mEl.value) || 1;
      var maxD = new Date(yv, mv, 0).getDate(), cur = parseInt(dEl.value);
      dEl.innerHTML = '<option value="">일</option>';
      for (var dd = 1; dd <= maxD; dd++) {
        var o = document.createElement('option'); o.value = dd; o.textContent = dd + '일';
        if (dd === cur) o.selected = true;
        dEl.appendChild(o);
      }
    }
    yEl.addEventListener('change', updateDays);
    mEl.addEventListener('change', updateDays);
    updateDays();
  }

  window._pbSubmitNew = function () {
    var year  = document.getElementById('pb-year').value;
    var month = document.getElementById('pb-month').value;
    var day   = document.getElementById('pb-day').value;
    if (!year || !month || !day) { alert('생년월일을 모두 선택해주세요.'); return; }
    var hour = document.getElementById('pb-hour').value;
    var minute = document.getElementById('pb-minute') ? parseInt(document.getElementById('pb-minute').value) || 0 : 0;
    var name = (document.getElementById('pb-name') || {}).value || '';
    var p = {};
    p.year  = parseInt(year);
    p.month = parseInt(month);
    p.day   = parseInt(day);
    if (hour !== 'unknown') { p.hour = parseInt(hour); p.minute = minute; }
    p.gender = _niGender;
    window._pbCloseNew();
    var params = profileToParams(p);
    var cur = new URLSearchParams(window.location.search);
    ['year', 'month', 'day', 'hour', 'minute', 'gender'].forEach(function (k) {
      if (params[k] != null) cur.set(k, params[k]);
      else cur.delete(k);
    });
    if (name.trim()) cur.set('name', name.trim());
    else cur.delete('name');
    window.location.href = window.location.pathname + '?' + cur.toString();
  };

  // ── Init ───────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();
