/* quiz.js — ตัวช่วยร่วมสำหรับแสดงข้อสอบ (ใช้โดย practice/exam/review) */
'use strict';
window.Quiz = (function () {
  var App = window.App;
  var esc = App.esc;
  var LETTERS = ['ก', 'ข', 'ค', 'ง'];

  var SUBJECT_NAMES = {
    analytical: 'วิชา 1 ความคิดวิเคราะห์',
    english: 'วิชา 2 ภาษาอังกฤษ',
    civil_knowledge: 'วิชา 3 ความรู้ข้าราชการที่ดี'
  };
  var TOPIC_NAMES = {
    language: 'เชิงภาษา', abstract: 'เชิงนามธรรม', quantitative: 'เชิงปริมาณ',
    conversation: 'การสนทนา', vocabulary: 'คำศัพท์', grammar: 'ไวยากรณ์', reading: 'อ่านจับใจความ',
    public_admin_law: 'พ.ร.บ.ระเบียบบริหารราชการแผ่นดิน', good_governance: 'หลักการบริหารกิจการบ้านเมืองที่ดี',
    administrative_procedure: 'วิธีปฏิบัติราชการทางปกครอง', liability_discipline_ethics: 'ความรับผิด/วินัย/จริยธรรม'
  };
  function subjectName(s) { return SUBJECT_NAMES[s] || s; }
  function topicName(t) { return TOPIC_NAMES[t] || t; }
  function findQuestion(id) {
    var all = (window.QUESTIONS || []);
    for (var i = 0; i < (window.MOCK_SETS || []).length; i++) all = all.concat(window.MOCK_SETS[i]);
    for (var j = 0; j < all.length; j++) if (all[j].id === id) return all[j];
    return null;
  }
  function allQuestions() {
    var all = (window.QUESTIONS || []).slice();
    (window.MOCK_SETS || []).forEach(function (s) { all = all.concat(s); });
    return all;
  }
  function questionIndex() {
    var map = {};
    allQuestions().forEach(function (q) { map[q.id] = q; });
    return map;
  }

  function stemHtml(q) {
    var h = '<div class="question-stem">' + esc(q.stem).replace(/\n/g, '<br>') + '</div>';
    if (q.figure_svg) h += '<div class="figure-svg-wrap" role="img" aria-label="ภาพประกอบโจทย์">' + q.figure_svg + '</div>';
    return h;
  }

  /* render ตัวเลือก
     opts: { selected: index|null, locked: bool, reveal: bool (เฉลยแล้ว: ไฮไลต์ถูก/ผิด),
             onPick: function(i), idPrefix: string } */
  function renderChoices(q, opts) {
    opts = opts || {};
    var list = document.createElement('ul');
    list.className = 'choice-list';
    list.setAttribute('role', 'radiogroup');
    list.setAttribute('aria-label', 'ตัวเลือกคำตอบ');
    q.choices.forEach(function (choice, i) {
      var li = document.createElement('li');
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'choice';
      btn.setAttribute('role', 'radio');
      btn.id = (opts.idPrefix || 'q') + '-choice-' + i;

      var selected = opts.selected === i;
      btn.setAttribute('aria-checked', String(selected));
      if (selected) btn.classList.add('selected');
      if (opts.reveal) {
        if (i === q.answer) btn.classList.add('correct');
        else if (selected) btn.classList.add('wrong');
      }
      if (opts.locked) btn.disabled = true;
      btn.innerHTML = '<span class="choice-key" aria-hidden="true">' + LETTERS[i] + '.</span><span>' + esc(choice) + '</span>';
      if (!opts.locked && typeof opts.onPick === 'function') {
        btn.addEventListener('click', function () { opts.onPick(i); });
      }
      li.appendChild(btn);
      list.appendChild(li);
    });
    return list;
  }

  function explanationHtml(q) {
    var h = '<div class="card explanation" style="margin-top:.5rem"><h3 style="margin-top:0">เฉลย</h3>';
    h += '<p><strong>คำตอบ: ' + LETTERS[q.answer] + '.</strong> ' + esc(q.explanation || '') + '</p>';
    if (q.shortcut) h += '<p>💡 <strong>เทคนิคทำเร็ว:</strong> ' + esc(q.shortcut) + '</p>';
    if (q.law_ref) h += '<p>⚖️ <strong>อ้างอิงกฎหมาย:</strong> ' + esc(q.law_ref) + '</p>';
    if (q.needs_review) h += '<p><span class="needs-review-badge">needs_review — รอตรวจสอบความถูกต้อง</span></p>';
    if (q.study_ref) h += '<p>📖 <a href="#/learn/' + esc(q.study_ref) + '">ไปอ่านบทเรียนที่เกี่ยวข้อง</a></p>';
    h += '</div>';
    return h;
  }

  return {
    LETTERS: LETTERS, SUBJECT_NAMES: SUBJECT_NAMES, TOPIC_NAMES: TOPIC_NAMES,
    subjectName: subjectName, topicName: topicName,
    findQuestion: findQuestion, allQuestions: allQuestions, questionIndex: questionIndex,
    stemHtml: stemHtml, renderChoices: renderChoices, explanationHtml: explanationHtml
  };
})();
