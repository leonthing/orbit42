"""Orbit42 App Store 노출·제품 페이지 조회·처음 받기 → PO_orbit42/지표_노출.csv (ASC Analytics 보고서, 조회만).
사용 (/usr/bin/python3, PyJWT 필요):
  /usr/bin/python3 scripts/impressions.py        # 받을 수 있는 날짜 전부로 csv 를 다시 쓴다(2026-10-12부터)
보고서: Analytics 요청(ONGOING) e321d6d4-3914-4ff9-b721-c266078298cd 의
  'App Store Discovery and Engagement Standard'(Event=Impression·Page view) 와
  'App Downloads Standard'(Download Type=First-time download) — DAILY 인스턴스.
한 인스턴스에 며칠치가 들어오고 나중 인스턴스가 같은 날을 고쳐 보낼 수 있어, 날짜마다 처리일이 가장 늦은 인스턴스 값을 쓴다.
보고서는 하루 이틀 늦게 나온다. 데이터가 아직 없는 날(마지막 날짜 이후)은 쓰지 않는다. 날짜는 보고서 기준(미국 태평양).
열: date,impressions,unique_impressions,page_views,first_downloads,top_countries (노출 상위 3개국 "KR 187; US 2")"""
import collections, csv, datetime as dt, gzip, io, json, pathlib, time, urllib.request
import jwt

HERE = pathlib.Path(__file__).parent
OUT = HERE.parent / "PO_orbit42" / "지표_노출.csv"
K, ISS = "Q5CMWT72A8", "86dc8cf1-c3fe-4a19-839b-1bcb416d6a5f"
P8 = pathlib.Path.home() / f".appstoreconnect/private_keys/AuthKey_{K}.p8"
REQUEST_ID = "e321d6d4-3914-4ff9-b721-c266078298cd"
START = dt.date(2026, 10, 12)
DISCOVERY = "App Store Discovery and Engagement Standard"
DOWNLOADS = "App Downloads Standard"


def token():
    now = int(time.time())
    return jwt.encode({"iss": ISS, "iat": now, "exp": now + 1100, "aud": "appstoreconnect-v1"},
                      P8.read_text(), algorithm="ES256", headers={"kid": K})


def get(path):
    req = urllib.request.Request("https://api.appstoreconnect.apple.com" + path, headers={"Authorization": "Bearer " + token()})
    return json.load(urllib.request.urlopen(req, timeout=60))


def rows_by_date(report_name):
    """{date: (processingDate, [rows])} — 날짜마다 가장 늦게 처리된 인스턴스의 행만"""
    reports = get(f"/v1/analyticsReportRequests/{REQUEST_ID}/reports?limit=200")["data"]
    report = next(r for r in reports if r["attributes"]["name"] == report_name)
    best = {}
    path = f"/v1/analyticsReports/{report['id']}/instances?filter[granularity]=DAILY&limit=200"
    while path:
        page = get(path)
        for inst in page["data"]:
            processed = inst["attributes"]["processingDate"]
            per_date = collections.defaultdict(list)
            for seg in get(f"/v1/analyticsReportInstances/{inst['id']}/segments")["data"]:
                raw = urllib.request.urlopen(seg["attributes"]["url"], timeout=60).read()
                try:
                    raw = gzip.decompress(raw)
                except OSError:
                    pass
                for row in csv.DictReader(io.StringIO(raw.decode()), delimiter="\t"):
                    per_date[row["Date"]].append(row)
            for d, rows in per_date.items():
                if d not in best or processed > best[d][0]:
                    best[d] = (processed, rows)
        nxt = page.get("links", {}).get("next")
        path = nxt.replace("https://api.appstoreconnect.apple.com", "") if nxt else None
    return {d: rows for d, (_, rows) in best.items()}


def num(v):
    return int(float(v or 0))


def main():
    disc = rows_by_date(DISCOVERY)
    down = rows_by_date(DOWNLOADS)
    have = [dt.date.fromisoformat(d) for d in list(disc) + list(down)]
    if not have:
        raise SystemExit("아직 받은 보고서가 없습니다")
    last = max(have)
    out = []
    d = START
    while d <= last:
        key = d.isoformat()
        imp = uniq = views = 0
        by_country = collections.Counter()
        for r in disc.get(key, []):
            if r["Event"] == "Impression":
                imp += num(r["Counts"]); uniq += num(r["Unique Counts"]); by_country[r["Territory"]] += num(r["Counts"])
            elif r["Event"] == "Page view":
                views += num(r["Counts"])
        first = sum(num(r["Counts"]) for r in down.get(key, []) if r["Download Type"] == "First-time download")
        top = "; ".join(f"{c} {n}" for c, n in by_country.most_common(3))
        out.append([key, imp, uniq, views, first, top])
        d += dt.timedelta(days=1)
    with OUT.open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["date", "impressions", "unique_impressions", "page_views", "first_downloads", "top_countries"])
        w.writerows(out)
    for row in out:
        print(*row, sep=",")


if __name__ == "__main__":
    main()
