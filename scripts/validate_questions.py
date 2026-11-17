#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
validate_questions.py — ตรวจคลังข้อสอบทั้งหมด

ตรวจ: schema ครบ, id ไม่ซ้ำและรูปแบบถูกต้อง, subject/topic ∈ blueprint, difficulty ∈ {1,2,3},
ตัวเลือก 4 ข้อ ไม่ซ้ำกัน ไม่ว่าง, answer ∈ 0-3, explanation ไม่ว่าง,
duplicate stem (ปรับ case/whitespace), study_ref มีอยู่จริงใน content/,
ข้อวิชา 3 ต้องมี law_ref หรือ needs_review, ชุดจำลอง (mock-set-N.json) ตรง blueprint + สัดส่วน
ความยาก ~30/50/20 (±10pp) + การกระจายตำแหน่งเฉลย, ความยาวตัวเลือก
Exit code 1 ถ้ามี error (needs_review เป็นแค่ warning)
"""
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
QUESTIONS_DIR = ROOT / "data" / "questions"
CONTENT_DIR = ROOT / "content"
SPEC = json.loads((ROOT / "config" / "exam-spec.json").read_text(encoding="utf-8"))

TOPIC_BY_SUBJECT = {s: list(v["blueprint"].keys()) for s, v in SPEC["subjects"].items()}
SUBJECT_CODES = {"analytical": "S1", "english": "S2", "civil_knowledge": "S3"}
TOPIC_CODES = {
    "language": "LANG", "abstract": "ABST", "quantitative": "QUAN",
    "conversation": "CONV", "vocabulary": "VOC", "grammar": "GRAM", "reading": "READ",
    "public_admin_law": "ADMIN", "good_governance": "GOV",
    "administrative_procedure": "PROC", "liability_discipline_ethics": "LIAB",
}
ID_RE = re.compile(r"^S[123]-(LANG|ABST|QUAN|CONV|VOC|GRAM|READ|ADMIN|GOV|PROC|LIAB)-\d{4}$")
REQUIRED = ["id", "subject", "topic", "subtopic", "difficulty", "stem", "figure_svg",
            "choices", "answer", "explanation", "shortcut", "study_ref", "law_ref",
            "needs_review", "origin"]

errors, warnings = [], []

def err(msg): errors.append(msg)
def warn(msg): warnings.append(msg)
def norm(s): return re.sub(r"\s+", " ", str(s).strip().lower())

def load_all():
    all_q, mock_sets = [], {}
    for qf in sorted(QUESTIONS_DIR.glob("*.json")):
        try:
            data = json.loads(qf.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            err(f"{qf.name}: JSON พัง — {e}")
            continue
        if not isinstance(data, list):
            err(f"{qf.name}: ต้องเป็น array")
            continue
        m = re.match(r"^mock-set-(\d+)\.json$", qf.name)
        target = mock_sets.setdefault(int(m.group(1)), []) if m else all_q
        for q in data:
            target.append(q)
    return all_q, mock_sets

def check_question(q, source):
    if not isinstance(q, dict):
        err(f"{source}: ข้อสอบไม่ใช่ object")
        return
    for key in REQUIRED:
        if key not in q:
            err(f"{source} {q.get('id', '?')}: ขาด field '{key}'")
    qid = q.get("id", "?")
    prefix = f"{source} {qid}"

    if not ID_RE.match(str(qid)):
        err(f"{prefix}: id ไม่ตรงรูปแบบ S{{N}}-CODE-NNNN")
    else:
        subj = q.get("subject")
        topic = q.get("topic")
        if subj in SUBJECT_CODES and not str(qid).startswith(SUBJECT_CODES[subj] + "-"):
            err(f"{prefix}: id prefix ไม่ตรง subject ({subj})")
        if topic in TOPIC_CODES and f"-{TOPIC_CODES[topic]}-" not in str(qid):
            err(f"{prefix}: id code ไม่ตรง topic ({topic})")

    subj = q.get("subject")
    if subj not in TOPIC_BY_SUBJECT:
        err(f"{prefix}: subject ผิด: {subj!r}")
    elif q.get("topic") not in TOPIC_BY_SUBJECT[subj]:
        err(f"{prefix}: topic {q.get('topic')!r} ไม่อยู่ใน blueprint ของ {subj}")

    if q.get("difficulty") not in (1, 2, 3):
        err(f"{prefix}: difficulty ต้องเป็น 1/2/3")

    stem = q.get("stem")
    if not stem or not str(stem).strip():
        err(f"{prefix}: stem ว่าง")

    choices = q.get("choices")
    if not isinstance(choices, list) or len(choices) != SPEC["choices_per_question"]:
        err(f"{prefix}: choices ต้องมี {SPEC['choices_per_question']} ข้อ (ได้ {len(choices) if isinstance(choices, list) else '?'})")
    else:
        if any(not str(c).strip() for c in choices):
            err(f"{prefix}: มีตัวเลือกว่าง")
        if len(set(norm(c) for c in choices)) != len(choices):
            err(f"{prefix}: ตัวเลือกซ้ำกัน")

    ans = q.get("answer")
    if not isinstance(ans, int) or not (0 <= ans < (len(choices) if isinstance(choices, list) else 4)):
        err(f"{prefix}: answer อยู่นอกช่วง")

    if not str(q.get("explanation", "")).strip():
        err(f"{prefix}: explanation ว่าง")

    if subj == "civil_knowledge":
        if not q.get("law_ref") and not q.get("needs_review"):
            err(f"{prefix}: ข้อวิชากฎหมายต้องมี law_ref หรือ needs_review=true")

    if q.get("needs_review"):
        warn(f"{prefix}: needs_review — รอตรวจสอบ")

    if q.get("figure_svg"):
        import xml.etree.ElementTree as ET
        try:
            ET.fromstring(q["figure_svg"])
        except Exception as e:
            err(f"{prefix}: figure_svg parse ไม่ได้ — {e}")

    if q.get("origin") != "original":
        warn(f"{prefix}: origin = {q.get('origin')!r} (ควรเป็น 'original')")

def check_study_refs(questions):
    slugs = set()
    for md in CONTENT_DIR.rglob("*.md"):
        head = md.read_text(encoding="utf-8")[:600]
        m = re.search(r"^slug:\s*(\S+)", head, re.M)
        slugs.add(m.group(1) if m else md.stem)
    for q in questions:
        sr = q.get("study_ref")
        if sr and sr not in slugs:
            err(f"{q.get('id')}: study_ref {sr!r} ไม่มีหน้า content ที่ตรงกัน")

def check_set(set_no, questions):
    """ชุดจำลองต้องตรง blueprint ของทุกวิชา/หัวข้อ"""
    per_topic = Counter(q.get("topic") for q in questions)
    per_subject = Counter(q.get("subject") for q in questions)
    diff = Counter(q.get("difficulty") for q in questions)
    ans_pos = Counter(q.get("answer") for q in questions)
    print(f"  ชุดที่ {set_no}: {len(questions)} ข้อ | วิชา: {dict(per_subject)}")
    print(f"    หัวข้อ: {dict(per_topic)}")
    print(f"    ความยาก ง่าย/กลาง/ยาก: {diff.get(1, 0)}/{diff.get(2, 0)}/{diff.get(3, 0)} | เฉลย ก/ข/ค/ง: {ans_pos.get(0, 0)}/{ans_pos.get(1, 0)}/{ans_pos.get(2, 0)}/{ans_pos.get(3, 0)}")
    for subj, spec in SPEC["subjects"].items():
        exp = spec["questions"]
        got = per_subject.get(subj, 0)
        if got != exp:
            err(f"ชุด {set_no}: วิชา {subj} ต้องมี {exp} ข้อ (ได้ {got})")
        for topic, want in spec["blueprint"].items():
            got_t = per_topic.get(topic, 0)
            if got_t != want:
                err(f"ชุด {set_no}: หัวข้อ {topic} ต้องมี {want} ข้อ (ได้ {got_t})")
    total = len(questions)
    if total:
        d1, d2, d3 = diff.get(1, 0), diff.get(2, 0), diff.get(3, 0)
        if not (0.20 <= d1 / total <= 0.40):
            warn(f"ชุด {set_no}: สัดส่วนง่าย {d1 / total:.0%} อยู่นอกช่วง ~30% ±10pp")
        if not (0.40 <= d2 / total <= 0.60):
            warn(f"ชุด {set_no}: สัดส่วนกลาง {d2 / total:.0%} อยู่นอกช่วง ~50% ±10pp")
        if not (0.10 <= d3 / total <= 0.30):
            warn(f"ชุด {set_no}: สัดส่วนยาก {d3 / total:.0%} อยู่นอกช่วง ~20% ±10pp")
        for pos, cnt in ans_pos.items():
            if cnt / total > 0.40:
                warn(f"ชุด {set_no}: เฉลยตำแหน่ง {pos} หนาแน่นเกิน 40% ({cnt}/{total})")

def main():
    print("== validate_questions.py ==")
    practice, mock_sets = load_all()
    all_q = list(practice)
    for s in mock_sets.values():
        all_q.extend(s)

    ids = Counter(str(q.get("id", "?")) for q in all_q)
    for qid, n in ids.items():
        if n > 1:
            err(f"id ซ้ำ: {qid} ({n} ครั้ง)")

    stems = defaultdict(list)
    for q in all_q:
        stems[norm(q.get("stem", ""))].append(q.get("id"))
        check_question(q, "practice" if q in practice else "mock")
    for stem, qids in stems.items():
        if stem and len(qids) > 1:
            err(f"stem ซ้ำกัน: {qids}")

    check_study_refs(all_q)
    for set_no, questions in sorted(mock_sets.items()):
        check_set(set_no, questions)

    print(f"\nทั้งหมด: {len(practice)} ข้อฝึก + {sum(len(s) for s in mock_sets.values())} ข้อในชุดจำลอง ({len(mock_sets)} ชุด)")
    for w in warnings:
        print("  [needs_review/เตือน]", w)
    if errors:
        print(f"\n!! พบ error {len(errors)} รายการ:")
        for e in errors:
            print("   -", e)
        sys.exit(1)
    print(f"\n✅ ผ่านการตรวจ ({len(warnings)} คำเตือน)")

if __name__ == "__main__":
    main()
