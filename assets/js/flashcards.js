/* flashcards.js — แฟลชการ์ดศัพท์ภาษาอังกฤษ */
'use strict';
(function () {
  var App = window.App;
  var esc = App.esc;

  var state = { topic: 'all', order: [], index: 0, revealed: false };

  function topics() {
    var set = {};
    (window.FLASHCARDS || []).forEach(function (c) { if (c.topic) set[c.topic] = true; });
    return Object.keys(set).sort();
  }
  function filtered() {
    return (window.FLASHCARDS || []).filter(function (c) { return state.topic === 'all' || c.topic === state.topic; });
  }

  function renderHome() {
    App.renderSidebar(null);
    var cards = window.FLASHCARDS || [];
    var html = '<div class="card"><h1>🃏 แฟลชการ์ดศัพท์ภาษาอังกฤษ</h1>';
    if (!cards.length) {
      html += '<p class="muted">ยังไม่มีแฟลชการ์ด — จะเพิ่มเมื่อเขียนเนื้อหาวิชา 2</p></div>';
      document.getElementById('view').innerHTML = html;
      return;
    }
    html += '<p class="muted">ทั้งหมด ' + cards.length + ' คำ — เลือกหมวดแล้วกดเริ่ม กดการ์ดเพื่อดูความหมาย</p>' +
      '<p><label for="fc-topic">หมวดคำศัพท์<br><select id="fc-topic" style="min-height:40px;padding:.35rem;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text)">' +
      '<option value="all">ทุกหมวด</option>' +
      topics().map(function (t) { return '<option value="' + esc(t) + '">' + esc(t) + '</option>'; }).join('') +
      '</select></label></p>' +
      '<p><button class="btn" id="fc-start">เริ่มเลื่อนการ์ด →</button></p></div>';
    document.getElementById('view').innerHTML = html;

    document.getElementById('fc-start').addEventListener('click', function () {
      state.topic = document.getElementById('fc-topic').value;
      var items = filtered();
      state.order = items.map(function (_, i) { return i; });
      for (var i = state.order.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = state.order[i]; state.order[i] = state.order[j]; state.order[j] = t;
      }
      state.index = 0;
      state.revealed = false;
      renderCard();
    });
  }

  function renderCard() {
    var items = filtered();
    if (!items.length) { renderHome(); return; }
    var card = items[state.order[state.index]];
    var html = '<div class="card flashcard"><div class="question-head"><span>' + (state.index + 1) + ' / ' + items.length + (card.topic ? ' · ' + esc(card.topic) : '') + '</span></div>' +
      '<button class="flashcard-inner btn secondary" id="flip" style="width:100%;border-radius:var(--radius)" aria-label="พลิกการ์ด">' +
      (state.revealed
        ? '<div class="flashcard-front" style="font-size:1.1rem;color:var(--primary)">' + esc(card.back) + '</div><div class="muted">' + esc(card.example || '') + '</div><div class="muted" style="font-size:.8rem">(แตะเพื่อดูคำศัพท์)</div>'
        : '<div class="flashcard-front">' + esc(card.front) + '</div><div class="muted" style="font-size:.8rem">(แตะเพื่อดูความหมาย)</div>') +
      '</button>' +
      '<div class="lesson-actions"><button class="btn secondary" id="prev-fc">← ก่อนหน้า</button>' +
      '<button class="btn secondary" id="shuffle-fc">🔀 สุ่มใหม่</button>' +
      '<button class="btn" id="next-fc">ถัดไป →</button></div></div>';
    document.getElementById('view').innerHTML = html;
    document.title = 'แฟลชการ์ด — ติว ก.พ. ภาค ก';
    document.getElementById('flip').addEventListener('click', function () { state.revealed = !state.revealed; renderCard(); });
    document.getElementById('prev-fc').addEventListener('click', function () { if (state.index > 0) { state.index--; state.revealed = false; renderCard(); } });
    document.getElementById('next-fc').addEventListener('click', function () { if (state.index < items.length - 1) { state.index++; state.revealed = false; renderCard(); } });
    document.getElementById('shuffle-fc').addEventListener('click', function () {
      for (var i = state.order.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = state.order[i]; state.order[i] = state.order[j]; state.order[j] = t; }
      state.index = 0; state.revealed = false; renderCard();
    });
  }

  App.route('/flashcards', renderHome);
})();
