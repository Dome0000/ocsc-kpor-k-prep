/* learn.js — หน้าแรก + หน้าบทเรียน + อ่านจบแล้ว + % ความคืบหน้า */
'use strict';
(function () {
  var App = window.App;
  var esc = App.esc;
  function getPage(slug) {
    return (window.PAGES || []).find(function (p) { return p.slug === slug; });
  }
  function pagesSorted() {
    return (window.MANIFEST || []).slice().sort(function (a, b) {
      var sa = App.SUBJECT_META[a.subject] ? App.SUBJECT_META[a.subject].order : 99;
      var sb = App.SUBJECT_META[b.subject] ? App.SUBJECT_META[b.subject].order : 99;
      return (sa - sb) || (a.order - b.order);
    });
  }

  function renderHome() {
    var pages = pagesSorted();
    var spec = window.EXAM_SPEC || {};
    var en = (spec.subjects && spec.subjects.english && spec.subjects.english.questions) || 25;
    var totalQ = (spec.subjects && (spec.subjects.analytical.questions + spec.subjects.english.questions + spec.subjects.civil_knowledge.questions)) || 100;
    var verified = spec.verified === true;
    var html = '';
    html += '<div class="card"><h1>📚 ติว ก.พ. ภาค ก</h1>';
    html += '<p class="muted">ความรู้ความสามารถทั่วไป — สำหรับผู้เตรียมสอบเพื่อบรรจุเข้ารับราชการ (ระดับปริญญาตรีเป็นหลัก รองรับต่ำกว่าปริญญาตรีและปริญญาโท)</p>';
    if (!verified) {
      html += '<div class="banner">⚠️ เกณฑ์/คะแนนในเว็บนี้เป็น<strong>ค่าตั้งต้นที่ยังไม่ยืนยันจากประกาศทางการ</strong> (สำนักงาน ก.พ. เข้าถึงไม่ได้ ณ 2026-11-16) — ดูรายละเอียดใน <a href="#/settings">หน้าตั้งค่า</a> และ REVIEW.md</div>';
    }
    html += '<div class="stat-grid" style="margin-top:.5rem">' +
      '<div class="stat-tile"><div class="num">' + pages.length + '</div><div class="muted">บทเรียน</div></div>' +
      '<div class="stat-tile"><div class="num">' + (window.QUESTIONS || []).length + '</div><div class="muted">ข้อฝึกรายหัวข้อ</div></div>' +
      '<div class="stat-tile"><div class="num">' + (window.MOCK_SETS || []).length + '</div><div class="muted">ชุดข้อสอบจำลอง</div></div>' +
      '<div class="stat-tile"><div class="num">' + totalQ + '</div><div class="muted">ข้อ/ชุด (วิชา 2 = ' + en + ')</div></div>' +
    '</div></div>';

    html += '<div class="card"><h2>เริ่มจากตรงไหนดี?</h2><ol>' +
      '<li>อ่าน <a href="#/learn/intro-exam-structure">บทนำ: โครงสร้างข้อสอบและการเตรียมสอบ</a> ก่อน เพื่อรู้ว่าต้องทำคะแนนเท่าไร</li>' +
      '<li>เรียนทีละบทตามแถบด้านซ้าย แล้วติ๊ก "อ่านจบแล้ว" — ระบบจะนับความคืบหน้าให้</li>' +
      '<li>ฝึกทำโจทย์รายหัวข้อ <a href="#/practice">✏️ โหมดฝึก</a> จนแม่นก่อน</li>' +
      '<li>ซ้อมสอบจับเวลาด้วย <a href="#/mock">📝 ข้อสอบจำลอง</a> แล้ววิเคราะห์จุดอ่อนใน <a href="#/dashboard">📊 แดชบอร์ด</a></li>' +
      '<li>ทบทวนข้อที่เคยผิดด้วย <a href="#/review">🔁 ระบบทบทวน (SR)</a></li>' +
    '</ol></div>';

    var bySubject = {};
    pages.forEach(function (p) { (bySubject[p.subject] = bySubject[p.subject] || []).push(p); });
    Object.keys(App.SUBJECT_META).sort(function (a, b) { return App.SUBJECT_META[a].order - App.SUBJECT_META[b].order; }).forEach(function (subj) {
      var list = bySubject[subj];
      if (!list || !list.length) return;
      html += '<div class="card"><h2>' + esc(App.SUBJECT_META[subj].label) + '</h2><ul>';
      list.forEach(function (p) {
        html += '<li><a href="#/learn/' + esc(p.slug) + '">' + esc(p.title) + '</a></li>';
      });
      html += '</ul></div>';
    });

    App.renderSidebar(null);
    document.getElementById('view').innerHTML = html;
    document.title = 'ติว ก.พ. ภาค ก — ความรู้ความสามารถทั่วไป';
  }

  function renderLesson(slug) {
    var page = getPage(slug);
    if (!page) { App.navigate(); return; }
    var done = window.Store.isRead(slug);
    var practiceTopic = (page.exam_topics && page.exam_topics[0]) || '';
    var html = '<article class="lesson"><div id="lesson-body">' + page.html + '</div>';
    html += '<div class="lesson-actions">';
    html += '<label class="read-toggle"><input type="checkbox" id="mark-read"' + (done ? ' checked' : '') + '> อ่านจบแล้ว</label>';
    if (practiceTopic) {
      html += '<a class="btn secondary" href="#/practice?topic=' + encodeURIComponent(practiceTopic) + '">✏️ เปิดแบบฝึกของบทนี้</a>';
    }
    html += '<button class="btn secondary" id="print-btn">🖨️ พิมพ์บทนี้</button>';
    html += '</div></article>';

    App.renderSidebar(slug);
    var view = document.getElementById('view');
    view.innerHTML = html;
    document.title = page.title + ' — ติว ก.พ. ภาค ก';

    document.getElementById('mark-read').addEventListener('change', function (e) {
      window.Store.setRead(slug, e.target.checked);
      App.renderSidebar(slug);
      App.toast(e.target.checked ? 'บันทึกแล้ว: อ่านจบ ✅' : 'ยกเลิกสถานะอ่านจบ');
    });
    document.getElementById('print-btn').addEventListener('click', function () { window.print(); });
  }

  App.route('/learn', renderHome);
  App.route('/learn/:slug', function (params) { renderLesson(params.slug); });
})();
