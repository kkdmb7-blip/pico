(function(){
  if (window._picoAnalyticsLoaded) return;
  window._picoAnalyticsLoaded = true;

  var API = 'https://fortuna.kkdmb7.workers.dev';
  var SID_KEY = 'pico_sess_id';
  var SID_EXP = 'pico_sess_exp';
  var SS_FLAG = 'pico_sess_started';
  var VISITS_KEY = 'pico_total_visits';
  var SID_TIMEOUT = 30 * 60 * 1000;

  function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c){
      var r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  function safeLs(fn, fallback) {
    try { return fn(); } catch(e) { return fallback; }
  }

  function getSession() {
    var now = Date.now();
    var id = safeLs(function(){ return localStorage.getItem(SID_KEY); }, null);
    var exp = safeLs(function(){ return parseInt(localStorage.getItem(SID_EXP) || '0', 10); }, 0);
    if (!id || now > exp) id = uuid();
    safeLs(function(){ localStorage.setItem(SID_KEY, id); localStorage.setItem(SID_EXP, String(now + SID_TIMEOUT)); });
    return id;
  }

  function extendSession() {
    safeLs(function(){ localStorage.setItem(SID_EXP, String(Date.now() + SID_TIMEOUT)); });
  }

  function getUserId() {
    try {
      var raw = localStorage.getItem('pico_user');
      if (!raw) return null;
      var u = JSON.parse(raw);
      return (u && (u.uuid || u.id)) ? String(u.uuid || u.id) : null;
    } catch(e) { return null; }
  }

  function pageKey() {
    var name = (location.pathname || '/').split('/').pop() || 'index.html';
    if (!name || name === '') name = 'index.html';
    if (!/\.html?$/i.test(name) && name.indexOf('.') === -1) name = name + '.html';
    return name.toLowerCase();
  }

  function deviceInfo() {
    var ua = navigator.userAgent || '';
    var isIPad = /iPad/.test(ua) || (/Macintosh/.test(ua) && 'ontouchend' in document);
    var isTablet = isIPad || /Android(?!.*Mobile)|Tablet/i.test(ua);
    var isMobile = !isTablet && /Mobile|Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    return {
      device_type: isTablet ? 'tablet' : (isMobile ? 'mobile' : 'desktop'),
      screen_width: (screen && screen.width) ? screen.width : null,
      viewport_width: window.innerWidth || null,
      language: ((navigator.language || navigator.userLanguage || '') + '').slice(0, 8) || null
    };
  }

  function utmInfo() {
    try {
      var p = new URLSearchParams(location.search);
      return {
        utm_source: p.get('utm_source') ? p.get('utm_source').slice(0, 64) : null,
        utm_medium: p.get('utm_medium') ? p.get('utm_medium').slice(0, 64) : null,
        utm_campaign: p.get('utm_campaign') ? p.get('utm_campaign').slice(0, 64) : null
      };
    } catch(e) { return { utm_source:null, utm_medium:null, utm_campaign:null }; }
  }

  var SESSION_ID = getSession();
  var USER_ID = getUserId();
  var DEV = deviceInfo();
  var UTM = utmInfo();
  var LANG = DEV.language;

  var loadedAt = Date.now();
  var visibleStartedAt = (document.visibilityState === 'visible') ? loadedAt : null;
  var accumulatedVisibleMs = 0;
  var exitSent = false;
  var maxScrollPct = 0;
  var scrollSent = { 25:false, 50:false, 75:false, 100:false };

  var ADMIN_IDS = ['99f9f77a-2f2a-4055-ab44-421d1c070341'];

  function send(eventType, extra) {
    var uid = getUserId();
    if (uid && ADMIN_IDS.indexOf(uid) >= 0) return;
    var payload = {
      session_id: SESSION_ID,
      user_id: getUserId(),
      event_type: eventType,
      page: pageKey(),
      path: (location.pathname || '') + (location.search || ''),
      referrer: document.referrer || null,
      user_agent: (navigator.userAgent || '').slice(0, 240),
      device_type: DEV.device_type,
      screen_width: DEV.screen_width,
      viewport_width: DEV.viewport_width,
      language: LANG,
      utm_source: UTM.utm_source,
      utm_medium: UTM.utm_medium,
      utm_campaign: UTM.utm_campaign
    };
    if (extra) {
      for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) payload[k] = extra[k];
    }
    extendSession();
    try {
      var body = JSON.stringify(payload);
      if (eventType === 'page_exit' && navigator.sendBeacon) {
        var blob = new Blob([body], { type: 'application/json' });
        if (navigator.sendBeacon(API + '/track', blob)) return;
      }
      fetch(API + '/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body,
        keepalive: true
      }).catch(function(){});
    } catch(e) {}
  }

  // ── 세션 시작 1회 (새 세션일 때만) ──
  var startedSid = safeLs(function(){ return localStorage.getItem(SS_FLAG); }, null);
  if (startedSid !== SESSION_ID) {
    safeLs(function(){ localStorage.setItem(SS_FLAG, SESSION_ID); });
    var totalVisits = safeLs(function(){ return parseInt(localStorage.getItem(VISITS_KEY) || '0', 10); }, 0) + 1;
    safeLs(function(){ localStorage.setItem(VISITS_KEY, String(totalVisits)); });
    send('custom', {
      meta: {
        name: 'session_start',
        total_visits: totalVisits,
        is_returning: totalVisits > 1
      }
    });
  }

  // ── 페이지 뷰 ──
  send('page_view');

  // ── 스크롤 깊이 ──
  function calcScrollPct() {
    var doc = document.documentElement;
    var body = document.body || {};
    var scrollTop = window.pageYOffset || doc.scrollTop || body.scrollTop || 0;
    var scrollHeight = Math.max(doc.scrollHeight||0, body.scrollHeight||0);
    var viewport = window.innerHeight || doc.clientHeight || 0;
    var scrollable = scrollHeight - viewport;
    if (scrollable <= 0) return 100;
    return Math.min(100, Math.max(0, Math.round(((scrollTop + viewport) / scrollHeight) * 100)));
  }
  var scrollTimer = null;
  window.addEventListener('scroll', function(){
    if (scrollTimer) return;
    scrollTimer = setTimeout(function(){
      scrollTimer = null;
      var p = calcScrollPct();
      if (p > maxScrollPct) maxScrollPct = p;
      [25,50,75,100].forEach(function(m){
        if (!scrollSent[m] && maxScrollPct >= m) {
          scrollSent[m] = true;
          send('custom', { scroll_pct: m, meta: { name: 'scroll', pct: m } });
        }
      });
    }, 250);
  }, { passive: true });

  // ── 가시성 시간 누적 ──
  document.addEventListener('visibilitychange', function(){
    var now = Date.now();
    if (document.visibilityState === 'hidden') {
      if (visibleStartedAt) { accumulatedVisibleMs += now - visibleStartedAt; visibleStartedAt = null; }
      sendExit();
    } else if (document.visibilityState === 'visible') {
      if (!visibleStartedAt) visibleStartedAt = now;
    }
  });

  function sendExit() {
    if (exitSent) return;
    exitSent = true;
    var now = Date.now();
    if (visibleStartedAt) { accumulatedVisibleMs += now - visibleStartedAt; visibleStartedAt = null; }
    var p = calcScrollPct();
    if (p > maxScrollPct) maxScrollPct = p;
    send('page_exit', {
      duration_ms: now - loadedAt,
      scroll_pct: maxScrollPct,
      meta: { visible_ms: accumulatedVisibleMs, max_scroll_pct: maxScrollPct }
    });
  }
  window.addEventListener('pagehide', sendExit);
  window.addEventListener('beforeunload', sendExit);

  // ── 클릭 자동 추적 (button, a, [data-event]) ──
  document.addEventListener('click', function(e){
    try {
      var t = e.target;
      if (!t || t.nodeType !== 1) return;
      var el = t.closest ? t.closest('button, a[href], [role="button"], [data-event]') : null;
      if (!el) return;
      var explicit = el.getAttribute('data-event');
      var text = ((el.textContent || el.innerText || '') + '').replace(/\s+/g, ' ').trim().slice(0, 80);
      var meta = { name: explicit ? explicit.slice(0,48) : 'click', text: text };
      if (el.tagName === 'A') {
        var href = (el.getAttribute('href') || '').slice(0, 140);
        meta.href = href;
        meta.external = /^https?:\/\//i.test(href) && href.indexOf(location.host) < 0;
      } else {
        if (el.id) meta.id = (el.id || '').slice(0, 48);
        var cls = ((el.className || '') + '').split(/\s+/).slice(0, 3).join(' ').slice(0, 64);
        if (cls) meta.cls = cls;
      }
      send('click', { meta: meta });
    } catch(_) {}
  }, { capture: true, passive: true });

  // ── 자바스크립트 에러 추적 ──
  window.addEventListener('error', function(e){
    try {
      var msg = (e && (e.message || (e.error && e.error.message))) || 'unknown error';
      var src = (e && (e.filename || '')) + '';
      var shortSrc = src ? src.split('/').slice(-2).join('/').slice(0, 100) : '';
      send('custom', {
        meta: {
          name: 'js_error',
          msg: String(msg).slice(0, 200),
          src: shortSrc + (e && e.lineno ? ':' + e.lineno : ''),
          type: 'error'
        }
      });
    } catch(_) {}
  });
  window.addEventListener('unhandledrejection', function(e){
    try {
      var reason = e && e.reason;
      var msg = reason && (reason.message || reason.toString()) || 'unhandled rejection';
      send('custom', {
        meta: {
          name: 'promise_rejection',
          msg: String(msg).slice(0, 200),
          type: 'error'
        }
      });
    } catch(_) {}
  });

  // ── 수동 이벤트 헬퍼 ──
  window.picoTrack = function(name, meta) {
    try {
      var payload = { name: String(name || 'custom').slice(0, 48) };
      if (meta && typeof meta === 'object') {
        for (var k in meta) if (Object.prototype.hasOwnProperty.call(meta, k)) payload[k] = meta[k];
      }
      send('custom', { meta: payload });
    } catch(_) {}
  };

  // 로그인/로그아웃 등 user_id 변경 감지를 위해 매 이벤트에서 getUserId()를 다시 읽음 (이미 send()에서 처리됨)
})();
