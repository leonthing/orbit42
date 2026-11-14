# 칸별 정답률 표: python3 score.py truth.json result.json
import json, re, sys
T = {t["files"][0]: t for t in json.load(open(sys.argv[1]))}
R = json.load(open(sys.argv[2]))
FIELDS = ["name", "company", "department", "title", "mobile", "workPhone", "fax", "emails", "address", "website"]
KO = {"name": "이름", "company": "회사", "department": "부서", "title": "직함", "mobile": "휴대폰", "workPhone": "회사전화", "fax": "팩스", "emails": "이메일", "address": "주소", "website": "웹"}
def norm(f, v):
    if f == "emails": return sorted(e.lower() for e in v)
    v = v or ""
    if f in ("mobile", "workPhone", "fax"): return re.sub(r"\D", "", v)
    if f == "website": v = re.sub(r"^(https?://)?(www\.)?", "", v.lower()).rstrip("/")
    return re.sub(r"[\s,.()㈜|·\-]", "", v.lower()).replace("주", "") if f == "company" else re.sub(r"[\s,.|·]", "", v.lower())
stat = {f: [0, 0, 0] for f in FIELDS}  # 맞음, 있는 칸 수, 없는데 채움
miss = []
for r in R:
    key = r["_file"].split("/")[-1]
    t = T[key]
    for f in FIELDS:
        tv, rv = norm(f, t[f]), norm(f, r.get(f, "" if f != "emails" else []))
        if tv:
            stat[f][1] += 1
            if tv == rv: stat[f][0] += 1
            else: miss.append((t["id"], t["kind"], KO[f], t[f], r.get(f)))
        elif rv:
            stat[f][2] += 1; miss.append((t["id"], t["kind"], KO[f] + "(없는 칸 채움)", "", r.get(f)))
print("| 칸 | 맞음/있는 칸 | 정답률 | 없는 칸에 잘못 채움 |\n|---|---|---|---|")
tot = [0, 0]
for f in FIELDS:
    ok, n, fp = stat[f]; tot[0] += ok; tot[1] += n
    print(f"| {KO[f]} | {ok}/{n} | {ok / n * 100:.0f}% | {fp} |" if n else f"| {KO[f]} | - | - | {fp} |")
print(f"| **전체** | {tot[0]}/{tot[1]} | {tot[0] / tot[1] * 100:.1f}% | |")
perfect = sum(1 for r in R if not any(m[0] == T[r['_file'].split('/')[-1]]['id'] for m in miss))
print(f"\n모든 칸이 맞은 명함: {perfect}/{len(R)}")
if "-v" in sys.argv:
    for m in miss: print(m)
