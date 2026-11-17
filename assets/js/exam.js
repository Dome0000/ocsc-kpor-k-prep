/* exam.js — โหมดสอบจริง: เลือกชุด/ระดับ → จับเวลา → นำทาง/ติดธง/คีย์บอร์ด → autosave → สรุป+ทบทวน */
'use strict';
(function () {
  var App = window.App;
  var esc = App.esc;
  var Quiz = window.Quiz;
  var KEY_SESSION = 'ocsc_mock_session_v1';

  // ---------------- หน้าเลือกชุด ----------------
  function renderSelect(query) {
    App.renderSidebar(null);
    var sets = window.MOCK_SETS || [];
    var spec = window.EXAM_SPEC || {};
    var saved = window.Store.read(KEY_SESSION, null);
    var settings = window.Store.settings();
    var defaultMinutes = spec.exam_time_minutes || settings.examMinutes || 180;

    var html = '<div class="card"><h1>📝 ข้อสอบจำลอง (Mock Exam)</h1>';
    if (!spec.verified) {
      html += '<div class="banner">⚠️ เกณฑ์ผ่านในหน้านี้เป็นค่าตั้งต้นที่ยังไม่ยืนยันจากประกาศทางการ — ดู <a href="#/settings">หน้าตั้งค่า</a></div>';
    }
    if (saved && saved.deadline && saved.deadline > Date.now() - 30 * 60 * 1000) {
      html += '<div class="card" style="border-color:var(--primary)"><h2>มีการสอบค้างไว้</h2><p>ชุดที่ ' + ((saved.setIndex || 0) + 1) + ' · ตอบแล้ว ' + (saved.answers || []).filter(function (a) { return a !== null && a !== undefined; }).length + ' ข้อ · ระดับ ' + levelName(saved.level) + '</p>' +
        '<p><button class="btn" id="resume-btn">ทำต่อจากที่ค้างไว้ →</button> <button class="btn secondary" id="discard-btn">ทิ้งแล้วเริ่มใหม่</button></p></div>';
    }

    if (!sets.length) {
      html += '<p class="muted">ยังไม่มีชุดข้อสอบจำลองในระบบ — ชุดที่ 1 กำลังสร้าง (ดู PROGRESS.md)</p></div>';
      document.getElementById('view').innerHTML = html;
      bindSelectButtons(saved);
      return;
    }

    html += '<form id="mock-select"><fieldset style="border:1px solid var(--border);border-radius:var(--radius);padding:.75rem 1rem"><legend><strong>เลือกระดับการศึกษา (เกณฑ์ผ่านเปลี่ยนตามระดับ)</strong></legend>' +
      levelRadio('below_bachelor', 'ต่ำกว่าปริญญาตรี', settings.level) +
      levelRadio('bachelor', 'ปริญญาตรี', settings.level) +
      levelRadio('master', 'ปริญญาโท', settings.level) +
      '</fieldset>';
    html += '<p style="margin-top:.75rem"><label for="minutes">เวลาทำข้อสอบ (นาที) ' + (spec.exam_time_minutes ? '' : '<span class="muted">— ค่าแนะนำ 180 นาที ไม่ใช่ค่าทางการ</span>') + '<br>' +
      '<input type="number" id="minutes" min="1" max="600" value="' + defaultMinutes + '" style="width:8em;min-height:40px;padding:.35rem;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text)"></label></p>';
    html += '<h2>เลือกชุดข้อสอบ</h2><div class="stat-grid">';
    sets.forEach(function (set, i) {
      var n = set.length;
      var counts = countBySubject(set);
      html += '<div class="card" style="margin:0"><h3>ชุดที่ ' + (i + 1) + '</h3><p class="muted">' + n + ' ข้อ (วิเคราะห์ ' + (counts.analytical || 0) + ' · อังกฤษ ' + (counts.english || 0) + ' · ข้าราชการ ' + (counts.civil_knowledge || 0) + ')</p>' +
        '<button class="btn start-set" data-set="' + i + '">เริ่มทำชุดนี้ →</button></div>';
    });
    html += '</div></form></div>';
    document.getElementById('view').innerHTML = html;
    document.title = 'ข้อสอบจำลอง — ติว ก.พ. ภาค ก';
    bindSelectButtons(saved);
    Array.prototype.slice.call(document.querySelectorAll('.start-set')).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var setIndex = parseInt(btn.getAttribute('data-set'), 10);
        var level = (document.querySelector('#mock-select input[name="level"]:checked') || {}).value || 'bachelor';
        var minutes = parseInt(document.getElementById('minutes').value, 10);
        if (!minutes || minutes < 1) minutes = 180;
        window.Store.saveSettings({ level: level, examMinutes: minutes });
        startSession(setIndex, level, minutes);
      });
    });
  }

  function levelRadio(value, label, current) {
    return '<label style="display:block;padding:.2rem .25rem;min-height:44px"><input type="radio" name="level" value="' + value + '"' + (value === (current || 'bachelor') ? ' checked' : '') + '> ' + esc(label) + '</label>';
  }
  function levelName(l) {
    return { below_bachelor: 'ต่ำกว่าปริญญาตรี', bachelor: 'ปริญญาตรี', master: 'ปริญญาโท' }[l] || l;
  }
  function countBySubject(set) {
    var c = {};
    set.forEach(function (q) { c[q.subject] = (c[q.subject] || 0) + 1; });
    return c;
  }
  function bindSelectButtons(saved) {
    var resume = document.getElementById('resume-btn');
    if (resume) resume.addEventListener('click', function () { location.hash = '#/mock/session'; });
    var discard = document.getElementById('discard-btn');
    if (discard) discard.addEventListener('click', function () {
      window.Store.remove(KEY_SESSION);
      App.toast('ทิ้งการสอบที่ค้างไว้แล้ว');
      location.hash = '#/mock?t=' + Date.now(); // force re-render
    });
  }

  // ---------------- session ----------------
  function startSession(setIndex, level, minutes) {
    var set = (window.MOCK_SETS || [])[setIndex];
    if (!set) { App.toast('ไม่พบชุดข้อสอบ'); return; }
    var sess = {
      setIndex: setIndex, level: level, minutes: minutes,
      deadline: Date.now() + minutes * 60 * 1000,
      startedAt: Date.now(),
      answers: new Array(set.length).fill(null),
      flags: new Array(set.length).fill(false),
      current: 0
    };
    window.Store.write(KEY_SESSION, sess);
    location.hash = '#/mock/session';
  }

  var timerId = null;
  function renderSession() {
    App.renderSidebar(null);
    var sess = window.Store.read(KEY_SESSION, null);
    var sets = window.MOCK_SETS || [];
    if (!sess || !sets[sess.setIndex]) {
      document.getElementById('view').innerHTML = '<div class="card"><h1>ไม่มีการสอบที่ค้างอยู่</h1><p><a class="btn" href="#/mock">เลือกชุดข้อสอบ</a></p></div>';
      return;
    }
    var set = sets[sess.setIndex];
    clearInterval(timerId);

    var html = '<div class="exam-top"><div><strong>ชุดที่ ' + (sess.setIndex + 1) + '</strong> · ระดับ' + esc(levelName(sess.level)) + '</div>' +
      '<div class="timer" id="timer" role="timer" aria-label="เวลาที่เหลือ">--:--</div>' +
      '<button class="btn danger" id="submit-exam">ส่งข้อสอบ</button></div>';
    html += '<nav class="exam-nav-grid" id="exam-nav" aria-label="นำทางข้อสอบ"></nav>';
    html += '<div id="exam-question"></div>';
    document.getElementById('view').innerHTML = html;
    document.title = 'กำลังสอบ — ชุดที่ ' + (sess.setIndex + 1);

    renderNavGrid(set, sess);
    renderQuestion(set, sess);
    tickTimer(set, sess);
    timerId = setInterval(function () { tickTimer(set, sess); }, 250);

    document.getElementById('submit-exam').addEventListener('click', function () { confirmSubmit(set, sess); });
    document.addEventListener('keydown', examKeydown);
  }

  function saveSess(sess) { window.Store.write(KEY_SESSION, sess); }

  function renderNavGrid(set, sess) {
    var nav = document.getElementById('exam-nav');
    var html = '';
    var lastSubject = null;
    set.forEach(function (q, i) {
      if (q.subject !== lastSubject) {
        if (lastSubject !== null) html += '';
        html += '<div class="section-sep">' + esc(Quiz.subjectName(q.subject)) + '</div>';
        lastSubject = q.subject;
      }
      var cls = [];
      if (sess.answers[i] !== null && sess.answers[i] !== undefined) cls.push('answered');
      if (sess.flags[i]) cls.push('flagged');
      if (i === sess.current) cls.push('current');
      html += '<button data-i="' + i + '" class="' + cls.join(' ') + '" aria-label="ข้อ ' + (i + 1) + (sess.flags[i] ? ' ติดธง' : '') + '">' + (i + 1) + '</button>';
    });
    nav.innerHTML = html;
    Array.prototype.slice.call(nav.querySelectorAll('button[data-i]')).forEach(function (btn) {
      btn.addEventListener('click', function () {
        sess.current = parseInt(btn.getAttribute('data-i'), 10);
        saveSess(sess);
        renderNavGrid(set, sess);
        renderQuestion(set, sess);
      });
    });
  }

  function renderQuestion(set, sess) {
    var i = sess.current;
    var q = set[i];
    var mount = document.getElementById('exam-question');
    var html = '<div class="card"><div class="question-head"><span>ข้อ ' + (i + 1) + ' / ' + set.length + ' · ' + esc(Quiz.subjectName(q.subject)) + ' › ' + esc(Quiz.topicName(q.topic)) + '</span>' +
      '<button class="btn small secondary" id="flag-btn" aria-pressed="' + sess.flags[i] + '">' + (sess.flags[i] ? '🚩 ติดธงแล้ว' : '🏳️ ติดธงทบทวน') + '</button></div>';
    html += Quiz.stemHtml(q);
    html += '<div id="exam-choices"></div>';
    html += '<div class="lesson-actions"><button class="btn secondary" id="prev-q" ' + (i === 0 ? 'disabled' : '') + '>← ก่อนหน้า</button>' +
      '<span class="muted">ตอบแล้ว ' + sess.answers.filter(function (a) { return a !== null && a !== undefined; }).length + '</span>' +
      '<button class="btn secondary" id="next-q" ' + (i === set.length - 1 ? 'disabled' : '') + '>ถัดไป →</button></div></div>';
    mount.innerHTML = html;

    document.getElementById('exam-choices').appendChild(Quiz.renderChoices(q, {
      selected: sess.answers[i],
      locked: false,
      reveal: false,
      idPrefix: 'exam',
      onPick: function (choiceIndex) {
        sess.answers[i] = choiceIndex;
        saveSess(sess);
        renderQuestion(set, sess);
        renderNavGrid(set, sess);
      }
    }));
    document.getElementById('prev-q').addEventListener('click', function () { if (i > 0) { sess.current--; saveSess(sess); renderQuestion(set, sess); renderNavGrid(set, sess); } });
    document.getElementById('next-q').addEventListener('click', function () { if (i < set.length - 1) { sess.current++; saveSess(sess); renderQuestion(set, sess); renderNavGrid(set, sess); } });
    document.getElementById('flag-btn').addEventListener('click', function () {
      sess.flags[i] = !sess.flags[i];
      saveSess(sess);
      renderQuestion(set, sess);
      renderNavGrid(set, sess);
    });
  }

  function tickTimer(set, sess) {
    var el = document.getElementById('timer');
    if (!el) { clearInterval(timerId); return; }
    var remain = sess.deadline - Date.now();
    if (remain <= 0) {
      el.textContent = '00:00';
      clearInterval(timerId);
      submitExam(set, sess, true);
      return;
    }
    var total = Math.floor(remain / 1000);
    var mm = Math.floor(total / 60), ss = total % 60;
    el.textContent = String(mm).padStart(2, '0') + ':' + String(ss).padStart(2, '0');
    el.classList.toggle('low', remain < 5 * 60 * 1000);
    if (remain < 5 * 60 * 1000 && !sess._warned) {
      sess._warned = true;
      App.toast('เหลือเวลาอีก 5 นาที!');
    }
  }

  function examKeydown(e) {
    if (!location.hash.startsWith('#/mock/session')) { document.removeEventListener('keydown', examKeydown); return; }
    if (/INPUT|TEXTAREA|SELECT/.test((e.target.tagName || ''))) return;
    var sess = window.Store.read(KEY_SESSION, null);
    var sets = window.MOCK_SETS || [];
    if (!sess || !sets[sess.setIndex]) return;
    var set = sets[sess.setIndex];
    var i = sess.current;
    var handled = true;
    var digitMap = { '1': 0, '2': 1, '3': 2, '4': 3, 'ก': 0, 'ข': 1, 'ค': 2, 'ง': 3 };
    if (digitMap[e.key] !== undefined) {
      sess.answers[i] = digitMap[e.key];
      saveSess(sess);
      renderQuestion(set, sess);
      renderNavGrid(set, sess);
    } else if (e.key === 'ArrowLeft' && i > 0) {
      sess.current--; saveSess(sess); renderQuestion(set, sess); renderNavGrid(set, sess);
    } else if (e.key === 'ArrowRight' && i < set.length - 1) {
      sess.current++; saveSess(sess); renderQuestion(set, sess); renderNavGrid(set, sess);
    } else if (e.key === 'f' || e.key === 'F' || e.key === 'ๆ') {
      sess.flags[i] = !sess.flags[i]; saveSess(sess); renderQuestion(set, sess); renderNavGrid(set, sess);
    } else {
      handled = false;
    }
    if (handled) e.preventDefault();
  }

  function confirmSubmit(set, sess) {
    var unanswered = sess.answers.filter(function (a) { return a === null || a === undefined; }).length;
    var msg = unanswered ? ('ยังไม่ได้ตอบ ' + unanswered + ' ข้อ — ส่งข้อสอบเลยไหม?') : 'ตอบครบทุกข้อแล้ว — ส่งข้อสอบ?';
    if (window.confirm(msg)) submitExam(set, sess, false);
  }

  function submitExam(set, sess, auto) {
    clearInterval(timerId);
    document.removeEventListener('keydown', examKeydown);
    var spec = window.EXAM_SPEC || {};
    var perQ = spec.scoring_per_question || 2;
    var result = {
      id: 'r' + Date.now(),
      set_id: (sess.setIndex + 1),
      set_index: sess.setIndex,
      level: sess.level,
      date: new Date().toISOString(),
      time_used_sec: Math.round((Date.now() - sess.startedAt) / 1000),
      auto_submitted: !!auto,
      answers: sess.answers.slice(),
      flags: sess.flags.slice(),
      per_subject: {}, per_topic: {}, total_score: 0, max_score: 0
    };
    var subjectStats = {};
    set.forEach(function (q, i) {
      var correct = sess.answers[i] === q.answer;
      if (!subjectStats[q.subject]) subjectStats[q.subject] = { correct: 0, total: 0 };
      subjectStats[q.subject].correct += correct ? 1 : 0;
      subjectStats[q.subject].total += 1;
      if (!result.per_topic[q.topic]) result.per_topic[q.topic] = { correct: 0, total: 0 };
      result.per_topic[q.topic].correct += correct ? 1 : 0;
      result.per_topic[q.topic].total += 1;
      if (correct) result.total_score += perQ;
      result.max_score += perQ;
      if (!correct) window.Store.srEnqueue(q.id);
      // เก็บ qid จริงลงใน result เพื่อ review (ระบุผ่าน index ก็พอ เพราะ set ไม่เปลี่ยน)
    });
    Object.keys(subjectStats).forEach(function (subj) {
      var st = subjectStats[subj];
      var pct = st.total ? Math.round((st.correct / st.total) * 100) : 0;
      var passPct = (spec.subjects && spec.subjects[subj] && spec.subjects[subj].pass_pct && spec.subjects[subj].pass_pct[sess.level]) || 60;
      result.per_subject[subj] = { correct: st.correct, total: st.total, score: st.correct * perQ, max: st.total * perQ, pct: pct, pass_pct: passPct, passed: pct >= passPct };
    });
    window.Store.addHistory(result);
    window.Store.remove(KEY_SESSION);
    location.hash = '#/mock/result/' + result.id;
  }

  // ---------------- หน้าสรุปผล ----------------
  function renderResult(id) {
    App.renderSidebar(null);
    var history = window.Store.history();
    var result = history.find(function (r) { return r.id === id; });
    if (!result) {
      document.getElementById('view').innerHTML = '<div class="card"><h1>ไม่พบผลสอบนี้</h1><p><a class="btn" href="#/mock">สอบใหม่</a></p></div>';
      return;
    }
    var set = (window.MOCK_SETS || [])[result.set_index] || [];
    var spec = window.EXAM_SPEC || {};
    var overallPass = Object.keys(result.per_subject).length && Object.keys(result.per_subject).every(function (s) { return result.per_subject[s].passed; });

    var html = '<div class="card result-hero"><p class="muted">ชุดที่ ' + result.set_id + ' · ระดับ' + esc(levelName(result.level)) + ' · ' + new Date(result.date).toLocaleString('th-TH') + (result.auto_submitted ? ' · <span class="tag warn">ส่งอัตโนมัติเมื่อหมดเวลา</span>' : '') + '</p>' +
      '<div class="result-score">' + result.total_score + ' / ' + result.max_score + '</div>' +
      '<p>' + (overallPass ? '<span class="tag good">ผ่านครบทุกวิชา 🎉</span>' : '<span class="tag warn">มีบางวิชาที่ยังไม่ผ่าน — ดูจุดอ่อนด้านล่าง</span>') + '</p>' +
      '<p class="muted">เวลาที่ใช้: ' + formatDuration(result.time_used_sec) + '</p></div>';

    html += '<div class="subject-result">';
    Object.keys(result.per_subject).forEach(function (subj) {
      var r = result.per_subject[subj];
      html += '<div class="card subject-card ' + (r.passed ? 'pass' : 'fail') + '"><h3>' + esc(Quiz.subjectName(subj)) + '</h3>' +
        '<div class="result-score" style="font-size:1.8rem">' + r.score + ' / ' + r.max + '</div>' +
        '<p>ถูก ' + r.correct + '/' + r.total + ' ข้อ (' + r.pct + '%) — เกณฑ์ ≥ ' + r.pass_pct + '%</p>' +
        '<p>' + (r.passed ? '<span class="tag good">ผ่าน ✓</span>' : '<span class="tag warn">ไม่ผ่าน ✗</span>') + '</p></div>';
    });
    html += '</div>';

    html += '<div class="card"><h2>ผลรายหัวข้อ</h2>';
    Object.keys(result.per_topic).forEach(function (t) {
      var r = result.per_topic[t];
      var pct = r.total ? Math.round((r.correct / r.total) * 100) : 0;
      html += '<div class="topic-bar"><span>' + esc(Quiz.topicName(t)) + '</span><div class="track"><div class="fill" style="width:' + pct + '%"></div></div><span>' + r.correct + '/' + r.total + ' (' + pct + '%)</span></div>';
    });
    html += '</div>';

    html += '<div class="card"><h2>เฉลยละเอียดทุกข้อ</h2>' +
      '<div role="group" aria-label="ตัวกรองเฉลย" style="display:flex;gap:.4rem;margin-bottom:.5rem">' +
      '<button class="btn small secondary filter-btn" data-filter="all">ทั้งหมด (' + set.length + ')</button>' +
      '<button class="btn small secondary filter-btn" data-filter="wrong">เฉพาะข้อที่ผิด</button>' +
      '<button class="btn small secondary filter-btn" data-filter="flagged">เฉพาะที่ติดธง</button>' +
      '</div><div id="review-list"></div></div>';

    document.getElementById('view').innerHTML = html;
    document.title = 'ผลสอบ — ชุดที่ ' + result.set_id;

    var currentFilter = 'all';
    function renderReviewList() {
      var listHtml = '';
      set.forEach(function (q, i) {
        var picked = result.answers[i];
        var isWrong = picked !== q.answer;
        var isFlagged = !!result.flags[i];
        if (currentFilter === 'wrong' && !isWrong) return;
        if (currentFilter === 'flagged' && !isFlagged) return;
        listHtml += '<div class="card review-item ' + (isWrong ? 'bad' : 'ok') + '" style="margin-bottom:.5rem">' +
          '<div class="question-head"><span>ข้อ ' + (i + 1) + (isFlagged ? ' 🚩' : '') + ' · ' + esc(Quiz.topicName(q.topic)) + '</span>' +
          '<span>' + (isWrong ? '<span class="tag warn">ผิด</span>' : '<span class="tag good">ถูก</span>') + '</span></div>' +
          Quiz.stemHtml(q) +
          '<p>คำตอบของคุณ: ' + (picked === null || picked === undefined ? '<em>ไม่ได้ตอบ</em>' : Quiz.LETTERS[picked] + '. ' + esc(q.choices[picked])) + '</p>' +
          Quiz.explanationHtml(q) + '</div>';
      });
      document.getElementById('review-list').innerHTML = listHtml || '<p class="muted">ไม่มีข้อตามตัวกรองนี้</p>';
    }
    renderReviewList();
    Array.prototype.slice.call(document.querySelectorAll('.filter-btn')).forEach(function (btn) {
      btn.addEventListener('click', function () { currentFilter = btn.getAttribute('data-filter'); renderReviewList(); });
    });
  }

  function formatDuration(sec) {
    var m = Math.floor(sec / 60), s = sec % 60;
    return m + ' นาที ' + s + ' วินาที';
  }

  App.route('/mock', function (params, query) { renderSelect(query); });
  App.route('/mock/session', renderSession);
  App.route('/mock/result/:id', function (params) { renderResult(params.id); });
})();
