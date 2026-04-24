(function () {
  'use strict';
  var SB_URL = 'https://ymghmfkqctckxxysxkvy.supabase.co';
  var SB_KEY = 'sb_publishable_3-9zobXqx6Nv36LzmNMBpA_fohZqA5x';
  var HEADERS = { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' };

  function getUserId() {
    try { var u = JSON.parse(localStorage.getItem('pico_user')); return u && u.id ? u.id : null; } catch(e) { return null; }
  }
  function getUserName() {
    try { var u = JSON.parse(localStorage.getItem('pico_user')); return u && u.name ? u.name : '사용자'; } catch(e) { return '사용자'; }
  }

  var _open = false;
  var _pollTimer = null;
  var _messages = [];

  // ── CSS 주입 ──
  var css = `
#sw-btn {
  position: fixed; bottom: calc(156px + env(safe-area-inset-bottom, 0px)); right: 14px; z-index: 9980;
  height: 44px; padding: 0 16px 0 14px; border-radius: 24px;
  max-width: calc(100vw - 28px);
  background: linear-gradient(135deg, #c9a84c, #7a5a10);
  border: none; cursor: pointer;
  box-shadow: 0 6px 20px rgba(122,90,16,0.38);
  display: flex; align-items: center; justify-content: center; gap: 7px;
  color: #fff; font-family: 'Noto Sans KR','Pretendard Variable',Pretendard,sans-serif;
  font-size: 13px; font-weight: 700; letter-spacing: 0.01em;
  transition: transform 0.15s, box-shadow 0.2s;
  animation: sw-pulse 2.4s ease-in-out infinite;
  white-space: nowrap;
}
#sw-btn .sw-btn-ico { font-size: 15px; line-height: 1; color: #fff9e0; }
@keyframes sw-pulse {
  0%, 100% { transform: scale(1); box-shadow: 0 6px 20px rgba(122,90,16,0.38), 0 0 0 0 rgba(201,168,76,0.55); }
  50% { transform: scale(1.04); box-shadow: 0 8px 24px rgba(122,90,16,0.45), 0 0 0 12px rgba(201,168,76,0); }
}
#sw-btn:hover { animation-play-state: paused; transform: scale(1.06); }
#sw-btn.sw-open { animation: none; }
#sw-badge {
  position: absolute; top: -6px; right: -6px;
  background: #e53935; color: #fff; font-size: 10px; font-weight: 700;
  min-width: 20px; height: 20px; padding: 0 5px; border-radius: 10px;
  display: none; align-items: center; justify-content: center;
  border: 2px solid #fff; box-shadow: 0 2px 6px rgba(0,0,0,0.2);
  line-height: 1;
}
#sw-panel {
  position: fixed; bottom: calc(210px + env(safe-area-inset-bottom, 0px)); right: 14px; z-index: 9981;
  width: min(340px, calc(100vw - 28px));
  background: #fdf8f0; border-radius: 18px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.18);
  border: 1px solid rgba(180,140,60,0.25);
  display: none; flex-direction: column; overflow: hidden;
  font-family: 'Noto Sans KR', sans-serif;
  max-height: 60vh;
}
#sw-head {
  padding: 14px 16px; background: linear-gradient(135deg, #c9a84c, #7a5a10);
  color: #fff; font-weight: 700; font-size: 14px;
  display: flex; align-items: center; justify-content: space-between;
}
#sw-head span { font-size: 11px; opacity: 0.85; font-weight: 400; }
#sw-close { background: none; border: none; color: #fff; font-size: 18px; cursor: pointer; padding: 0 4px; }
#sw-msgs {
  flex: 1; overflow-y: auto; padding: 12px;
  display: flex; flex-direction: column; gap: 8px;
  min-height: 120px;
}
.sw-msg { max-width: 82%; padding: 9px 13px; border-radius: 14px; font-size: 13px; line-height: 1.5; word-break: break-word; }
.sw-msg.user { align-self: flex-end; background: #7a5a10; color: #fff; border-bottom-right-radius: 4px; }
.sw-msg.admin { align-self: flex-start; background: #fff; color: #2a1a08; border: 1px solid rgba(180,140,60,0.2); border-bottom-left-radius: 4px; }
.sw-msg time { display: block; font-size: 10px; opacity: 0.6; margin-top: 4px; }
.sw-empty { text-align: center; color: #9a8060; font-size: 12px; padding: 24px 0; }
#sw-foot { padding: 10px 12px; border-top: 1px solid rgba(180,140,60,0.15); display: flex; gap: 8px; }
#sw-input {
  flex: 1; border: 1px solid rgba(180,140,60,0.3); border-radius: 10px;
  padding: 9px 12px; font-size: 13px; background: #fff; color: #2a1a08;
  font-family: inherit; resize: none; height: 38px; line-height: 1.4;
  outline: none;
}
#sw-input:focus { border-color: #c9a84c; }
#sw-send {
  padding: 9px 14px; background: linear-gradient(135deg, #c9a84c, #7a5a10);
  color: #fff; border: none; border-radius: 10px; font-size: 13px;
  font-weight: 700; cursor: pointer; white-space: nowrap;
}
#sw-send:disabled { opacity: 0.5; cursor: not-allowed; }
`;
  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  // ── DOM 생성 ──
  function buildUI() {
    var btn = document.createElement('button');
    btn.id = 'sw-btn';
    btn.setAttribute('aria-label', '문의하기');
    btn.innerHTML = '<span class="sw-btn-ico">✦</span><span>무엇이든 물어보세요</span><div id="sw-badge"></div>';
    btn.onclick = toggle;

    var panel = document.createElement('div');
    panel.id = 'sw-panel';
    panel.innerHTML = `
      <div id="sw-head">
        <div>✦ 포르투나 지원센터</div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span>운영자가 직접 답변해요</span>
          <button id="sw-close">✕</button>
        </div>
      </div>
      <div id="sw-msgs"></div>
      <div id="sw-foot">
        <textarea id="sw-input" placeholder="문의 내용을 입력하세요" rows="1"></textarea>
        <button id="sw-send">전송</button>
      </div>
    `;

    document.body.appendChild(btn);
    document.body.appendChild(panel);

    document.getElementById('sw-close').onclick = function () { closePanel(); };
    document.getElementById('sw-send').onclick = sendMsg;
    document.getElementById('sw-input').addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); }
    });
  }

  // ── 메시지 로드 ──
  async function loadMessages() {
    var uid = getUserId();
    if (!uid) return;
    var r = await fetch(SB_URL + '/rest/v1/support_messages?user_id=eq.' + encodeURIComponent(uid) + '&order=created_at.asc&limit=100', { headers: HEADERS });
    if (!r.ok) return;
    _messages = await r.json();
    renderMessages();
    updateBadge();
    // 읽음 처리 (admin 메시지)
    if (_open) markRead(uid);
  }

  function renderMessages() {
    var el = document.getElementById('sw-msgs');
    if (!el) return;
    var greeting =
      '<div class="sw-msg admin" style="max-width:92%;">' +
        '<b style="color:#6a4f0c;">안녕하세요 ✦ 포르투나 운영자예요.</b><br><br>' +
        '아래 중 어떤 이야기든 편하게 남겨주세요 🙏<br>' +
        '· <b style="color:#8a6a15;">원하는 기능</b> · 추가했으면 하는 운세/도구<br>' +
        '· <b style="color:#a94a3a;">기능상 문제</b> · 오류, 멈춤, 결과 이상<br>' +
        '· <b style="color:#4a6a9a;">요청사항</b> · 상담·충전·결제 관련 문의<br><br>' +
        '확인하는 대로 바로 답장드릴게요.' +
      '</div>';
    if (!_messages.length) {
      el.innerHTML = greeting;
      el.scrollTop = 0;
      return;
    }
    el.innerHTML = greeting + _messages.map(function (m) {
      var d = new Date(m.created_at);
      var t = d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0');
      var pending = m._pending ? ' style="opacity:0.6;"' : '';
      var mark = m._pending ? ' <span style="font-size:10px;">⏳</span>' : '';
      return '<div class="sw-msg ' + m.sender + '"' + pending + '>' + escHtml(m.content) + '<time>' + t + mark + '</time></div>';
    }).join('');
    el.scrollTop = el.scrollHeight;
  }

  function updateBadge() {
    var badge = document.getElementById('sw-badge');
    if (!badge) return;
    var unread = _messages.filter(function (m) { return m.sender === 'admin' && !m.read; }).length;
    if (unread > 0) { badge.style.display = 'flex'; badge.textContent = unread > 9 ? '9+' : unread; }
    else { badge.style.display = 'none'; }
  }

  async function markRead(uid) {
    await fetch(SB_URL + '/rest/v1/support_messages?user_id=eq.' + encodeURIComponent(uid) + '&sender=eq.admin&read=eq.false', {
      method: 'PATCH', headers: Object.assign({}, HEADERS, { 'Prefer': 'return=minimal' }),
      body: JSON.stringify({ read: true })
    });
  }

  // ── 메시지 전송 ──
  async function sendMsg() {
    var uid = getUserId();
    if (!uid) { alert('로그인이 필요해요.'); return; }
    var input = document.getElementById('sw-input');
    var send = document.getElementById('sw-send');
    var text = (input.value || '').trim();
    if (!text) return;
    send.disabled = true;
    input.value = '';

    // 1) 낙관적 렌더: 내 메시지 즉시 표시
    var tempMsg = { user_id: uid, sender: 'user', content: text, created_at: new Date().toISOString(), _pending: true };
    _messages.push(tempMsg);
    renderMessages();

    try {
      var r = await fetch(SB_URL + '/rest/v1/support_messages', {
        method: 'POST', headers: Object.assign({}, HEADERS, { 'Prefer': 'return=representation' }),
        body: JSON.stringify({ user_id: uid, sender: 'user', content: text, read: true })
      });
      if (!r.ok) {
        var err = await r.text();
        throw new Error('저장 실패 (' + r.status + ')');
      }
      // 서버 반영 후 전체 재로드
      await loadMessages();
    } catch (e) {
      // 실패 시 임시 메시지 제거 + 알림
      _messages = _messages.filter(function (m) { return m !== tempMsg; });
      renderMessages();
      alert('메시지 전송 실패: ' + e.message);
    } finally {
      send.disabled = false;
    }
  }

  // ── 패널 열기/닫기 ──
  function toggle() {
    _open ? closePanel() : openPanel();
  }

  function openPanel() {
    _open = true;
    var p = document.getElementById('sw-panel');
    if (p) p.style.display = 'flex';
    var b = document.getElementById('sw-btn');
    if (b) b.classList.add('sw-open');
    var uid = getUserId();
    if (!uid) {
      var el = document.getElementById('sw-msgs');
      if (el) el.innerHTML =
        '<div class="sw-msg admin" style="max-width:92%;">' +
          '<b style="color:#6a4f0c;">안녕하세요 ✦ 포르투나 운영자예요.</b><br><br>' +
          '<b style="color:#a94a3a;">카카오 로그인</b> 후 문의를 남겨주시면<br>확인하는 대로 바로 답장드릴게요 🙏' +
        '</div>';
      return;
    }
    loadMessages();
    if (_pollTimer) clearInterval(_pollTimer);
    _pollTimer = setInterval(loadMessages, 30000);
  }

  function closePanel() {
    _open = false;
    var p = document.getElementById('sw-panel');
    if (p) p.style.display = 'none';
    var b = document.getElementById('sw-btn');
    if (b) b.classList.remove('sw-open');
    if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
  }

  // ── 유틸 ──
  function escHtml(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
  }

  // ── 초기화 ──
  function init() {
    buildUI();
    var uid = getUserId();
    if (uid) {
      loadMessages(); // 배지 업데이트용 초기 로드
      setInterval(function () { if (!_open) loadMessages(); }, 60000);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else setTimeout(init, 800);
})();
