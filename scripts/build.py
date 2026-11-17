#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
build.py — แปลง content/*.md + data/questions/*.json เป็น dist/ (ออฟไลน์ 100%)

เหตุผลที่ emit เป็น .js ไม่ใช้ fetch(): เว็บต้องเปิดจาก file:// (ดับเบิลคลิก index.html)
ซึ่ง fetch() ถูกบล็อก — จึงโหลดข้อมูลทั้งหมดผ่าน <script> tags ที่ build เป็นผู้เขียน

การใช้งาน:
    python scripts/build.py
"""
import json
import re
import shutil
import sys
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONTENT_DIR = ROOT / "content"
DATA_DIR = ROOT / "data"
QUESTIONS_DIR = DATA_DIR / "questions"
CONFIG_DIR = ROOT / "config"
ASSETS_SRC = ROOT / "assets-src"
DIST = ROOT / "dist"

WARN = []
def warn(msg):
    WARN.append(msg)
    print("  [เตือน]", msg)

# ---------------------------------------------------------------- frontmatter
def parse_frontmatter(text):
    """frontmatter แบบ 'key: value' อย่างง่าย (ไม่ใช้ YAML เพื่อให้ stdlib ล้วน)"""
    if not text.startswith("---"):
        return {}, text
    end = text.find("\n---", 3)
    if end == -1:
        return {}, text
    fm_text = text[3:end].strip("\n")
    body = text[end + 4:].lstrip("\n")
    fm = {}
    for line in fm_text.splitlines():
        line = line.rstrip()
        if not line.strip() or line.strip().startswith("#"):
            continue
        key, sep, value = line.partition(":")
        if not sep:
            warn(f"frontmatter: ข้ามบรรทัดที่ไม่ใช่ key: value -> {line[:60]!r}")
            continue
        value = value.strip().strip('"').strip("'")
        fm[key.strip()] = value
    return fm, body

# ---------------------------------------------------------------- inline md
def inline_md(text):
    """แปลง inline markdown — text ถูก escape แล้ว"""
    out = escape(text, quote=False)
    out = re.sub(r"`([^`]+)`", r"<code>\1</code>", out)
    out = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", out)
    out = re.sub(r"(?<!\*)\*([^*\n]+)\*(?!\*)", r"<em>\1</em>", out)
    out = re.sub(r"\[([^\]]+)\]\(([^)\s]+)\)", r'<a href="\2">\1</a>', out)
    return out

def strip_md(text):
    """ตัด HTML/markdown ออกเพื่อทำ search index"""
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"[`*#|>-]", " ", text)
    return re.sub(r"\s+", " ", text).strip()

# ---------------------------------------------------------------- block md
def md_to_html(md):
    blocks = re.split(r"\n\s*\n", md)
    out = []
    for block in blocks:
        block = block.rstrip("\n")
        if not block.strip():
            continue
        first = block.lstrip().splitlines()[0].strip()

        # โค้ดบล็อก
        if block.lstrip().startswith("```"):
            m = re.match(r"^```(\w*)\n(.*)\n?```$", block.lstrip(), re.S)
            if m:
                lang, code = m.group(1), m.group(2)
                cls = f' class="lang-{escape(lang)}"' if lang else ""
                out.append(f"<pre><code{cls}>{escape(code)}</code></pre>")
                continue
            warn("โค้ดบล็อกไม่ปิด ``` — ส่งออกเป็นพารากราฟแทน")

        # raw HTML (SVG, formula-box, cheat-sheet ฯลฯ) — ส่งผ่านโดยไม่ escape
        if first.startswith("<"):
            out.append(block)
            continue

        # หัวข้อ
        m = re.match(r"^(#{1,4})\s+(.*)$", first)
        if m and block.lstrip() == block:
            level = len(m.group(1))
            out.append(f"<h{level}>{inline_md(m.group(2).strip())}</h{level}>")
            continue

        # hr
        if re.match(r"^(-{3,}|\*{3,}|_{3,})$", first):
            out.append("<hr>")
            continue

        # ตาราง (pipe table)
        if first.startswith("|"):
            rows = [l for l in block.splitlines() if l.strip().startswith("|")]
            if len(rows) >= 2 and re.match(r"^\|[\s:|-]+\|$", rows[1].strip()):
                def cells(row):
                    row = row.strip().strip("|")
                    return [c.strip() for c in row.split("|")]
                head = cells(rows[0])
                body_rows = [cells(r) for r in rows[2:]]
                th = "".join(f"<th>{inline_md(c)}</th>" for c in head)
                trs = []
                for r in body_rows:
                    trs.append("<tr>" + "".join(f"<td>{inline_md(c)}</td>" for c in r) + "</tr>")
                out.append(f'<div class="table-wrap"><table><thead><tr>{th}</tr></thead><tbody>{"".join(trs)}</tbody></table></div>')
                continue
            warn("พบบล็อกขึ้นต้นด้วย '|' ที่ไม่ใช่ตาราง pipe ถูกต้อง — ส่งออกเป็นพารากราฟ")

        # blockquote
        if first.startswith(">"):
            inner = "\n".join(l[2:] if l.startswith("> ") else l.lstrip(">") for l in block.splitlines())
            out.append(f"<blockquote>{md_to_html(inner)}</blockquote>")
            continue

        # ลิสต์
        lines = block.splitlines()
        if re.match(r"^\s*([-*+]|\d+\.)\s+", lines[0]):
            def list_html(lines):
                # รองรับ nesting 1 ระดับ (ย่อหน้า 2 ช่องว่าง)
                root_ordered = bool(re.match(r"^\d+\.\s+", lines[0]))
                tag = "ol" if root_ordered else "ul"
                html_parts = [f"<{tag}>"]
                open_sub = False
                for l in lines:
                    sub = l.startswith("  ") or l.startswith("\t")
                    m2 = re.match(r"^\s*([-*+]|\d+\.)\s+(.*)$", l)
                    if not m2:
                        continue
                    item = inline_md(m2.group(2).strip())
                    if sub:
                        if not open_sub:
                            html_parts.append("<ul>")
                            open_sub = True
                        html_parts.append(f"<li>{item}</li>")
                    else:
                        if open_sub:
                            html_parts.append("</ul>")
                            open_sub = False
                        html_parts.append(f"<li>{item}</li>")
                if open_sub:
                    html_parts.append("</ul>")
                html_parts.append(f"</{tag}>")
                return "".join(html_parts)
            out.append(list_html(lines))
            continue

        # พารากราฟ
        out.append(f"<p>{inline_md(block)}</p>")
    return "\n".join(out)

# ---------------------------------------------------------------- build steps
def build_pages():
    pages, seen_slugs = [], {}
    for md_path in sorted(CONTENT_DIR.rglob("*.md")):
        text = md_path.read_text(encoding="utf-8")
        fm, body = parse_frontmatter(text)
        slug = fm.get("slug") or md_path.stem
        for key in ("title", "subject", "order"):
            if key not in fm:
                warn(f"{md_path.name}: ไม่มี frontmatter '{key}'")
        if slug in seen_slugs:
            raise SystemExit(f"slug ซ้ำกัน: {slug} ({md_path} และ {seen_slugs[slug]})")
        seen_slugs[slug] = md_path
        html_body = md_to_html(body)
        pages.append({
            "slug": slug,
            "title": fm.get("title", slug),
            "subject": fm.get("subject", "intro"),
            "order": int(fm.get("order", "999") or 999),
            "exam_topics": [t for t in fm.get("exam_topics", "").split(",") if t],
            "html": html_body,
            "text": strip_md(body),
        })
    pages.sort(key=lambda p: (p["subject"], p["order"]))
    return pages

def build_questions():
    bank, mock_sets = [], {}
    for qf in sorted(QUESTIONS_DIR.glob("*.json")):
        try:
            data = json.loads(qf.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            raise SystemExit(f"JSON พัง {qf.name}: {e}")
        if not isinstance(data, list):
            raise SystemExit(f"{qf.name}: ต้องเป็น array ของข้อสอบ")
        m = re.match(r"^mock-set-(\d+)\.json$", qf.name)
        if m:
            for q in data:
                q.setdefault("set_id", int(m.group(1)))
            mock_sets[int(m.group(1))] = data
        else:
            bank.extend(data)
    sets = [mock_sets[k] for k in sorted(mock_sets)]
    return bank, sets

def js_assign(var, value):
    return f"window.{var} = {json.dumps(value, ensure_ascii=False)};\n"

def external_url_scan(dist_dir):
    """fail ถ้าพบการอ้างทรัพยากรภายนอก (src/href/url()/@import) — ข้อความ URL เฉยๆ อนุญาตแต่รายงาน"""
    actionable = re.compile(r"(src|href|action|formaction)\s*=\s*[\"']?\s*https?:|url\(\s*['\"]?\s*https?:|@import\s*['\"]https?:", re.I)
    plain = re.compile(r"https?://[^\s\"'<>)]+")
    hits, plain_hits = [], 0
    for f in dist_dir.rglob("*"):
        if f.is_file():
            txt = f.read_text(encoding="utf-8", errors="ignore")
            for m in actionable.finditer(txt):
                line = txt[:m.start()].count("\n") + 1
                hits.append(f"{f.relative_to(dist_dir)}:{line}: {m.group(0)[:80]}")
            plain_hits += len(plain.findall(txt))
    return hits, plain_hits

def main():
    print("== build.py: เริ่มสร้าง dist/ ==")
    if DIST.exists():
        shutil.rmtree(DIST)
    (DIST / "content").mkdir(parents=True)
    (DIST / "assets").mkdir(parents=True)
    (DIST / "data").mkdir(parents=True)

    # 1) config (inline เป็น window.EXAM_SPEC)
    spec = json.loads((CONFIG_DIR / "exam-spec.json").read_text(encoding="utf-8"))
    (DIST / "assets" / "config.js").write_text(js_assign("EXAM_SPEC", spec), encoding="utf-8")

    # 2) เนื้อหา
    pages = build_pages()
    print(f"  หน้าเนื้อหา: {len(pages)} ไฟล์")
    manifest = [{k: p[k] for k in ("slug", "title", "subject", "order", "exam_topics")} for p in pages]
    (DIST / "content" / "manifest.js").write_text(js_assign("MANIFEST", manifest), encoding="utf-8")
    script_tags = ['<script src="content/manifest.js"></script>']
    for p in pages:
        payload = {k: p[k] for k in ("slug", "title", "subject", "order", "exam_topics", "html")}
        (DIST / "content" / f"{p['slug']}.js").write_text(
            f"window.PAGES = window.PAGES || []; window.PAGES.push({json.dumps(payload, ensure_ascii=False)});\n",
            encoding="utf-8")
        script_tags.append(f'<script src="content/{p["slug"]}.js"></script>')

    # search index
    search_index = [{"slug": p["slug"], "title": p["title"], "subject": p["subject"],
                     "text": p["text"][:4000]} for p in pages]
    (DIST / "assets" / "search-index.js").write_text(js_assign("SEARCH_INDEX", search_index), encoding="utf-8")

    # 3) คลังข้อสอบ
    bank, mock_sets = build_questions()
    print(f"  ข้อสอบแบบฝึก: {len(bank)} ข้อ | ชุดจำลอง: {len(mock_sets)} ชุด ({sum(len(s) for s in mock_sets)} ข้อ)")
    (DIST / "data" / "questions.js").write_text(
        js_assign("QUESTIONS", bank) + js_assign("MOCK_SETS", mock_sets), encoding="utf-8")

    flashcards_path = DATA_DIR / "flashcards.json"
    flashcards = json.loads(flashcards_path.read_text(encoding="utf-8")) if flashcards_path.exists() else []
    (DIST / "data" / "flashcards.js").write_text(js_assign("FLASHCARDS", flashcards), encoding="utf-8")

    # 4) copy static assets
    if ASSETS_SRC.exists():
        shutil.copytree(ASSETS_SRC, DIST / "assets-tmp", dirs_exist_ok=True)
        # assets-src ใช้โครงสร้าง css/ js/ ตรง ๆ
        for item in (DIST / "assets-tmp").iterdir():
            if item.name == "index.template.html":
                continue  # template ไม่ใช่ asset สำหรับ deploy
            dest = DIST / "assets" / item.name
            if dest.exists():
                shutil.rmtree(dest)
            shutil.move(str(item), str(dest))
        shutil.rmtree(DIST / "assets-tmp")

    # 5) index.html (จาก template + แทรก <script> tags)
    template = (ASSETS_SRC / "index.template.html").read_text(encoding="utf-8")
    all_scripts = (
        ['<script src="assets/config.js"></script>',
         '<script src="assets/search-index.js"></script>',
         '<script src="data/questions.js"></script>',
         '<script src="data/flashcards.js"></script>']
        + script_tags
        + ['<script src="assets/js/store.js"></script>',
           '<script src="assets/js/app.js"></script>',
           '<script src="assets/js/quiz.js"></script>',
           '<script src="assets/js/learn.js"></script>',
           '<script src="assets/js/practice.js"></script>',
           '<script src="assets/js/exam.js"></script>',
           '<script src="assets/js/review.js"></script>',
           '<script src="assets/js/dashboard.js"></script>',
           '<script src="assets/js/flashcards.js"></script>',
           '<script src="assets/js/settings.js"></script>']
    )
    html_out = template.replace("<!-- BUILD:SCRIPTS -->", "\n".join(all_scripts))
    (DIST / "index.html").write_text(html_out, encoding="utf-8")

    # 6) สแกน external URL
    hits, plain_hits = external_url_scan(DIST)
    if hits:
        print("\n!! พบทรัพยากรภายนอกที่ทำให้เกิด request — build ล้มเหลว:")
        for h in hits:
            print("   ", h)
        sys.exit(1)
    print(f"  สแกน external resource: ผ่าน (พบ URL ที่เป็นข้อความเฉย ๆ {plain_hits} จุด — ไม่ออก request)")

    total_bytes = sum(f.stat().st_size for f in DIST.rglob("*") if f.is_file())
    print(f"\n== เสร็จสิ้น: {DIST} ({total_bytes/1024:.0f} KB) ==")
    if WARN:
        print(f"== มีคำเตือน {len(WARN)} รายการ (ดูด้านบน) ==")

if __name__ == "__main__":
    main()
