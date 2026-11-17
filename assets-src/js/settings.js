/* settings.js — ระดับการศึกษา, เวลา, ขนาดฟอนต์, export/import, reset, สถานะ verified */
'use strict';
(function () {
  var App = window.App;
  var esc = App.esc;

  function download(filename, text) {
    var blob = new Blob([text], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function renderSettings() {
    App.renderSidebar(null);
    var spec = window.EXAM_SPEC || {};
    var s = window.Store.settings();
    var html = '<div class="card"><h1>⚙️ ตั้งค่า</h1>';

    if (spec.verified === false) {
      html += '<div class="banner"><strong>⚠️ ค่าคะแนน/เกณฑ์ผ่านยังไม่ยืนยัน</strong><br>เว็บนี้เข้าถึงประกาศทางการไม่ได้ ณ 2026-11-16 (ocsc.go.th ตอบ 403, krisdika ใบรับรอง SSL ไม่ผ่าน) ค่าทั้งหมดเป็นค่าตั้งต้น โปรดตรวจจากประกาศสำนักงาน ก.พ. ฉบับล่าสุดก่อนใช้ตัดสินการซ้อมสอบ:<ul>' +
        '<li>วิชา 1: 50 ข้อ / 100 คะแนน / ผ่าน ≥ 60% (ป.ตรีและต่ำกว่า) หรือ ≥ 65% (ป.โท) — ไม่ยืนยัน</li>' +
        '<li>วิชา 2: 25 ข้อ (บางแหล่งว่า 20) / 50 คะแนน / ผ่าน ≥ 50% — ไม่ยืนยัน</li>' +
        '<li>วิชา 3: 25 ข้อ / 50 คะแนน / ผ่าน ≥ 60% — ไม่ยืนยัน</li>' +
        '<li>เวลาสอบ: ไม่ทราบ — ใช้ค่าที่คุณตั้งด้านล่าง</li>' +
        '<li>เกณฑ์ผ่านเป็นรายวิชาหรือรวม — ไม่ยืนยัน (เว็บใช้แบบรายวิชา)</li>' +
      '</ul>เมื่อตรวจแล้วยืนยัน แก้ <code>config/exam-spec.json</code> แล้วรัน <code>python scripts\\build.py</code> ใหม่</div>';
    }

    html += '<form id="settings-form">';
    html += '<fieldset style="border:1px solid var(--border);border-radius:var(--radius);padding:.75rem 1rem;margin-bottom:.75rem"><legend><strong>ระดับการศึกษา (มีผลต่อเกณฑ์ผ่าน)</strong></legend>' +
      levelOpt('below_bachelor', 'ต่ำกว่าปริญญาตรี (ผ่าน ≥ 60% ทุกวิชา)', s.level) +
      levelOpt('bachelor', 'ปริญญาตรี (ผ่าน ≥ 60% วิเคราะห์/ข้าราชการ และ ≥ 50% อังกฤษ)', s.level) +
      levelOpt('master', 'ปริญญาโท (ผ่าน ≥ 65% วิเคราะห์ — ไม่ยืนยัน)', s.level) +
      '</fieldset>';

    html += '<p><label for="exam-minutes">เวลาทำข้อสอบจำลอง (นาที) <span class="muted">— ไม่ใช่ค่าทางการ ตั้งตามรอบสอบจริงของคุณ</span><br>' +
      '<input type="number" id="exam-minutes" min="1" max="600" value="' + esc(String(s.examMinutes || spec.exam_time_minutes || 180)) + '" style="width:8em;min-height:40px;padding:.35rem;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text)"></label></p>';

    html += '<p><label for="font-size">ขนาดตัวอักษร (px)<br>' +
      '<select id="font-size" style="min-height:40px;padding:.35rem;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text)">' +
      [16, 18, 20].map(function (n) { return '<option value="' + n + '"' + (s.fontSize === n ? ' selected' : '') + '>' + n + 'px</option>'; }).join('') +
      '</select></label></p>';

    html += '<button class="btn" type="submit">บันทึกการตั้งค่า</button></form></div>';

    html += '<div class="card"><h2>ข้อมูลความคืบหน้า</h2>' +
      '<p><button class="btn secondary" id="export-btn">⬇️ ส่งออกความคืบหน้า (JSON)</button> ' +
      '<label class="btn secondary" for="import-file" style="cursor:pointer">⬆️ นำเข้าความคืบหน้า</label>' +
      '<input type="file" id="import-file" accept="application/json,.json" hidden> ' +
      '<button class="btn danger" id="reset-btn">🗑️ ล้างข้อมูลทั้งหมด</button></p>' +
      '<p class="muted">ข้อมูลทั้งหมดเก็บในเบราว์เซอร์ของคุณเท่านั้น (localStorage) ไม่มีการส่งอะไรออกไปภายนอก</p></div>';

    html += '<div class="card"><h2>เกี่ยวกับเกณฑ์ที่ใช้ในเว็บ</h2><ul>' +
      '<li>วิชา 1 คิดวิเคราะห์: ' + (spec.subjects ? spec.subjects.analytical.questions : '?') + ' ข้อ / ' + (spec.subjects ? spec.subjects.analytical.max_score : '?') + ' คะแนน / blueprint ภาษา ' + (spec.subjects ? spec.subjects.analytical.blueprint.language : '?') + ' : นามธรรม ' + (spec.subjects ? spec.subjects.analytical.blueprint.abstract : '?') + ' : ปริมาณ ' + (spec.subjects ? spec.subjects.analytical.blueprint.quantitative : '?') + '</li>' +
      '<li>วิชา 2 ภาษาอังกฤษ: ' + (spec.subjects ? spec.subjects.english.questions : '?') + ' ข้อ (บางแหล่งว่า 20 — ไม่ยืนยัน) / blueprint สนทนา ' + (spec.subjects ? spec.subjects.english.blueprint.conversation : '?') + ' : ศัพท์ ' + (spec.subjects ? spec.subjects.english.blueprint.vocabulary : '?') + ' : ไวยากรณ์ ' + (spec.subjects ? spec.subjects.english.blueprint.grammar : '?') + ' : อ่าน ' + (spec.subjects ? spec.subjects.english.blueprint.reading : '?') + '</li>' +
      '<li>วิชา 3 ข้าราชการที่ดี: ' + (spec.subjects ? spec.subjects.civil_knowledge.questions : '?') + ' ข้อ / blueprint 4 หมวดกฎหมาย (ค่าประมาณ)</li>' +
      '<li>การให้คะแนน: ' + (spec.scoring_per_question || 2) + ' คะแนน/ข้อ · เกณฑ์ผ่านคิดรายวิชา</li></ul></div>';

    document.getElementById('view').innerHTML = html;
    document.title = 'ตั้งค่า — ติว ก.พ. ภาค ก';

    document.getElementById('settings-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var level = document.querySelector('#settings-form input[name="level"]:checked').value;
      var minutes = parseInt(document.getElementById('exam-minutes').value, 10) || 180;
      var fontSize = parseInt(document.getElementById('font-size').value, 10) || 16;
      window.Store.saveSettings({ level: level, examMinutes: minutes, fontSize: fontSize });
      document.body.style.setProperty('--base-font-size', fontSize + 'px');
      App.toast('บันทึกแล้ว ✅');
    });
    document.getElementById('export-btn').addEventListener('click', function () {
      download('ocsc-progress.json', JSON.stringify(window.Store.exportAll(), null, 2));
    });
    document.getElementById('import-file').addEventListener('change', function (e) {
      var f = e.target.files[0];
      if (!f) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          window.Store.importAll(JSON.parse(reader.result));
          App.toast('นำเข้าข้อมูลแล้ว ✅ กำลังโหลดใหม่…');
          setTimeout(function () { location.reload(); }, 800);
        } catch (err) {
          App.toast('นำเข้าไม่สำเร็จ: ' + err.message);
        }
      };
      reader.readAsText(f);
    });
    document.getElementById('reset-btn').addEventListener('click', function () {
      if (window.confirm('ล้างความคืบหน้าทั้งหมด (อ่านแล้ว/ประวัติสอบ/สถิติ/SR)?')) {
        window.Store.resetAll();
        App.toast('ล้างข้อมูลแล้ว');
        setTimeout(function () { location.reload(); }, 600);
      }
    });
  }
  function levelOpt(value, label, current) {
    return '<label style="display:block;padding:.2rem .25rem;min-height:44px"><input type="radio" name="level" value="' + value + '"' + (value === current ? ' checked' : '') + '> ' + esc(label) + '</label>';
  }

  App.route('/settings', renderSettings);
})();
