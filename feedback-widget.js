// ─────────────────────────────────────────────────────────────
// AI 응답 피드백 위젯 (pico · memox 공통)
// 사용법:
//   <div class="fw-mount" data-user-id="..." data-client="pico"
//        data-source="report" data-source-id="..." data-source-type="character"></div>
//   <script src="feedback-widget.js"></script>
//   <script>FeedbackWidget.mount(document.querySelector('.fw-mount'));</script>
//
// 또는 동적으로:
//   FeedbackWidget.render({ container, user_id, client, source, source_id, source_type, meta, reasonSet });
//
// API: POST https://fortuna.kkdmb7.workers.dev/feedback
// ─────────────────────────────────────────────────────────────
(function(){
  const API = 'https://fortuna.kkdmb7.workers.dev';

  // 소스별 기본 이유 태그
  const REASON_PRESETS = {
    report: {
      up:   ['정확해요', '설명이 명확해요', '실용적이에요', '새로운 통찰이에요'],
      down: ['맞지 않아요', '너무 일반적이에요', '이해가 어려워요', '내용이 부족해요'],
    },
    chat: {
      up:   ['답변이 정확해요', '이해가 쉬워요', '도움이 됐어요'],
      down: ['틀린 내용이 있어요', '질문을 이해 못했어요', '답변이 부족해요', '답변이 어려워요'],
    },
    daily_fortune: {
      up:   ['오늘이랑 맞아요', '조언이 유용해요'],
      down: ['안 맞아요', '너무 뻔해요', '조언이 없어요'],
    },
  };

  // CSS 1회 주입
  let _cssInjected = false;
  function injectCss() {
    if (_cssInjected) return;
    _cssInjected = true;
    const css = `
.fw-root { margin:14px 0; padding:14px; border-radius:14px;
  background:rgba(255,255,255,0.04); border:1px solid rgba(212,175,55,0.18);
  font-family:'Noto Sans KR',sans-serif; color:rgba(240,240,245,0.92); }
.fw-ask { font-size:13px; color:rgba(240,240,245,0.78); margin-bottom:10px; }
.fw-btns { display:flex; gap:8px; margin-bottom:10px; }
.fw-btn { flex:1; padding:10px; border-radius:10px; cursor:pointer;
  background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12);
  color:rgba(240,240,245,0.88); font-size:14px; font-weight:600;
  transition:all 0.15s; display:flex; align-items:center; justify-content:center; gap:6px; }
.fw-btn:hover { background:rgba(255,255,255,0.1); }
.fw-btn.active-up { background:rgba(76,175,80,0.18); border-color:rgba(76,175,80,0.5); color:#7fd37f; }
.fw-btn.active-down { background:rgba(244,67,54,0.14); border-color:rgba(244,67,54,0.45); color:#f08a80; }
.fw-reasons { display:none; flex-wrap:wrap; gap:6px; margin-bottom:10px; }
.fw-reasons.open { display:flex; }
.fw-tag { padding:6px 10px; border-radius:999px; cursor:pointer;
  background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.14);
  color:rgba(240,240,245,0.82); font-size:12px; transition:all 0.15s; }
.fw-tag:hover { background:rgba(255,255,255,0.09); }
.fw-tag.selected { background:rgba(212,175,55,0.2); border-color:rgba(212,175,55,0.55); color:#d4af37; }
.fw-comment { display:none; width:100%; min-height:60px; max-height:160px;
  padding:10px; border-radius:10px; margin-bottom:10px; resize:vertical;
  background:rgba(0,0,0,0.25); border:1px solid rgba(255,255,255,0.14);
  color:rgba(240,240,245,0.95); font-size:13px; font-family:inherit; box-sizing:border-box; }
.fw-comment.open { display:block; }
.fw-submit { display:none; width:100%; padding:11px; border-radius:10px;
  background:linear-gradient(135deg,#d4af37,#c9a84c); color:#1a1a2e;
  border:none; cursor:pointer; font-weight:700; font-size:14px; transition:opacity 0.15s; }
.fw-submit.open { display:block; }
.fw-submit:disabled { opacity:0.5; cursor:not-allowed; }
.fw-done { padding:10px; border-radius:10px; text-align:center; font-size:13px;
  background:rgba(76,175,80,0.12); border:1px solid rgba(76,175,80,0.35); color:#a8e6a8; }
.fw-error { color:#f08a80; font-size:12px; margin-top:6px; }
`;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  }

  function h(tag, attrs, children) {
    const el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(k => {
      if (k === 'className') el.className = attrs[k];
      else if (k === 'style' && typeof attrs[k] === 'object') Object.assign(el.style, attrs[k]);
      else if (k.startsWith('on') && typeof attrs[k] === 'function') el.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
      else if (attrs[k] !== null && attrs[k] !== undefined) el.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(c => {
      if (c == null) return;
      el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return el;
  }

  function render(opts) {
    injectCss();
    const { container, user_id, client, source, source_id, source_type, meta } = opts;
    if (!container || !user_id || !client || !source) {
      console.warn('[FeedbackWidget] missing required option', opts);
      return;
    }
    const preset = (opts.reasonSet && opts.reasonSet.up && opts.reasonSet.down)
      ? opts.reasonSet
      : (REASON_PRESETS[source] || REASON_PRESETS.report);

    container.innerHTML = '';
    const root = h('div', { className:'fw-root' });

    const ask = h('div', { className:'fw-ask' }, ['이번 응답 어떠셨어요?']);
    root.appendChild(ask);

    const state = { rating: 0, selected: new Set(), submitting: false };

    const btnUp   = h('button', { className:'fw-btn', type:'button' }, ['👍 도움됐어요']);
    const btnDown = h('button', { className:'fw-btn', type:'button' }, ['👎 아쉬워요']);
    const btns = h('div', { className:'fw-btns' }, [btnUp, btnDown]);
    root.appendChild(btns);

    const reasonsWrap = h('div', { className:'fw-reasons' });
    root.appendChild(reasonsWrap);

    const commentEl = h('textarea', { className:'fw-comment', placeholder:'자세히 알려주시면 개선에 큰 도움이 돼요 (선택)', maxlength:'2000' });
    root.appendChild(commentEl);

    const submitBtn = h('button', { className:'fw-submit', type:'button' }, ['의견 보내기']);
    root.appendChild(submitBtn);

    const errorEl = h('div', { className:'fw-error' });
    root.appendChild(errorEl);

    function rebuildReasons() {
      reasonsWrap.innerHTML = '';
      state.selected = new Set();
      const tags = state.rating === 1 ? preset.up : preset.down;
      tags.forEach(t => {
        const tag = h('button', { className:'fw-tag', type:'button' }, [t]);
        tag.addEventListener('click', () => {
          if (state.selected.has(t)) { state.selected.delete(t); tag.classList.remove('selected'); }
          else { state.selected.add(t); tag.classList.add('selected'); }
        });
        reasonsWrap.appendChild(tag);
      });
    }

    function pick(rating) {
      if (state.submitting) return;
      state.rating = rating;
      btnUp.classList.toggle('active-up', rating === 1);
      btnDown.classList.toggle('active-down', rating === -1);
      rebuildReasons();
      reasonsWrap.classList.add('open');
      commentEl.classList.add('open');
      submitBtn.classList.add('open');
      errorEl.textContent = '';
    }

    btnUp.addEventListener('click', () => pick(1));
    btnDown.addEventListener('click', () => pick(-1));

    async function submit() {
      if (!state.rating || state.submitting) return;
      state.submitting = true;
      submitBtn.disabled = true;
      submitBtn.textContent = '보내는 중...';
      errorEl.textContent = '';
      try {
        const payload = {
          user_id, client, source,
          source_id: source_id || null,
          source_type: source_type || null,
          rating: state.rating,
          reasons: Array.from(state.selected),
          comment: (commentEl.value || '').trim() || null,
          meta: meta || {},
        };
        const res = await fetch(`${API}/feedback`, {
          method:'POST',
          headers:{ 'Content-Type':'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'submit failed');
        container.innerHTML = '';
        const done = h('div', { className:'fw-root' }, [
          h('div', { className:'fw-done' }, ['피드백이 전달됐어요. 더 나은 답변으로 보답할게요 ✨'])
        ]);
        container.appendChild(done);
      } catch(e) {
        errorEl.textContent = '전송 실패: ' + (e.message || '알 수 없는 오류');
        submitBtn.disabled = false;
        submitBtn.textContent = '의견 보내기';
        state.submitting = false;
      }
    }
    submitBtn.addEventListener('click', submit);

    container.appendChild(root);
  }

  function mount(el) {
    if (!el) return;
    render({
      container: el,
      user_id: el.getAttribute('data-user-id'),
      client: el.getAttribute('data-client'),
      source: el.getAttribute('data-source'),
      source_id: el.getAttribute('data-source-id'),
      source_type: el.getAttribute('data-source-type'),
    });
  }

  function autoMount(root) {
    (root || document).querySelectorAll('.fw-mount').forEach(mount);
  }

  window.FeedbackWidget = { render, mount, autoMount, REASON_PRESETS };
})();
