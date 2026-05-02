// pico 친구 초대 공유 통합 (charge.html / index.html mypage 탭 / mypage.html / 기타)
// 공통 동작: site-stats fetch → 누적 분석 수 자동 삽입 → 카카오 공유 / navigator.share / clipboard fallback
(function() {
  if (window.picoShareInvite) return; // 중복 로드 방지

  var KAKAO_JS_KEY = '2543c896dead8185e2edfa0976396f25';
  var GODDESS_IMG  = 'https://picolab.kr/img/goddess/goddess-app.png';
  var SHARE_URL    = 'https://picolab.kr/?ref=';

  var _statsCache = null;
  function _fetchStats() {
    if (_statsCache) return Promise.resolve(_statsCache);
    return fetch('https://fortuna.kkdmb7.workers.dev/site-stats')
      .then(function(r) { return r.json(); })
      .then(function(d) { _statsCache = d || {}; return _statsCache; })
      .catch(function() { return {}; });
  }

  function _buildDescription(stats) {
    var rep = stats && stats.reports ? stats.reports : 0;
    var hasMany = rep >= 100;
    var line1 = hasMany
      ? '지금까지 ' + rep.toLocaleString() + '건의 운세 분석'
      : '사주·점성·자미두수 AI 분석';
    var line2 = '카카오 로그인만 하면 양쪽 50 Orb 즉시 지급';
    return line1 + ' · ' + line2;
  }

  // userId UUID 만 허용 — 잘못된 ID 로 공유 차단
  var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  function picoShareInvite(userId, name) {
    if (!userId) {
      try { alert('카카오 로그인이 필요해요'); } catch(e) {}
      return;
    }
    var inviterName = name ? (name + '님이 추천한 ') : '';
    var link = SHARE_URL + encodeURIComponent(userId);

    _fetchStats().then(function(stats) {
      var description = _buildDescription(stats);
      var fullMsg = inviterName + '포르투나 — AI 운세 상담\n' + description + '\n' + link;

      // 1) 모바일: navigator.share 우선 (네이티브)
      if (navigator.share) {
        navigator.share({
          title: '포르투나 — 친구 초대',
          text: fullMsg,
          url: link
        }).catch(function(){});
        return;
      }
      // 2) PC: Kakao SDK
      if (window.Kakao && window.Kakao.Share) {
        if (!window.Kakao.isInitialized()) { try { Kakao.init(KAKAO_JS_KEY); } catch(e) {} }
        Kakao.Share.sendDefault({
          objectType: 'feed',
          content: {
            title: inviterName + '포르투나 — AI 운세 상담',
            description: description,
            imageUrl: GODDESS_IMG,
            link: { mobileWebUrl: link, webUrl: link }
          },
          buttons: [{
            title: '무료로 시작 (+50 Orb)',
            link: { mobileWebUrl: link, webUrl: link }
          }]
        });
        return;
      }
      // 3) 기타: 클립보드
      if (navigator.clipboard) {
        navigator.clipboard.writeText(link).then(function() {
          try { alert('초대 링크가 복사됐어요\n' + link); } catch(e) {}
        }).catch(function() {
          try { prompt('초대 링크:', link); } catch(e) {}
        });
      } else {
        try { prompt('초대 링크:', link); } catch(e) {}
      }
    });
  }

  window.picoShareInvite = picoShareInvite;
})();
