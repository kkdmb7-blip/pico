(function(){
  if (window._picoAnalyticsLoaded) return;
  window._picoAnalyticsLoaded = true;
  var API = 'https://fortuna.kkdmb7.workers.dev';
  var SID_KEY = 'pico_sess_id';
  var SID_EXP = 'pico_sess_exp';
  var SID_TIMEOUT = 30 * 60 * 1000;

  function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c){
      var r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  function getSession() {
    try {
      var now = Date.now();
      var id = localStorage.getItem(SID_KEY);
      var exp = parseInt(localStorage.getItem(SID_EXP) || '0', 10);
      if (!id || now > exp) id = uuid();
      localStorage.setItem(SID_KEY, id);
      localStorage.setItem(SID_EXP, String(now + SID_TIMEOUT));
      return id;
    } catch(e) { return uuid(); }
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

  var loadedAt = Date.now();
  var exitSent = false;

  function send(type, extra) {
    var payload = {
      session_id: getSession(),
      user_id: getUserId(),
      event_type: type,
      page: pageKey(),
      path: (location.pathname || '') + (location.search || ''),
      referrer: document.referrer || null,
      user_agent: (navigator.userAgent || '').slice(0, 240)
    };
    if (extra) {
      for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) payload[k] = extra[k];
    }
    try {
      var body = JSON.stringify(payload);
      if (type === 'page_exit' && navigator.sendBeacon) {
        var blob = new Blob([body], { type: 'application/json' });
        navigator.sendBeacon(API + '/track', blob);
        return;
      }
      fetch(API + '/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body,
        keepalive: true
      }).catch(function(){});
    } catch(e) {}
  }

  function sendExit() {
    if (exitSent) return;
    exitSent = true;
    send('page_exit', { duration_ms: Date.now() - loadedAt });
  }

  send('page_view');

  window.addEventListener('pagehide', sendExit);
  window.addEventListener('beforeunload', sendExit);
  document.addEventListener('visibilitychange', function(){
    if (document.visibilityState === 'hidden') sendExit();
  });

  window.picoTrack = function(name, meta) {
    var payload = { name: String(name || '').slice(0, 64) };
    if (meta && typeof meta === 'object') {
      for (var k in meta) if (Object.prototype.hasOwnProperty.call(meta, k)) payload[k] = meta[k];
    }
    send('custom', { meta: payload });
  };
})();
