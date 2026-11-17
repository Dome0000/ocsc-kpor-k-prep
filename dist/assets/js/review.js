/* review.js — ทบทวนข้อที่เคยผิด/บุ๊กมาร์ก แบบ Leitner spaced repetition */
'use strict';
(function () {
  var App = window.App;
  var esc = App.esc;
  var Quiz = window.Quiz;

  function bookmarkedIds() {
    return Object.keys(window.Store.bookmarks());
  }
  function dueIds() {
    return window.Store.srDueToday();
  }

  function renderHome() {
    App.renderSidebar(null);
    var due = dueIds();
    var bookmarked = bookmarkedIds();
    var total = Object.keys(window.Store.srAll()).length;
    var html = '<div class="card"><h1>🔁 ทบทวนแบบ Spaced Repetition</h1>' +
      '<p class="muted">ระบบ Leitner อย่างง่าย — ข้อที่ตอบผิดจะเข้าคิวอัตโนมัติ ข้อที่ตอบถูกจะเลื่อนกล่องขึ้น (จำได้นานขึ้น) ข้อที่ลืมจะกลับไปกล่อง 0</p>' +
      '<div class="stat-grid"><div class="stat-tile"><div class="sr-due">' + due.length + '</div><div class="muted">ครบกำหนดวันนี้</div></div>' +
      '<div class="stat-tile"><div class="num">' + total + '</div><div class="muted">ข้อในระบบ SR</div></div>' +
      '<div class="stat-tile"><div class="num">' + bookmarked.length + '</div><div class="muted">บุ๊กมาร์ก</div></div></div>' +
      '<p style="margin-top:.75rem"><button class="btn" id="start-due" ' + (due.length ? '' : 'disabled') + '>เริ่มทบทวนข้อที่ครบกำหนด (' + due.length + ') →</button> ' +
      '<button class="btn secondary" id="start-bookmarked" ' + (bookmarked.length ? '' : 'disabled') + '>ทบทวนข้อที่บุ๊กมาร์ก (' + bookmarked.length + ') →</button></p></div>';
    document.getElementById('view').innerHTML = html;
    document.title = 'ทบทวน — ติว ก.พ. ภาค ก';
    var b1 = document.getElementById('start-due');
    if (b1 && due.length) b1.addEventListener('click', function () { location.hash = '#/review/run?source=due'; });
    var b2 = document.getElementById('start-bookmarked');
    if (b2 && bookmarked.length) b2.addEventListener('click', function () { location.hash = '#/review/run?source=bookmarked'; });
  }

  var queue = null; // { ids, index, graded }

  function renderRun(query) {
    App.renderSidebar(null);
    var source = query.get('source') || 'due';
    var ids = source === 'bookmarked' ? bookmarkedIds() : dueIds();
    var idx = Quiz.questionIndex();
    queue = { ids: ids.filter(function (id) { return idx[id]; }), index: 0, source: source };
    if (!queue.ids.length) {
      document.getElementById('view').innerHTML = '<div class="card"><h1>ไม่มีข้อให้ทบทวน</h1><p><a class="btn" href="#/review">กลับ</a></p></div>';
      return;
    }
    renderCard();
  }

  function renderCard() {
    var s = queue;
    var q = Quiz.questionIndex()[s.ids[s.index]];
    if (!q) { s.index++; if (s.index < s.ids.length) return renderCard(); return renderDone(); }
    var picked = null, revealed = false;

    var html = '<div class="card"><div class="question-head"><span>ข้อที่ ' + (s.index + 1) + '/' + s.ids.length + ' · ' + esc(Quiz.subjectName(q.subject)) + ' › ' + esc(Quiz.topicName(q.topic)) + '</span>' +
      '<span class="tag">SR กล่อง ' + ((window.Store.srAll()[q.id] || { box: 0 }).box) + '</span></div>';
    html += Quiz.stemHtml(q);
    html += '<div id="sr-choices"></div><div id="sr-explain"></div>';
    html += '<div class="lesson-actions" id="sr-grade-row" hidden>' +
      '<button class="btn danger" id="grade-forgot">ลืม ✗ (กลับกล่อง 0)</button>' +
      '<button class="btn" id="grade-remembered">จำได้ ✓</button></div></div>';
    document.getElementById('view').innerHTML = html;
    document.title = 'ทบทวน — ข้อ ' + (s.index + 1);

    var mount = document.getElementById('sr-choices');
    mount.appendChild(Quiz.renderChoices(q, {
      selected: null, locked: false, reveal: false, idPrefix: 'sr',
      onPick: function (i) {
        picked = i;
        mount.innerHTML = '';
        mount.appendChild(Quiz.renderChoices(q, { selected: i, locked: true, reveal: true, idPrefix: 'sr2' }));
        document.getElementById('sr-explain').innerHTML = Quiz.explanationHtml(q);
        document.getElementById('sr-grade-row').hidden = false;
        if (i === q.answer) window.Store.bumpStat(q.topic, true); else window.Store.bumpStat(q.topic, false);
      }
    }));
    document.getElementById('grade-forgot').addEventListener('click', function () {
      window.Store.srGrade(q.id, false); next();
    });
    document.getElementById('grade-remembered').addEventListener('click', function () {
      window.Store.srGrade(q.id, true); next();
    });
    function next() {
      s.index++;
      if (s.index < s.ids.length) renderCard(); else renderDone();
    }
  }

  function renderDone() {
    document.getElementById('view').innerHTML =
      '<div class="card result-hero"><h1>ทบทวนครบแล้ว! 🎉</h1><p class="muted">ทำต่อเนื่องตามรอบเวลาเพื่อจำได้นานขึ้น</p>' +
      '<p><a class="btn" href="#/review">กลับหน้าทบทวน</a> <a class="btn secondary" href="#/dashboard">ดูแดชบอร์ด</a></p></div>';
  }

  App.route('/review', renderHome);
  App.route('/review/run', function (params, query) { renderRun(query); });
})();
