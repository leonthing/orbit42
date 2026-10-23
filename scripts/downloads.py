"""Orbit42 App Store 일별·국가별 다운로드 → PO_orbit42/지표_다운로드.csv (ASC 판매 보고서 SALES/SUMMARY/DAILY).
사용 (/usr/bin/python3, PyJWT 필요):
  /usr/bin/python3 scripts/downloads.py                    # CSV 마지막 날 다음부터 어제까지 채움 (CSV 없으면 어제 하루)
  /usr/bin/python3 scripts/downloads.py --from 2026-07-28  # 그날부터 어제까지 비어 있는 날짜를 모두 채움
vendor 번호는 환경변수 ASC_VENDOR 또는 Martcal 의 vendor.txt 를 읽는다(같은 ASC 계정, 공개 저장소라 여기 두지 않음).
열: date,country,first_downloads,redownloads,updates
  first_downloads = 제품유형 1·1F·1T(처음 받기), redownloads = 3·3F(다시 받기), updates = 7·7F·7T
보고서 날짜는 미국 태평양 기준. 다운로드가 0인 날은 Apple 이 404 → 'ALL,0,0,0' 한 줄로 '조회함'을 남긴다."""
import csv, datetime as dt, gzip, io, os, pathlib, sys, time, urllib.error, urllib.request
import jwt

HERE = pathlib.Path(__file__).parent
OUT = HERE.parent / "PO_orbit42" / "지표_다운로드.csv"
K, ISS = "Q5CMWT72A8", "86dc8cf1-c3fe-4a19-839b-1bcb416d6a5f"
P8 = pathlib.Path.home() / f".appstoreconnect/private_keys/AuthKey_{K}.p8"
APP_ID = "6795434941"  # Orbit42 Apple ID
FIRST, RE, UPD = {"1", "1F", "1T"}, {"3", "3F"}, {"7", "7F", "7T"}


def token():
    now = int(time.time())
    return jwt.encode({"iss": ISS, "iat": now, "exp": now + 1100, "aud": "appstoreconnect-v1"},
                      P8.read_text(), algorithm="ES256", headers={"kid": K})


def vendor():
    f = pathlib.Path.home() / "work/martcal/marketing/metrics/vendor.txt"
    v = os.environ.get("ASC_VENDOR") or (f.read_text().strip() if f.exists() else "")
    if not v: raise SystemExit(f"vendor 번호가 없습니다 (ASC_VENDOR 또는 {f})")
    return v


def day(d, v):
    q = (f"filter[frequency]=DAILY&filter[reportType]=SALES&filter[reportSubType]=SUMMARY"
         f"&filter[version]=1_1&filter[vendorNumber]={v}&filter[reportDate]={d}")
    req = urllib.request.Request(f"https://api.appstoreconnect.apple.com/v1/salesReports?{q}",
                                 headers={"Authorization": "Bearer " + token(), "Accept": "application/a-gzip"})
    try:
        raw = gzip.decompress(urllib.request.urlopen(req, timeout=60).read()).decode()
    except urllib.error.HTTPError as e:
        if e.code == 404: return {}
        raise SystemExit(f"{d}: HTTP {e.code} {e.read().decode()[:200]}")
    out = {}
    for row in csv.DictReader(io.StringIO(raw), delimiter="\t"):
        if row.get("Apple Identifier") != APP_ID: continue
        c = out.setdefault(row["Country Code"], [0, 0, 0]); t = row["Product Type Identifier"]; u = int(float(row["Units"]))
        if t in FIRST: c[0] += u
        elif t in RE: c[1] += u
        elif t in UPD: c[2] += u
    return out


def main():
    v = vendor()
    have = {r["date"] for r in csv.DictReader(OUT.open())} if OUT.exists() else set()
    yesterday = dt.date.today() - dt.timedelta(days=1)
    if "--from" in sys.argv: start = dt.date.fromisoformat(sys.argv[sys.argv.index("--from") + 1])
    else: start = min(yesterday, dt.date.fromisoformat(max(have)) + dt.timedelta(days=1)) if have else yesterday
    new = not OUT.exists()
    with OUT.open("a", newline="") as f:
        w = csv.writer(f)
        if new: w.writerow(["date", "country", "first_downloads", "redownloads", "updates"])
        d = start
        while d <= yesterday:
            ds = d.isoformat()
            if ds not in have:
                rows = day(ds, v)
                for c, (a, b, u) in sorted(rows.items()): w.writerow([ds, c, a, b, u])
                if not rows: w.writerow([ds, "ALL", 0, 0, 0])
                print(ds, sum(x[0] for x in rows.values()), "first", sum(x[2] for x in rows.values()), "updates", flush=True)
            d += dt.timedelta(days=1)
    with OUT.open() as f: head, *rows = list(csv.reader(f))
    with OUT.open("w", newline="") as f: csv.writer(f).writerows([head] + sorted(rows, key=lambda r: (r[0], r[1])))


if __name__ == "__main__":
    main()
