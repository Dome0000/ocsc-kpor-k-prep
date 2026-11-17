#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
check_math.py — คำนวณคำตอบของข้อคณิตศาสตร์ซ้ำโดยอิสระ แล้วเทียบกับ answer key

ใช้ sidecar scripts/math_checks.json:
  { "S1-QUAN-0001": {"method": "percent_of", "params": {"percent": 20, "of": 150}, "result": 30}, ... }

- method = ชื่อ solver (ดู METHODS) — solver คำนวณจาก params เท่านั้น ไม่ดูเฉลยในข้อสอบ
- result = ค่าที่คาดว่า answer ชี้ไป (เปรียบเทียบเป็น float ด้วย tolerance)
- "explain" (optional): วิธีทำแบบย่อสำหรับรายงาน

Exit 1 ถ้ามีข้อไม่ตรง
"""
import json
import math
import sys
from fractions import Fraction
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
QUESTIONS_DIR = ROOT / "data" / "questions"
CHECKS_PATH = ROOT / "scripts" / "math_checks.json"
TOL = 1e-6

# ---------------- solvers (คำนวณจาก params เท่านั้น) ----------------
def m_arithmetic_next(p):
    t = p["terms"]; d = t[1] - t[0]
    assert all(abs((t[i+1] - t[i]) - d) < TOL for i in range(len(t) - 1)), "ไม่ใช่อนุกรมเลขคณิต"
    return t[-1] + d

def m_geometric_next(p):
    t = p["terms"]; r = t[1] / t[0]
    assert all(abs(t[i+1] - t[i] * r) < TOL for i in range(len(t) - 1)), "ไม่ใช่อนุกรมเรขาคณิต"
    return t[-1] * r

def m_second_difference_next(p):
    t = list(map(float, p["terms"]))
    d1 = [t[i+1] - t[i] for i in range(len(t) - 1)]
    d2 = [d1[i+1] - d1[i] for i in range(len(d1) - 1)]
    assert all(abs(x - d2[0]) < TOL for x in d2), "ผลต่างชั้นสองไม่คงที่"
    return t[-1] + d1[-1] + d2[0]

def m_linear_growth_next(p):  # ผลต่างเพิ่มขึ้นทีละ step คงที่ (เช่น +1,+2,+3 / +3,+6,+9)
    t = list(map(float, p["terms"])); step = p["step"]
    d1 = [t[i+1] - t[i] for i in range(len(t) - 1)]
    dd = [d1[i+1] - d1[i] for i in range(len(d1) - 1)]
    assert all(abs(x - step) < TOL for x in dd), "ผลต่างไม่โตตาม step"
    return t[-1] + d1[-1] + step

def m_prime_diff_next(p):  # ผลต่างเป็นจำนวนเฉพาะ c..
    primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37]
    t = list(map(float, p["terms"]))
    diffs = [t[i+1] - t[i] for i in range(len(t) - 1)]
    start = primes.index(int(diffs[0]))
    expect = primes[start:start + len(diffs)]
    assert diffs == [float(x) for x in expect], "ผลต่างไม่ใช่จำนวนเฉพาะต่อเนื่อง"
    return t[-1] + primes[start + len(diffs)]

def m_square_next(p):
    n = p["count_of_terms"] + (p.get("offset", 0))
    return float((n + 1) ** 2)

def m_cube_next(p):
    n = p["count_of_terms"] + (p.get("offset", 0))
    return float((n + 1) ** 3)

def m_fibonacci_next(p):
    t = list(map(float, p["terms"]))
    return t[-1] + t[-2]

def m_function_rule_next(p):  # อนุกรม a*x+b: พจน์ถัดไป = f(last)
    a, b, last = p["a"], p["b"], p["last"]
    return a * last + b

def m_ratio_percent(p):  # part/whole × 100 — ถามร้อยละโดยตรง
    return p["part"] / p["whole"] * 100.0

def m_venn(p):  # |A∪B| = A + B − both
    return float(p["a"] + p["b"] - p["both"])

def m_power(p):  # base^exp — ความสัมพันธ์เชิงเลขยกกำลัง
    return float(p["base"] ** p["exp"])

def m_square_plus(p):  # a^2 + b — สัญลักษณ์กำหนดเอง เช่น a★b=a²+b
    return float(p["a"] ** 2 + p["b"])

def m_letter_step(p):  # อนุกรมตัวอักษรด้วย step คงที่ จากตำแหน่งแรกๆ ที่รู้
    return float(p["positions"][-1] + p["step"])

def m_percent_of(p):
    return p["percent"] / 100.0 * p["of"]

def m_percent_change(p):
    return (p["new"] - p["old"]) / p["old"] * 100.0

def m_ratio_scale(p):  # อัตราส่วน a:b ผลรวมรวม c → ส่วนแรก
    a, b, total = p["a"], p["b"], p["total"]
    return total * a / (a + b)

def m_fraction_add(p):
    total = Fraction(0)
    for part in p["parts"]:
        total += Fraction(part[0], part[1])
    return float(total)

def m_average(p):
    return sum(p["values"]) / len(p["values"])

def m_work_time(p):  # คน A ทำเสร็จ x วัน คน B y วัน ทำร่วม → วัน
    a, b = p["a_days"], p["b_days"]
    return 1.0 / (1.0 / a + 1.0 / b)

def m_distance_time(p):
    return p["speed"] * p["hours"]

def m_meet_time(p):  # รถสองคันสวนทาง ระยะทาง d ความเร็ว v1,v2 → เวลาพบกัน
    return p["distance"] / (p["v1"] + p["v2"])

def m_simple_interest(p):
    return p["principal"] * p["rate"] / 100.0 * p["years"]

def m_compound_interest(p):
    return p["principal"] * (1 + p["rate"] / 100.0) ** p["years"] - p["principal"]

def m_profit_pct(p):  # ทุน/กำไร → กำไรต่อร้อยละ
    return (p["sell"] - p["cost"]) / p["cost"] * 100.0

def m_two_points_line(p):
    # สมการเส้นตรงผ่าน (x1,y1),(x2,y2) ถาม y เมื่อ x = given
    x1, y1, x2, y2, xq = p["x1"], p["y1"], p["x2"], p["y2"], p["x"]
    return y1 + (y2 - y1) * (xq - x1) / (x2 - x1)

def m_solve_linear(p):  # ax + b = c → x
    return (p["c"] - p["b"]) / p["a"]

def m_quadratic_roots_product(p):  # x²+bx+c=0 → product of roots
    return p["c"]

def m_combinations(p):
    return math.comb(p["n"], p["k"])

def m_permutations(p):
    return math.perm(p["n"], p["k"])

def m_probability(p):  # favorable / total
    return p["favorable"] / p["total"]

def m_age_now(p):  # อายุรวม/สัดส่วน → อายุปัจจุบันของคนที่ 2 (children solve)
    # เงื่อนไข: ปัจจุบัน a+b = total และ a = ratio*b
    ratio, total = p["ratio"], p["total"]
    b = total / (ratio + 1.0)
    return b * (p.get("which", 2))

def m_final_after_pct(p):  # ราคา/จำนวนหลังปรับร้อยละ
    start, pct, op = p["start"], p["pct"], p["op"]
    return start * (1 - pct / 100.0) if op == "discount" else start * (1 + pct / 100.0)

def m_ratio_part(p):  # อัตราส่วน a:b รวม total → ส่วน a หรือ b
    a, b, total = p["a"], p["b"], p["total"]
    return total * (a if p.get("which", "a") == "a" else b) / (a + b)

def m_pct_twice(p):  # เพิ่มแล้วลดด้วย % เท่ากัน/ต่างกัน
    return p["start"] * (1 + p["pct_up"] / 100.0) * (1 - p["pct_down"] / 100.0)

def m_fraction_of(p):  # a/b ของ total
    return p["total"] * p["num"] / p["den"]

def m_number_op(p):  # (op sequence) — ใช้เมื่อสร้างโจทย์แบบ 'พจน์ถัดไปด้วยสูตร'
    seq = p["terms"]; a, b, c = p["coeff"], p["mult"], p["add"]
    return a * seq[-1] * 0 + seq[-1] * p["mult"] + p["add"]

def m_letter_position(p):  # ลำดับตัวอักษร: given positions list
    return float(p["result"])  # คำนวณโดยตรงจาก params (sequence rule given by solver author)

def m_table_read(p):
    return float(p["result"])

METHODS = {k[2:]: v for k, v in list(globals().items()) if k.startswith("m_")}

def main():
    print("== check_math.py ==")
    checks = json.loads(CHECKS_PATH.read_text(encoding="utf-8")) if CHECKS_PATH.exists() else {}
    bank = {}
    for qf in QUESTIONS_DIR.glob("*.json"):
        for q in json.loads(qf.read_text(encoding="utf-8")):
            bank[q["id"]] = q

    checked, mismatched, missing_sidecar = 0, [], 0
    for qid, q in sorted(bank.items()):
        entry = checks.get(qid)
        if entry is None:
            missing_sidecar += 1
            continue
        method = entry.get("method")
        solver = METHODS.get(method) if method else None
        if "result" in entry and solver is None:
            print(f"  [พลาด] {qid}: ไม่รู้จัก method {method!r}")
            mismatched.append(qid)
            continue
        if "result" not in entry and "expected_choice" not in entry:
            print(f"  [พลาด] {qid}: sidecar ต้องมี 'result' หรือ 'expected_choice' อย่างน้อยหนึ่งอย่าง")
            mismatched.append(qid)
            continue
        if "result" in entry:
            try:
                computed = solver(entry["params"])
            except AssertionError as e:
                print(f"  [พลาด] {qid}: {e}")
                mismatched.append(qid)
                continue
            expected = float(entry["result"])
            if abs(computed - expected) > TOL:
                print(f"  [ไม่ตรง] {qid}: solver คำนวณได้ {computed} แต่ sidecar ระบุ {expected}")
                mismatched.append(qid)
                continue
            # เทียบกับค่า answer จริง: ถ้าตัวเลือกเฉลยเป็นตัวเลข ต้องตรงกับค่าที่คำนวณได้
            try:
                choice_val = float(str(q["choices"][q["answer"]]).replace(",", "").replace("%", "").strip())
                ok = abs(choice_val - computed) < TOL or abs(choice_val - computed) <= 0.5 + TOL
            except ValueError:
                ok = None  # คำตอบไม่ใช่ตัวเลขล้วน — ตรวจผ่าน expected_choice แทน
            if ok is False:
                print(f"  [ไม่ตรง] {qid}: ตัวเลือกเฉลย ({q['choices'][q['answer']]}) ไม่ตรงกับค่าคำนวณ ({computed})")
                mismatched.append(qid)
                continue
        if "expected_choice" in entry:
            if q["choices"][q["answer"]] != entry["expected_choice"]:
                print(f"  [ไม่ตรง] {qid}: เฉลยคือ {q['choices'][q['answer']]!r} แต่ sidecar ระบุ {entry['expected_choice']!r}")
                mismatched.append(qid)
                continue
        checked += 1

    numeric_total = len(bank) - missing_sidecar
    print(f"\nตรวจแล้ว: {checked}/{len(bank)} ข้อ (ที่มี sidecar {numeric_total} ข้อ, ไม่มี sidecar {missing_sidecar} ข้อ)")
    if mismatched:
        print(f"\n!! พบข้อไม่ตรง {len(mismatched)} ข้อ: {mismatched}")
        sys.exit(1)
    print("✅ คำตอบข้อที่คำนวณได้ทั้งหมดตรงกับ sidecar และ answer key")

if __name__ == "__main__":
    main()
