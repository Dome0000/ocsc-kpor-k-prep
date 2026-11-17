#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""playwright_smoke.py — ทดสอบ dist/index.html แบบ file:// ผ่าน Playwright/Chromium

ตรวจ: console errors, การโหลดทุก view, โหมดสอบจริงครบวงจร (start → answer → flag → reload → resume → submit → result)
ออก 1 ถ้าพบข้อผิดพลาด · ไม่ต้องมี server (file:// เท่านั้น) · ห้ามมี request ออกภายนอก
"""
import sys
import io
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
INDEX = (ROOT / "dist" / "index.html").as_uri()

console_errors, page_errors, external_requests = [], [], []
failures = []


def check(name, ok, detail=""):
    tag = "✅" if ok else "❌"
    print(f"  {tag} {name}" + (f" — {detail}" if detail and not ok else ""))
    if not ok:
        failures.append(f"{name}: {detail}")


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        context = browser.new_context()
        page = context.new_page()
        page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: page_errors.append(str(e)))
        page.on("dialog", lambda d: d.accept())
        page.on("request", lambda r: external_requests.append(r.url) if r.url.startswith(("http://", "https://")) else None)

        page.goto(INDEX, wait_until="load")
        page.wait_for_timeout(600)

        print("== โหลดหน้าแรก (file://) ==")
        check("title มีข้อความ ก.พ.", "ก.พ" in page.title(), page.title())
        check("sidebar แสดง progress 0%", "0%" in (page.text_content("#progress-pct") or ""))
        check("sidebar มีลิงก์ ข้อสอบจำลอง", page.query_selector('a[href="#/mock"]') is not None)

        for route, marker in [("#/learn", "บทเรียน"), ("#/practice", "ฝึก"), ("#/flashcards", "แฟลชการ์ด"),
                              ("#/dashboard", "แดชบอร์ด"), ("#/settings", "ตั้งค่า"), ("#/review", "ทบทวน"), ("#/mock", "Mock")]:
            page.goto(f"{INDEX}{route}", wait_until="load")
            page.wait_for_timeout(500)
            text = page.text_content("#view") or ""
            check(f"view {route} เรนเดอร์", len(text.strip()) > 30, f"เนื้อหาสั้นเกินไป: {text[:80]!r}")

        print("== โหมดสอบจริง: start → answer → flag ==")
        page.goto(f"{INDEX}#/mock", wait_until="load")
        page.wait_for_timeout(500)
        body = page.text_content("#view") or ""
        check("มีชุดข้อสอบจำลองอย่างน้อย 1 ชุด", "ชุดที่ 1" in body)
        page.click(".start-set[data-set='0']")
        page.wait_for_timeout(600)
        check("เข้าข้อสอบหน้าจอ session", page.url.endswith("#/mock/session"), page.url)
        check("มีปุ่มส่งข้อสอบ", page.query_selector("#submit-exam") is not None)
        check("มีตัวเลือก 4 ข้อ", len(page.query_selector_all("#exam-choices .choice")) == 4)

        page.click("#exam-choice-1")
        page.wait_for_timeout(200)
        check("ตอบข้อ 1 ได้", "selected" in (page.get_attribute("#exam-choice-1", "class") or ""))
        page.click("#flag-btn")
        page.wait_for_timeout(200)
        check("ติดธงได้", "ติดธงแล้ว" in (page.text_content("#flag-btn") or ""))
        page.click("#next-q")
        page.wait_for_timeout(200)
        page.click("#exam-choice-2")
        page.wait_for_timeout(200)

        print("== reload → autosave resume ==")
        page.reload(wait_until="load")
        page.wait_for_timeout(600)
        check("กลับเข้า session เดิมหลัง reload", page.url.endswith("#/mock/session"), page.url)
        answered = page.text_content(".lesson-actions .muted") or ""
        check("autosave กู้คำตอบไว้", "2" in answered, answered)
        page.click("#exam-nav button[data-i='0']")
        page.wait_for_timeout(300)
        check("ติดธงยังอยู่", "ติดธงแล้ว" in (page.text_content("#flag-btn") or ""))
        page.click("#exam-nav button[data-i='1']")
        page.wait_for_timeout(200)

        print("== แบนเนอร์ทำต่อ ที่หน้าเลือกชุด ==")
        page.goto(f"{INDEX}#/mock", wait_until="load")
        page.wait_for_timeout(400)
        body = page.text_content("#view") or ""
        check("มีแบนเนอร์ทำต่อจากที่ค้างไว้", "ทำต่อจากที่ค้างไว้" in body)
        if page.query_selector("#resume-btn"):
            page.click("#resume-btn")
            page.wait_for_timeout(500)
            check("กด resume → เข้า session", page.url.endswith("#/mock/session"))
        else:
            check("มีปุ่ม resume", False, "ไม่พบ #resume-btn")
            page.goto(f"{INDEX}#/mock/session", wait_until="load")

        print("== submit → หน้าผล ==")
        page.click("#submit-exam")
        page.wait_for_timeout(800)
        url = page.url
        check("ไปหน้า result", "#/mock/result/" in url, url)
        body = page.text_content("#view") or ""
        check("แสดงผลคะแนน", any(k in body for k in ("คะแนน", "ผ่าน", "ไม่ผ่าน")), body[:120])

        print("== console / network (desktop) ==")
        check("ไม่มี console error", not console_errors, "; ".join(console_errors[:3]))
        check("ไม่มี page error", not page_errors, "; ".join(page_errors[:3]))
        check("ไม่มี request ออกภายนอก", not external_requests, "; ".join(external_requests[:3]))

        context.close()

        # ============ มือถือ 360×740 ============
        console_errors.clear()
        page_errors.clear()
        mobile = browser.new_context(viewport={"width": 360, "height": 740}, is_mobile=True, has_touch=True)
        m = mobile.new_page()
        m.on("console", lambda x: console_errors.append(x.text) if x.type == "error" else None)
        m.on("pageerror", lambda e: page_errors.append(str(e)))
        m.on("dialog", lambda d: d.accept())

        print("== [มือถือ] หน้าแรก + horizontal scroll ==")
        m.goto(INDEX, wait_until="load")
        m.wait_for_timeout(600)
        scroll_w = m.evaluate("() => document.documentElement.scrollWidth")
        inner_w = m.evaluate("() => window.innerWidth")
        check("ไม่มี horizontal scroll", scroll_w <= inner_w, f"scrollWidth={scroll_w} > innerWidth={inner_w}")

        print("== [มือถือ] drawer เปิด/ปิด/Escape/backdrop ==")
        check("ปุ่มเมนูแสดงบนมือถือ", m.query_selector("#menu-toggle") is not None and m.is_visible("#menu-toggle"))
        m.click("#menu-toggle")
        m.wait_for_timeout(400)
        check("drawer เปิด (.open)", "open" in (m.get_attribute("#sidebar", "class") or ""))
        check("body ล็อก scroll (drawer-open)", "drawer-open" in (m.get_attribute("body", "class") or ""))
        check("backdrop แสดง", m.is_visible("#sidebar-backdrop"))
        check("ปุ่มปิดใน drawer มองเห็น", m.is_visible("#sidebar-close"))
        m.keyboard.press("Escape")
        m.wait_for_timeout(300)
        check("Escape ปิด drawer", "open" not in (m.get_attribute("#sidebar", "class") or ""))
        m.click("#menu-toggle")
        m.wait_for_timeout(300)
        m.mouse.click(352, 300)  # แถบ backdrop ด้านขวาสุด (นอกเขต drawer)
        m.wait_for_timeout(300)
        check("คลิก backdrop ปิด drawer", "open" not in (m.get_attribute("#sidebar", "class") or ""))
        m.click("#menu-toggle")
        m.wait_for_timeout(300)
        m.click("#sidebar-close")
        m.wait_for_timeout(300)
        check("ปุ่ม ✕ ปิด drawer", "open" not in (m.get_attribute("#sidebar", "class") or ""))

        print("== [มือถือ] mock flow + ไม่มี horizontal scroll ทุก view หลัก ==")
        for route in ["#/learn", "#/practice", "#/mock", "#/dashboard", "#/settings", "#/flashcards"]:
            m.goto(f"{INDEX}{route}", wait_until="load")
            m.wait_for_timeout(400)
            sw = m.evaluate("() => document.documentElement.scrollWidth")
            iw = m.evaluate("() => window.innerWidth")
            check(f"{route} ไม่ล้นจอ", sw <= iw, f"scrollWidth={sw}")
        m.goto(f"{INDEX}#/mock", wait_until="load")
        m.wait_for_timeout(400)
        m.click(".start-set[data-set='0']")
        m.wait_for_timeout(600)
        check("[มือถือ] เริ่มสอบได้", m.url.endswith("#/mock/session"))
        m.click("#exam-choice-0")
        m.wait_for_timeout(200)
        m.click("#next-q")
        m.wait_for_timeout(200)
        m.click("#exam-choice-3")
        m.wait_for_timeout(200)
        sw = m.evaluate("() => document.documentElement.scrollWidth")
        iw = m.evaluate("() => window.innerWidth")
        check("[มือถือ] หน้าทำข้อสอบไม่ล้นจอ", sw <= iw, f"scrollWidth={sw}")
        m.click("#submit-exam")
        m.wait_for_timeout(800)
        check("[มือถือ] submit → หน้า result", "#/mock/result/" in m.url, m.url)

        print("== [มือถือ] console / network ==")
        check("[มือถือ] ไม่มี console error", not console_errors, "; ".join(console_errors[:3]))
        check("[มือถือ] ไม่มี page error", not page_errors, "; ".join(page_errors[:3]))

        mobile.close()
        browser.close()

    print()
    if failures:
        print(f"❌ ไม่ผ่าน {len(failures)} จุด:")
        for f in failures:
            print("   -", f)
        sys.exit(1)
    print("✅ smoke test ผ่านทุกจุด")


if __name__ == "__main__":
    main()
