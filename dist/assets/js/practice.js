/* practice.js — โหมดฝึกรายหัวข้อ เฉลยทันที */
'use strict';
(function () {
  var App = window.App;
  var esc = App.esc;
  var Quiz = window.Quiz;

  function topicsFor(subject) {
    var spec = (window.EXAM_SPEC && window.EXAM_SPEC.subjects) || {};
    var subj = spec[subject];
    return (subj && subj.blueprint) ? Object.keys(subj.blueprint) : [];
  }
  function practiceQuestions() { return window.QUESTIONS || []; }

  function renderFilter(query) {
    App.renderSidebar(null);
    var subject = query.get('subject') || '';
    var topic = query.get('topic') || '';
    var difficulty = query.get('difficulty') || '0';
    var all = practiceQuestions();
    if (!all.length) {
      document.getElementById('view').innerHTML = '<div class="card"><h1>✏️ ฝึกรายหัวข้อ</h1><p class="muted">ยังไม่มีข้อสอบในคลัง — ข้อสอบกำลังทยอยสร้างตามแผน (ดู PROGRESS.md)</p></div>';
      return;
    }
    var subjects = Array.from(new Set(all.map(function (q) { return q.subject; })));
    if (!subject) subject = subjects[0];
    var topics = Array.from(new Set(all.filter(function (q) { return q.subject === subject; }).map(function (q) { return q.topic; })));

    var html = '<div class="card"><h1>✏️ ฝึกรายหัวข้อ</h1><form id="practice-filter" class="stat-grid" style="grid-template-columns: repeat(auto-fit,minmax(180px,1fr)); align-items:end">';
    html += selectHtml('subject', 'วิชา', subjects.map(function (s) { return [s, Quiz.subjectName(s)]; }), subject);
    html += selectHtml('topic', 'หัวข้อ', [['', 'ทุกหัวข้อ']].concat(topics.map(function (t) { return [t, Quiz.topicName(t)]; })), topic);
    html += selectHtml('difficulty', 'ความยาก', [['0', 'ทุกระดับ'], ['1', 'ง่าย'], ['2', 'กลาง'], ['3', 'ยาก']], difficulty);
    html += '<div><button class="btn" type="submit">เริ่มฝึก →</button></div></form></div>';
    html += '<div class="card"><p class="muted">เลือกเงื่อนไขแล้วกดเริ่มฝึก — ระบบเฉลยทันทีหลังตอบทุกข้อ และนับสถิติรายหัวข้อลงในแดชบอร์ด</p>';
    html += '<p>คลังแบบฝึก: <strong>' + all.length + '</strong> ข้อ (ไม่นับรวมชุดจำลอง)</p></div>';

    document.getElementById('view').innerHTML = html;
    document.title = 'ฝึกรายหัวข้อ — ติว ก.พ. ภาค ก';

    document.getElementById('practice-filter').addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.target;
      var q = new URLSearchParams();
      q.set('subject', f.subject.value);
      if (f.topic.value) q.set('topic', f.topic.value);
      q.set('difficulty', f.difficulty.value);
      location.hash = '#/practice/run?' + q.toString();
    });
    // เปลี่ยนวิชา → รีเฟรชรายการหัวข้อ
    var subjectSel = document.querySelector('#practice-filter select[name="subject"]');
    subjectSel.addEventListener('change', function () {
      var q = new URLSearchParams({ subject: subjectSel.value });
      location.hash = '#/practice?' + q.toString();
    });
  }

  function selectHtml(name, label, options, selected) {
    var h = '<label>' + esc(label) + '<br><select name="' + esc(name) + '" style="min-height:40px;padding:.35rem;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text);width:100%">';
    options.forEach(function (o) {
      h += '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(selected) ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
    });
    return h + '</select></label>';
  }

  var session = null; // { items, index, answers: {qid: choice} }

  function buildSession(query) {
    var subject = query.get('subject') || '';
    var topic = query.get('topic') || '';
    var difficulty = parseInt(query.get('difficulty') || '0', 10);
    var qids = query.get('qids');
    var items = practiceQuestions().filter(function (q) {
      if (qids) return qids.split(',').indexOf(q.id) !== -1;
      if (subject && q.subject !== subject) return false;
      if (topic && q.topic !== topic) return false;
      if (difficulty && q.difficulty !== difficulty) return false;
      return true;
    });
    // สุ่มลำดับแบบคงที่ต่อ session นี้
    for (var i = items.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = items[i]; items[i] = items[j]; items[j] = t;
    }
    return { items: items, index: 0, answered: {} };
  }

  function renderRun(query) {
    App.renderSidebar(null);
    session = buildSession(query);
    if (!session.items.length) {
      document.getElementById('view').innerHTML = '<div class="card"><h1>ไม่พบข้อสอบตามเงื่อนไข</h1><p><a class="btn" href="#/practice">กลับไปเลือกใหม่</a></p></div>';
      return;
    }
    renderCurrent();
  }

  function renderCurrent() {
    var s = session;
    var q = s.items[s.index];
    var picked = s.answered[q.id];
    var locked = picked !== undefined;
    var html = '<div class="card"><div class="question-head"><span>' + esc(Quiz.subjectName(q.subject)) + ' › ' + esc(Quiz.topicName(q.topic)) +
      ' · ความยาก: ' + ['', 'ง่าย', 'กลาง', 'ยาก'][q.difficulty] + ' · ข้อ ' + (s.index + 1) + '/' + s.items.length + '</span>' +
      '<button class="btn small secondary" id="bookmark-btn" aria-pressed="' + window.Store.isBookmarked(q.id) + '">' + (window.Store.isBookmarked(q.id) ? '🔖 บุ๊กมาร์กแล้ว' : '🔖 บุ๊กมาร์ก') + '</button></div>';
    html += Quiz.stemHtml(q);
    html += '<div id="choices-mount"></div><div id="explain-mount"></div>';
    html += '<div class="lesson-actions"><button class="btn secondary" id="prev-q" ' + (s.index === 0 ? 'disabled' : '') + '>← ก่อนหน้า</button>' +
      '<span class="muted">ตอบแล้ว ' + Object.keys(s.answered).length + '/' + s.items.length + '</span>' +
      '<button class="btn" id="next-q">' + (s.index === s.items.length - 1 ? 'ดูสรุป →' : 'ถัดไป →') + '</button></div></div>';
    document.getElementById('view').innerHTML = html;
    document.title = 'ฝึก: ' + Quiz.topicName(q.topic);

    var mount = document.getElementById('choices-mount');
    mount.appendChild(Quiz.renderChoices(q, {
      selected: locked ? picked : null,
      locked: locked,
      reveal: locked,
      idPrefix: 'practice',
      onPick: function (i) {
        s.answered[q.id] = i;
        var correct = i === q.answer;
        window.Store.bumpStat(q.topic, correct);
        if (!correct) window.Store.srEnqueue(q.id);
        renderCurrent(); // รีเรนเดอร์เพื่อเฉลยทันที
      }
    }));
    if (locked) {
      document.getElementById('explain-mount').innerHTML = Quiz.explanationHtml(q);
    }
    document.getElementById('prev-q').addEventListener('click', function () { if (s.index > 0) { s.index--; renderCurrent(); } });
    document.getElementById('next-q').addEventListener('click', function () {
      if (s.index < s.items.length - 1) { s.index++; renderCurrent(); }
      else renderSummary();
    });
    document.getElementById('bookmark-btn').addEventListener('click', function () {
      var on = window.Store.toggleBookmark(q.id);
      this.setAttribute('aria-pressed', String(on));
      this.textContent = on ? '🔖 บุ๊กมาร์กแล้ว' : '🔖 บุ๊กมาร์ก';
    });
  }

  function renderSummary() {
    var s = session;
    var correct = 0;
    s.items.forEach(function (q) { if (s.answered[q.id] === q.answer) correct++; });
    var pct = s.items.length ? Math.round((correct / s.items.length) * 100) : 0;
    document.getElementById('view').innerHTML =
      '<div class="card result-hero"><h1>เสร็จสิ้นการฝึก! 🎉</h1>' +
      '<div class="result-score">' + correct + ' / ' + s.items.length + '</div>' +
      '<p class="muted">ตอบถูก ' + pct + '%</p>' +
      '<p><a class="btn" href="#/practice">ฝึกต่อ</a> <a class="btn secondary" href="#/dashboard">ดูแดชบอร์ด</a></p></div>';
  }

  App.route('/practice', function (params, query) { renderFilter(query); });
  App.route('/practice/run', function (params, query) { renderRun(query); });
})();
