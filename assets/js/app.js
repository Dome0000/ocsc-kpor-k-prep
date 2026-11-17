/* app.js — router + sidebar + search + dark mode + toast */
'use strict';
window.App = (function () {
  var SUBJECT_META = {
    intro: { label: '🏁 บทนำ และการเตรียมสอบ', order: 0 },
    analytical: { label: '🧮 วิชา 1 ความสามารถในการคิดวิเคราะห์', order: 1 },
    english: { label: '🔤 วิชา 2 ภาษาอังกฤษ', order: 2 },
    civil_knowledge: { label: '🏛️ วิชา 3 ความรู้และลักษณะการเป็นข้าราชการที่ดี', order: 3 }
  };
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function toast(msg) {
    var t = $('#toast');
    if (!t) return;
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(t._tm);
    t._tm = setTimeout(function () { t.hidden = true; }, 2600);
  }

  // ---------- theme ----------
  function applyTheme(theme) {
    var t = theme || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', t);
  }
  function initTheme() {
    var s = window.Store.settings();
    if (s.theme) applyTheme(s.theme); else applyTheme(null);
    $('#theme-toggle').addEventListener('click', function () {
      var cur = document.documentElement.getAttribute('data-theme') || 'light';
      var next = cur === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      window.Store.saveSettings({ theme: next });
    });
  }

  // ---------- sidebar ----------
  function pagesBySubject() {
    var groups = {};
    (window.MANIFEST || []).forEach(function (p) {
      (groups[p.subject] = groups[p.subject] || []).push(p);
    });
    Object.keys(groups).forEach(function (k) {
      groups[k].sort(function (a, b) { return (a.order - b.order) || a.title.localeCompare(b.title, 'th'); });
    });
    return groups;
  }
  function totalPages() { return (window.MANIFEST || []).length; }

  function renderSidebar(activeSlug) {
    var nav = $('#sidebar-nav');
    var groups = pagesBySubject();
    var html = '';
    Object.keys(SUBJECT_META).sort(function (a, b) { return SUBJECT_META[a].order - SUBJECT_META[b].order; }).forEach(function (subj) {
      var pages = groups[subj] || [];
      if (!pages.length) return;
      html += '<div class="side-subject"><button aria-expanded="true">' + esc(SUBJECT_META[subj].label) +
              '<span aria-hidden="true">▾</span></button><ul class="side-list">';
      pages.forEach(function (p) {
        var done = window.Store.isRead(p.slug);
        html += '<li><a href="#/learn/' + esc(p.slug) + '"' + (p.slug === activeSlug ? ' class="active" aria-current="page"' : '') + '>' +
                '<span class="check" aria-hidden="true">' + (done ? '✓' : '·') + '</span>' +
                '<span>' + esc(p.title) + '</span></a></li>';
      });
      html += '</ul></div>';
    });
    nav.innerHTML = html;
    $$('.side-subject > button', nav).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var list = btn.nextElementSibling;
        var open = btn.getAttribute('aria-expanded') !== 'false';
        btn.setAttribute('aria-expanded', String(!open));
        list.style.display = open ? 'none' : '';
        btn.lastElementChild.textContent = open ? '▸' : '▾';
      });
    });
    updateProgress();
  }
  function updateProgress() {
    var total = totalPages();
    var done = window.Store.readCount();
    // นับเฉพาะหน้าที่มีอยู่จริง
    var slugs = {};
    (window.MANIFEST || []).forEach(function (p) { slugs[p.slug] = true; });
    var realDone = 0;
    try {
      var prog = window.Store.read(window.Store.KEYS.progress, {});
      Object.keys(prog).forEach(function (s) { if (slugs[s]) realDone++; });
    } catch (e) { realDone = done; }
    var pct = total ? Math.round((realDone / total) * 100) : 0;
    $('#progress-pct').textContent = pct + '%';
    $('#progress-bar').style.width = pct + '%';
    $('.progress-track').setAttribute('aria-valuenow', String(pct));
  }

  // ---------- search ----------
  function initSearch() {
    var input = $('#global-search');
    var list = $('#search-results');
    var idx = window.SEARCH_INDEX || [];
    var active = -1;

    function close() { list.hidden = true; active = -1; }
    function render(matches) {
      if (!matches.length) { list.innerHTML = '<li class="muted" style="padding:.4rem .7rem">ไม่พบผลการค้นหา</li>'; list.hidden = false; return; }
      list.innerHTML = matches.slice(0, 12).map(function (m, i) {
        return '<li role="option"><a href="#/learn/' + esc(m.slug) + '" data-i="' + i + '">' + esc(m.title) +
               '<small>' + esc(SUBJECT_META[m.subject] ? SUBJECT_META[m.subject].label.replace(/^\S+\s/, '') : m.subject) + '</small></a></li>';
      }).join('');
      list.hidden = false;
      $$('a', list).forEach(function (a) { a.addEventListener('click', close); });
    }
    function query(q) {
      q = q.trim().toLowerCase();
      if (q.length < 2) { close(); return; }
      var matches = [];
      for (var i = 0; i < idx.length; i++) {
        var hay = (idx[i].title + ' ' + idx[i].text).toLowerCase();
        if (hay.indexOf(q) !== -1) matches.push(idx[i]);
      }
      render(matches);
    }
    input.addEventListener('input', function () { query(input.value); });
    input.addEventListener('keydown', function (e) {
      var items = $$('a', list);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!items.length) return;
        active = (active + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        items.forEach(function (a, i) { a.setAttribute('aria-selected', String(i === active)); });
        items[active].focus();
      } else if (e.key === 'Escape') { close(); input.blur(); }
    });
    document.addEventListener('click', function (e) { if (!e.target.closest('.search-wrap')) close(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test((e.target.tagName || ''))) {
        e.preventDefault();
        input.focus();
      }
    });
  }

  // ---------- router ----------
  var routes = [];
  function route(pattern, handler) { routes.push({ pattern: pattern, handler: handler }); }
  function parseHash() {
    var raw = location.hash.replace(/^#/, '') || '/learn';
    var parts = raw.split('?');
    return { path: parts[0] || '/learn', query: new URLSearchParams(parts[1] || '') };
  }
  function navigate() {
    var r = parseHash();
    for (var i = 0; i < routes.length; i++) {
      var m = match(routes[i].pattern, r.path);
      if (m) {
        window.scrollTo(0, 0);
        routes[i].handler(m, r.query);
        closeMobileSidebar(false);
        return;
      }
    }
    showNotFound(r.path);
  }
  function match(pattern, path) {
    var pp = pattern.split('/'), qp = path.split('/');
    if (pp.length !== qp.length) return null;
    var params = {};
    for (var i = 0; i < pp.length; i++) {
      if (pp[i].charAt(0) === ':') params[pp[i].slice(1)] = decodeURIComponent(qp[i]);
      else if (pp[i] !== qp[i]) return null;
    }
    return params;
  }
  function showNotFound(path) {
    $('#view').innerHTML = '<div class="card"><h1>ไม่พบหน้า</h1><p>ไม่มีหน้า <code>' + esc(path) + '</code></p><p><a class="btn" href="#/learn">กลับหน้าบทเรียน</a></p></div>';
  }

  function openMobileSidebar() {
    var sb = $('#sidebar');
    sb.classList.add('open');
    document.body.classList.add('drawer-open');
    $('#menu-toggle').setAttribute('aria-expanded', 'true');
    var bd = $('#sidebar-backdrop'); if (bd) bd.hidden = false;
    var main = $('#main'); if (main) main.setAttribute('inert', '');
    var topbar = document.querySelector('.topbar'); if (topbar) topbar.setAttribute('inert', '');
    var close = $('#sidebar-close'); if (close) close.focus();
  }
  function closeMobileSidebar(restoreFocus) {
    var sb = $('#sidebar');
    if (!sb.classList.contains('open') && !document.body.classList.contains('drawer-open')) return;
    sb.classList.remove('open');
    document.body.classList.remove('drawer-open');
    $('#menu-toggle').setAttribute('aria-expanded', 'false');
    var bd = $('#sidebar-backdrop'); if (bd) bd.hidden = true;
    var main = $('#main'); if (main) main.removeAttribute('inert');
    var topbar = document.querySelector('.topbar'); if (topbar) topbar.removeAttribute('inert');
    if (restoreFocus !== false) { try { $('#menu-toggle').focus(); } catch (e) {} }
  }
  function initSidebarToggle() {
    var btn = $('#menu-toggle');
    btn.addEventListener('click', function () {
      if ($('#sidebar').classList.contains('open')) closeMobileSidebar();
      else openMobileSidebar();
    });
    var close = $('#sidebar-close');
    if (close) close.addEventListener('click', function () { closeMobileSidebar(); });
    var bd = $('#sidebar-backdrop');
    if (bd) bd.addEventListener('click', function () { closeMobileSidebar(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && $('#sidebar').classList.contains('open')) closeMobileSidebar();
    });
  }

  function init() {
    initTheme();
    initSidebarToggle();
    initSearch();
    var fs = window.Store.settings().fontSize;
    if (fs) document.body.style.setProperty('--base-font-size', fs + 'px');
    navigate(); // route โมดูลอื่นโหลดเสร็จแล้วตอน DOMContentLoaded (สคริปต์อยู่ท้าย body)
  }

  return {
    $: $, $$: $$, esc: esc, toast: toast,
    SUBJECT_META: SUBJECT_META,
    route: route, navigate: navigate, renderSidebar: renderSidebar, updateProgress: updateProgress,
    init: init
  };
})();
document.addEventListener('DOMContentLoaded', function () {
  window.App.init();
  window.addEventListener('hashchange', function () { window.App.navigate(); });
});
