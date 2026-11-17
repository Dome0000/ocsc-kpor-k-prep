/* dashboard.js — ประวัติสอบ + กราฟแนวโน้ม SVG + หัวข้ออ่อนที่สุด */
'use strict';
(function () {
  var App = window.App;
  var esc = App.esc;
  var Quiz = window.Quiz;

  function renderDashboard() {
    App.renderSidebar(null);
    var history = window.Store.history().slice().sort(function (a, b) { return new Date(a.date) - new Date(b.date); });
    var stats = window.Store.stats();

    var html = '<div class="card"><h1>📊 แดชบอร์ดพัฒนาการ</h1>';
    if (!history.length) {
      html += '<p class="muted">ยังไม่มีประวัติการสอบ — ลองทำ <a href="#/mock">ข้อสอบจำลอง</a> ชุดแรกเพื่อดูพัฒนาการของคุณ</p></div>';
      document.getElementById('view').innerHTML = html;
      return;
    }
    var last = history[history.length - 1];
    var best = history.reduce(function (m, r) { return Math.max(m, r.total_score); }, 0);
    var avg = Math.round(history.reduce(function (s, r) { return s + r.total_score; }, 0) / history.length);
    html += '<div class="stat-grid">' +
      '<div class="stat-tile"><div class="num">' + history.length + '</div><div class="muted">ครั้งที่สอบ</div></div>' +
      '<div class="stat-tile"><div class="num">' + last.total_score + '</div><div class="muted">คะแนนล่าสุด</div></div>' +
      '<div class="stat-tile"><div class="num">' + best + '</div><div class="muted">สูงสุด</div></div>' +
      '<div class="stat-tile"><div class="num">' + avg + '</div><div class="muted">เฉลี่ย</div></div>' +
    '</div></div>';

    // กราฟแนวโน้มคะแนนรวม (SVG วาดเอง)
    html += '<div class="card chart-box"><h2>แนวโน้มคะแนนรวม</h2>' + trendChart(history) + '</div>';

    // หัวข้ออ่อนที่สุด (จากสถิติฝึก — ต้องมี ≥5 ครั้ง)
    var weak = Object.keys(stats).map(function (t) {
      return { topic: t, correct: stats[t].correct, total: stats[t].total, pct: stats[t].total ? stats[t].correct / stats[t].total : 1 };
    }).filter(function (s) { return s.total >= 5; }).sort(function (a, b) { return a.pct - b.pct; });
    html += '<div class="card"><h2>จุดอ่อนของคุณ (จากการฝึก ≥ 5 ครั้ง/หัวข้อ)</h2>';
    if (!weak.length) {
      html += '<p class="muted">ยังไม่มีข้อมูลพอ — ฝึกหัวข้อละอย่างน้อย 5 ข้อก่อน</p>';
    } else {
      weak.slice(0, 5).forEach(function (w) {
        var pct = Math.round(w.pct * 100);
        html += '<div class="topic-bar"><span>' + esc(Quiz.topicName(w.topic)) + '</span><div class="track"><div class="fill" style="width:' + pct + '%;background:' + (pct < 60 ? 'var(--bad)' : 'var(--primary)') + '"></div></div><span>' + pct + '% (' + w.correct + '/' + w.total + ')</span></div>';
      });
      var weakest = weak[0];
      html += '<p style="margin-top:.5rem">💡 แนะนำ: อ่านซ้ำบทของหัวข้อ <strong>' + esc(Quiz.topicName(weakest.topic)) + '</strong> แล้วฝึกซ้ำจนถึง 80% — <a class="btn small secondary" href="#/practice?topic=' + encodeURIComponent(weakest.topic) + '">ฝึกหัวข้อนี้เลย</a></p>';
    }
    html += '</div>';

    // ประวัติการสอบ
    html += '<div class="card"><h2>ประวัติการสอบ</h2><div class="table-wrap"><table><thead><tr><th>วันที่</th><th>ชุด</th><th>ระดับ</th><th>คะแนน</th><th>ผลรายวิชา</th><th></th></tr></thead><tbody>';
    history.slice().reverse().forEach(function (r) {
      var perSubject = Object.keys(r.per_subject || {}).map(function (s) {
        var x = r.per_subject[s];
        return (x.passed ? '✓' : '✗') + ' ' + Quiz.subjectName(s).replace('วิชา ', 'ว.') + ' ' + x.pct + '%';
      }).join('<br>');
      html += '<tr><td>' + new Date(r.date).toLocaleDateString('th-TH') + '</td><td>ชุดที่ ' + r.set_id + '</td><td>' + esc(levelLabel(r.level)) + '</td><td>' + r.total_score + ' / ' + r.max_score + '</td><td>' + perSubject + '</td><td><a href="#/mock/result/' + esc(r.id) + '">ดูเฉลย</a></td></tr>';
    });
    html += '</tbody></table></div></div>';

    document.getElementById('view').innerHTML = html;
    document.title = 'แดชบอร์ด — ติว ก.พ. ภาค ก';
  }

  function levelLabel(l) {
    return { below_bachelor: 'ต่ำกว่า ป.ตรี', bachelor: 'ป.ตรี', master: 'ป.โท' }[l] || l;
  }

  function trendChart(history) {
    var W = 720, H = 240, padL = 46, padR = 12, padT = 14, padB = 34;
    var maxScore = Math.max.apply(null, history.map(function (r) { return r.max_score || 200; }).concat([200]));
    var iw = W - padL - padR, ih = H - padT - padB;
    var n = history.length;
    var pts = history.map(function (r, i) {
      var x = padL + (n === 1 ? iw / 2 : (i / (n - 1)) * iw);
      var y = padT + ih - (r.total_score / maxScore) * ih;
      return { x: x, y: y, r: r };
    });
    var path = pts.map(function (p, i) { return (i ? 'L' : 'M') + p.x.toFixed(1) + ' ' + p.y.toFixed(1); }).join(' ');
    var passLine = padT + ih - (0.6 * maxScore); // เส้นอ้างอิง 60%
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="กราฟเส้นแนวโน้มคะแนนรวมแต่ละครั้งที่สอบ">';
    svg += '<line x1="' + padL + '" y1="' + padT + '" x2="' + padL + '" y2="' + (padT + ih) + '" stroke="currentColor" stroke-opacity=".35"/>';
    svg += '<line x1="' + padL + '" y1="' + (padT + ih) + '" x2="' + (W - padR) + '" y2="' + (padT + ih) + '" stroke="currentColor" stroke-opacity=".35"/>';
    svg += '<line x1="' + padL + '" y1="' + passLine.toFixed(1) + '" x2="' + (W - padR) + '" y2="' + passLine.toFixed(1) + '" stroke="var(--bad)" stroke-dasharray="5 4" stroke-opacity=".7"/>';
    svg += '<text x="' + (padL - 6) + '" y="' + (passLine + 4).toFixed(1) + '" text-anchor="end" font-size="16" fill="var(--bad)">60%</text>';
    svg += '<text x="' + (padL - 6) + '" y="' + (padT + 10) + '" text-anchor="end" font-size="16" fill="currentColor" fill-opacity=".6">' + maxScore + '</text>';
    svg += '<text x="' + (padL - 6) + '" y="' + (padT + ih + 4) + '" text-anchor="end" font-size="16" fill="currentColor" fill-opacity=".6">0</text>';
    svg += '<path d="' + path + '" fill="none" stroke="var(--primary)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>';
    pts.forEach(function (p, i) {
      svg += '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="4.5" fill="var(--primary)"><title>ครั้งที่ ' + (i + 1) + ': ' + p.r.total_score + ' คะแนน (' + new Date(p.r.date).toLocaleDateString('th-TH') + ')</title></circle>';
      svg += '<text x="' + p.x.toFixed(1) + '" y="' + (H - 12) + '" text-anchor="middle" font-size="16" fill="currentColor" fill-opacity=".65">' + (i + 1) + '</text>';
    });
    svg += '</svg><p class="muted" style="font-size:.9375rem">แกน X = ครั้งที่สอบ · แกน Y = คะแนนรวม · เส้นประแดง = 60% ของคะแนนเต็ม (ค่าอ้างอิง ยังไม่ยืนยันเกณฑ์ทางการ)</p>';
    return svg;
  }

  App.route('/dashboard', renderDashboard);
})();
