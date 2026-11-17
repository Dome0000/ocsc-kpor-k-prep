# PROGRESS.md — สมุดบันทึกความคืบหน้า (อัปเดตทุกครั้งที่จบไฟล์/หัวข้อ)

> วิธีทำต่อใน session ใหม่: อ่าน PROMPT.md → PLAN.md → REVIEW.md → ไฟล์นี้ แล้วทำข้อแรกที่ยังไม่เสร็จ
> สถานะ: ✅ เสร็จ | 🟡 กำลังทำ | ⬜ ยังไม่เริ่ม | ⏸ พักไว้ (ระบุเหตุ)
> อัปเดตล่าสุด: 2026-11-17

## Phase 0 — ตรวจหลักสูตร
- ✅ 2026-11-16 พยายามตรวจแหล่งทางการทั้งหมด — ล้มเหลว (403/SSL/bot-wall) → exam-spec.json ตั้ง verified:false
- ✅ เขียน PLAN.md, REVIEW.md, PROGRESS.md

## Phase 1 — สถาปัตยกรรม
- ✅ โครงสร้างโฟลเดอร์ + scripts/build.py (MD→HTML, emit JS, external-URL scan)
- ✅ assets-src/css/style.css + js/{store,app,quiz,learn,practice,exam,review,dashboard,flashcards,settings}.js + index.template.html
- ✅ smoke test: build ผ่าน, file:// ทุก route โหลดได้, console errors = NONE (ผ่าน Playwright)

## Phase 2 — เอกสารเรียน (26/26 ไฟล์เสร็จ)
### บทนำ
- ✅ intro/00-exam-structure.md
### วิชา 1 เชิงภาษา (5/5)
- ✅ analytical-language-reading (01 + ฝึก 10) … analytical-language-conditions (05 + ฝึก 10)
### วิชา 1 เชิงนามธรรม (5/5)
- ✅ analytical-abstract-* (06–10 + ฝึก 50)
### วิชา 1 เชิงปริมาณ (5/5)
- ✅ analytical-quantitative-* (11–15 + ฝึก 50) — ตรวจคำนวณผ่าน check_math.py
### วิชา 2 ภาษาอังกฤษ (6/6) + แฟลชการ์ด
- ✅ english-conversation / english-vocabulary / english-grammar-1 / english-grammar-2 / english-reading / english-error-identification
- ✅ data/flashcards.json — 156 ใบ
- ✅ ฝึก S2: CONV/VOC/GRAM/READ หัวข้อละ 10 ข้อ (รวม 40)
### วิชา 3 ความรู้ข้าราชการ (4/4)
- ✅ civil-public-admin-law / civil-good-governance / civil-administrative-procedure / civil-liability-ethics — เนื้อหาทุกมาตรารอตรวจสอบ (badge ในหน้าเว็บ + needs_review)
- ✅ ฝึก S3: ADMIN/GOV/PROC/LIAB หัวข้อละ 10 ข้อ (รวม 40) — needs_review ทั้งหมดโดยจงใจ

## Phase 3 — คลังข้อสอบ (staged; คุณภาพมาก่อนปริมาณ)
- ✅ 230 ข้อฝึก (analytical 150 + english 40 + civil 40)
- ✅ **mock-set-1.json — 100 ข้อ ตาม blueprint พอดี** (วิเคราะห์ 15/15/20, อังกฤษ 5/5/7/8, ข้าราชการ 7/6/6/6) · ความยาก 27/52/21 · ตำแหน่งคำตอบ 24/23/27/26 · id ไม่ซ้ำ · stem ไม่ซ้ำกับฝึก (validate ผ่าน)
- ✅ scripts/math_checks.json — 130 sidecar (ทุกข้อคำนวณในชุดจำลอง + ฝึกปริมาณ) — check_math.py ผ่านทั้งหมด
- ⬜ mock-set-2.json — ยังไม่เริ่ม (โควตา/เวลา; ตามแผน ทำ set 1 ให้ถูก 100% ก่อน)
- ⬜ mock-set-3..5.json — ยังไม่เริ่ม

## Phase 4 — ฟีเจอร์เว็บ
- ✅ sidebar + ติ๊กอ่านจบ + progress % + ค้นหา (/)
- ✅ โหมดสอบจริงครบวงจร (เลือกระดับ, timer, navigator, ติดธง, keyboard 1–4/ก–ง/←→/F, autosave+resume, สรุปผลรายวิชา/หัวข้อ, กรองเฉพาะผิด/ติดธง) — ทดสอบผ่าน Playwright
- ✅ practice mode (instant feedback + เลือกหัวข้อ/ความยาก)
- ✅ review mode (Leitner SR กล่อง 0–5)
- ✅ dashboard (SVG trend chart + weakest topic → คำแนะนำบท)
- ✅ flashcards (156 ใบ, กรองหมวด)
- ✅ settings (level/timer/font size/export-import-reset/banner verified:false)
- ✅ dark mode, print CSS, a11y (skip-link, aria, focus-visible)

## Phase 5 — QA
- ✅ validate_questions.py ผ่าน — 330 ข้อ (230 ฝึก + 100 ชุดจำลอง), ไม่มี error, 65 คำเตือน (needs_review วิชา 3 จงใจติด)
- ✅ check_math.py ผ่าน — 130 ข้อคำนวณตรงคำตอบ (S1-QUAN-0045 แก้ sidecar แล้ว)
- ✅ playwright_smoke.py ผ่าน 23/23 — file:// ครบวงจร (ทุก view, start→answer→flag→reload→resume→submit→result), ไม่มี console/page error, ไม่มี external request
- ⬜ ไล่ทำข้อทั่วไปแบบ blind ทั้ง 330 ข้อ — ทำเฉพาะจุดเสี่ยงที่พบระหว่างเขียน (แก้แล้ว: LANG-0060, VOC-0004/0010/0013, ABST-0054/0056/0058, READ-0013, civil ambiguity ×3, duplicate stems ×2) — **ยังไม่ได้ไล่ทั้งหมดแบบ blind**
- ✅ README.md (เปิดใช้/build/เพิ่มข้อสอบ/ข้อจำกัด)
- ✅ REVIEW.md ปรับปรุง (65 รายการ needs_review — ดู §B)

## ตัวเลขที่นับจริง (2026-11-17)
- ข้อสอบทั้งหมด: **330 ข้อ** (ฝึก 230 + ชุดจำลอง 100) · validate ผ่าน 330 · คำนวณซ้ำผ่าน 130/130
- ความยาก ง่าย 90 / กลาง 152 / ยาก 88 · วิชา: analytical 200, english 65, civil_knowledge 65
- เนื้อหาบทเรียน: 26/26 ไฟล์ · dist/index.html ทำงานได้ file:// โดยไม่มี server

## สิ่งที่ยังไม่เสร็จ (เรียงตามลำดับ)
1. mock-set-2.json (+3..5 ตามโควตา) — ต้องเขียนใหม่ทั้งชุด + ตรวจ math ครบก่อนปล่อย
2. ไล่ blind re-solve ข้อทั่วไปทั้งหมด (เหลือประมาณ 200 ข้อที่ไม่ใช่ตัวเลข)
3. ตรวจเลขมาตรากฎหมายทั้งหมดกับ krisdika.go.th/ราชกิจจาฯ (เข้าถึงไม่ได้ในสภาพแวดล้อมนี้)
4. ยืนยันสเปกข้อสอบกับประกาศสำนักงาน ก.พ. ล่าสุด (จำนวนข้อ/เวลาสอบ/เกณฑ์ผ่าน/blueprint) แล้วทำเครื่องหมาย verified:true ใน exam-spec.json
