/* store.js — ที่เก็บข้อมูลผู้ใช้ใน localStorage (ทุก read/write ครอบ try/catch) */
'use strict';
window.Store = (function () {
  var KEYS = {
    progress: 'ocsc_progress_v1',       // { slug: true }
    mockHistory: 'ocsc_mock_history_v1',// [result]
    mockSession: 'ocsc_mock_session_v1',// active exam session
    practiceStats: 'ocsc_practice_stats_v1', // { topic: {correct, total} }
    sr: 'ocsc_sr_v1',                   // { qid: {box, due} }
    bookmarks: 'ocsc_bookmarks_v1',     // { qid: true }
    settings: 'ocsc_settings_v1'        // { level, examMinutes, fontSize, theme }
  };

  function read(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { console.warn('store: เขียนไม่ได้ (โหมดส่วนตัว/เต็ม)', e); return false; }
  }
  function remove(key) { try { localStorage.removeItem(key); } catch (e) {} }

  function exportAll() {
    var payload = { app: 'ocsc-kpor-k', version: 1, exported_at: new Date().toISOString(), data: {} };
    Object.keys(KEYS).forEach(function (name) { payload.data[name] = read(KEYS[name], null); });
    return payload;
  }
  function importAll(payload) {
    if (!payload || payload.app !== 'ocsc-kpor-k' || typeof payload.data !== 'object') {
      throw new Error('ไฟล์ไม่ใช่ข้อมูลความคืบหน้าของเว็บนี้');
    }
    Object.keys(KEYS).forEach(function (name) {
      if (payload.data[name] !== undefined && payload.data[name] !== null) write(KEYS[name], payload.data[name]);
    });
  }
  function resetAll() {
    Object.keys(KEYS).forEach(function (name) { remove(KEYS[name]); });
  }

  // ---- progress / read tracking ----
  function isRead(slug) { return !!read(KEYS.progress, {})[slug]; }
  function setRead(slug, done) {
    var p = read(KEYS.progress, {});
    if (done) p[slug] = true; else delete p[slug];
    write(KEYS.progress, p);
  }
  function readCount() { return Object.keys(read(KEYS.progress, {})).length; }

  // ---- mock history ----
  function history() { return read(KEYS.mockHistory, []); }
  function addHistory(entry) { var h = history(); h.push(entry); write(KEYS.mockHistory, h); }

  // ---- practice stats ----
  function stats() { return read(KEYS.practiceStats, {}); }
  function bumpStat(topic, correct) {
    var s = stats();
    if (!s[topic]) s[topic] = { correct: 0, total: 0 };
    s[topic].total += 1;
    if (correct) s[topic].correct += 1;
    write(KEYS.practiceStats, s);
  }

  // ---- spaced repetition (Leitner) ----
  var SR_INTERVALS = [0, 1, 3, 7, 14, 30]; // กล่อง 0..5 → วัน
  function srAll() { return read(KEYS.sr, {}); }
  function srGrade(qid, remembered) {
    var s = srAll();
    var item = s[qid] || { box: 0, due: today() };
    if (remembered) item.box = Math.min(5, item.box + 1); else item.box = 0;
    item.due = addDays(today(), SR_INTERVALS[item.box]);
    s[qid] = item;
    write(KEYS.sr, s);
  }
  function srDueToday() {
    var s = srAll(), t = today(), out = [];
    Object.keys(s).forEach(function (qid) { if (s[qid].due <= t) out.push(qid); });
    return out;
  }
  function srEnqueue(qid) {
    var s = srAll();
    if (!s[qid]) { s[qid] = { box: 0, due: today() }; write(KEYS.sr, s); }
  }
  function today() { return new Date().toISOString().slice(0, 10); }
  function addDays(iso, days) { var d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); }

  // ---- bookmarks ----
  function bookmarks() { return read(KEYS.bookmarks, {}); }
  function toggleBookmark(qid) {
    var b = bookmarks();
    if (b[qid]) delete b[qid]; else b[qid] = true;
    write(KEYS.bookmarks, b);
    return !!b[qid];
  }
  function isBookmarked(qid) { return !!bookmarks()[qid]; }

  // ---- settings ----
  function settings() {
    var d = { level: 'bachelor', examMinutes: null, fontSize: 16, theme: null };
    var s = read(KEYS.settings, {});
    return Object.assign(d, s);
  }
  function saveSettings(patch) {
    var s = settings();
    Object.assign(s, patch);
    write(KEYS.settings, s);
    return s;
  }

  return {
    KEYS: KEYS, read: read, write: write, remove: remove,
    exportAll: exportAll, importAll: importAll, resetAll: resetAll,
    isRead: isRead, setRead: setRead, readCount: readCount,
    history: history, addHistory: addHistory,
    stats: stats, bumpStat: bumpStat,
    srAll: srAll, srGrade: srGrade, srDueToday: srDueToday, srEnqueue: srEnqueue,
    bookmarks: bookmarks, toggleBookmark: toggleBookmark, isBookmarked: isBookmarked,
    settings: settings, saveSettings: saveSettings
  };
})();
