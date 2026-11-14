// 합성 명함 24장(가짜 이름·회사·번호) — HTML 로 그려 사진처럼 살짝 기울이고 흐리게 찍는다.
// node gen.mjs <출력 폴더>  → card-XX.jpg(+ card-XX-back.jpg) 와 truth.json
// 실명함은 쓰지 않는다(PO 11/15). playwright-core 는 npx 캐시의 것을 쓴다(PW 환경변수로 경로).
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const out = process.argv[2];
fs.mkdirSync(out, { recursive: true });
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW);

let seed = Number(process.env.SEED ?? 42);
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const digits = (n) => Array.from({ length: n }, () => Math.floor(rnd() * 10)).join("");

const SUR = ["김", "이", "박", "최", "정", "강", "조", "윤", "장", "임", "한", "오", "서", "신", "권", "황", "안", "송", "류", "홍"];
const GIV = ["민준", "서연", "도윤", "하은", "지호", "수아", "예준", "지우", "현우", "채원", "준서", "다은", "건우", "소율", "우진", "유나", "선우", "지민", "태윤", "은서", "정훈", "미경", "성호", "혜진"];
const ROMAN = { 김: "Kim", 이: "Lee", 박: "Park", 최: "Choi", 정: "Jung", 강: "Kang", 조: "Cho", 윤: "Yoon", 장: "Jang", 임: "Lim", 한: "Han", 오: "Oh", 서: "Seo", 신: "Shin", 권: "Kwon", 황: "Hwang", 안: "Ahn", 송: "Song", 류: "Ryu", 홍: "Hong" };
const GROM = { 민준: "Minjun", 서연: "Seoyeon", 도윤: "Doyun", 하은: "Haeun", 지호: "Jiho", 수아: "Sua", 예준: "Yejun", 지우: "Jiwoo", 현우: "Hyunwoo", 채원: "Chaewon", 준서: "Junseo", 다은: "Daeun", 건우: "Gunwoo", 소율: "Soyul", 우진: "Woojin", 유나: "Yuna", 선우: "Sunwoo", 지민: "Jimin", 태윤: "Taeyun", 은서: "Eunseo", 정훈: "Junghoon", 미경: "Mikyung", 성호: "Sungho", 혜진: "Hyejin" };
const CO = [
  ["주식회사 블루핀랩스", "Bluefin Labs Inc.", "bluefinlabs.co.kr"],
  ["(주)한결소프트", "Hangyeol Soft Co., Ltd.", "hgsoft.kr"],
  ["새벽들 파트너스", "Saebyeokdeul Partners", "sbdpartners.com"],
  ["㈜오름바이오", "Oreum Bio Corp.", "oreumbio.com"],
  ["누리온 테크", "Nurion Tech", "nuriontech.io"],
  ["다온벤처스", "Daon Ventures", "daonvc.com"],
  ["주식회사 마루디자인", "Maru Design Studio", "marudesign.kr"],
  ["한빛자산운용", "Hanbit Asset Management", "hanbitam.co.kr"],
  ["그린잎 농업회사법인", "Greenleaf Agri Co.", "greenleaf.farm"],
  ["솔빛 법무법인", "Solbit Law Group", "solbitlaw.com"],
];
const DEPT = [["전략기획팀", "Strategy Team"], ["사업개발본부", "Business Development Division"], ["연구소", "R&D Center"], ["마케팅팀", "Marketing Team"], ["재무팀", "Finance Department"], ["", ""]];
const TITLE = [["대표이사", "CEO"], ["상무", "Executive Director"], ["팀장", "Team Lead"], ["책임연구원", "Senior Researcher"], ["매니저", "Manager"], ["이사", "Director"], ["부장", "General Manager"], ["변호사", "Attorney"], ["과장", "Manager"], ["수석 디자이너", "Lead Designer"]];
const ADDR = [
  ["서울특별시 강남구 테헤란로 152 강남파이낸스센터 21층", "21F, 152 Teheran-ro, Gangnam-gu, Seoul, Korea"],
  ["경기도 성남시 분당구 판교역로 235 에이치스퀘어 N동 7층", "7F, 235 Pangyoyeok-ro, Bundang-gu, Seongnam-si, Gyeonggi-do"],
  ["서울시 마포구 월드컵북로 396 누리꿈스퀘어 12층", "12F, 396 World Cup buk-ro, Mapo-gu, Seoul"],
  ["부산광역시 해운대구 센텀중앙로 78 센텀그린타워 9층", "9F, 78 Centum jungang-ro, Haeundae-gu, Busan"],
  ["서울특별시 성동구 왕십리로 83-21 3층", "3F, 83-21 Wangsimni-ro, Seongdong-gu, Seoul"],
];

function person(i) {
  const s = pick(SUR), g = pick(GIV), co = CO[i % CO.length], dp = pick(DEPT), ti = TITLE[i % TITLE.length], ad = pick(ADDR);
  const user = pick(["", "."]) ? `${GROM[g].toLowerCase()}.${ROMAN[s].toLowerCase()}` : `${GROM[g][0].toLowerCase()}${ROMAN[s].toLowerCase()}`;
  const mob = `010${digits(8)}`;
  const area = pick(["02", "031", "051"]);
  const tel = area === "02" ? `02${digits(8)}` : `${area}${digits(7)}`;
  const fax = rnd() < 0.6 ? tel.slice(0, -1) + ((+tel.slice(-1) + 1) % 10) : "";
  return {
    ko: { name: s + g, company: co[0], dept: dp[0], title: ti[0], address: ad[0] },
    en: { name: `${GROM[g]} ${ROMAN[s]}`, company: co[1], dept: dp[1], title: ti[1], address: ad[1] },
    mobile: mob, tel, fax, email: `${user}@${co[2]}`, web: rnd() < 0.6 ? `www.${co[2]}` : "",
  };
}
const f = (d) => (d.startsWith("02") ? `02-${d.slice(2, -4)}-${d.slice(-4)}` : `${d.slice(0, 3)}-${d.slice(3, -4)}-${d.slice(-4)}`);
const intl = (d) => `+82 ${d.slice(1, d.startsWith("02") ? 2 : 3)}-${d.slice(d.startsWith("02") ? 2 : 3, -4)}-${d.slice(-4)}`;

const css = `*{margin:0;box-sizing:border-box} body{width:1050px;height:600px;font-family:"Apple SD Gothic Neo","Helvetica Neue",sans-serif;color:#222;background:#fbfaf7;padding:56px 64px;position:relative;overflow:hidden}
.logo{font-weight:800;color:#1d3c78;font-size:30px;letter-spacing:-0.5px}.name{font-size:46px;font-weight:700}.title{font-size:24px;color:#555}.small{font-size:20px;line-height:1.55;color:#333}.muted{color:#777}`;

const L = {
  // 한글 기본: 왼쪽 위 회사, 이름+직함 한 줄, 부서, 아래 연락처 줄마다 라벨
  koA: (p) => `<div class=logo>${p.ko.company}</div><div style="margin-top:70px"><span class=name>${p.ko.name}</span> <span class=title>${p.ko.title}</span></div><div class="small muted">${p.ko.dept}</div>
   <div class=small style="position:absolute;bottom:50px;left:64px">${p.ko.address}<br>T. ${f(p.tel)}${p.fax ? `&nbsp;&nbsp;F. ${f(p.fax)}` : ""}<br>M. ${f(p.mobile)}&nbsp;&nbsp;E. ${p.email}${p.web ? `<br>${p.web}` : ""}</div>`,
  // 가운데: 회사, 이름(띄어 쓴 한 글자씩), 부서 | 직함, 연락처 | 로 한 줄
  koB: (p) => `<div style="text-align:center"><div class=logo>${p.ko.company}</div><div class=name style="margin-top:60px;letter-spacing:12px">${p.ko.name.split("").join(" ")}</div><div class=title>${[p.ko.dept, p.ko.title].filter(Boolean).join(" | ")}</div>
   <div class=small style="margin-top:50px">${f(p.mobile)} | ${p.email}<br>Tel ${f(p.tel)}${p.fax ? ` | Fax ${f(p.fax)}` : ""}<br>${p.ko.address}</div></div>`,
  // 한글 라벨: 휴대폰 / 전화 / 팩스 / 이메일, 이름 아래 직함
  koC: (p) => `<div style="display:flex;justify-content:space-between"><div><div class=name>${p.ko.name}</div><div class=title>${p.ko.dept} ${p.ko.title}</div></div><div class=logo style="font-size:26px">${p.ko.company}</div></div>
   <div class=small style="margin-top:60px">휴대폰 ${f(p.mobile)}<br>전화 ${f(p.tel)}${p.fax ? `&nbsp;&nbsp;팩스 ${f(p.fax)}` : ""}<br>이메일 ${p.email}<br>${p.ko.address}${p.web ? `<br>${p.web}` : ""}</div>`,
  // 영문 기본
  enD: (p) => `<div class=logo>${p.en.company}</div><div style="margin-top:56px" class=name>${p.en.name}</div><div class=title>${p.en.title}${p.en.dept ? `, ${p.en.dept}` : ""}</div>
   <div class=small style="position:absolute;bottom:46px;left:64px">Mobile ${intl(p.mobile)}<br>Tel ${intl(p.tel)}${p.fax ? `&nbsp;&nbsp;Fax ${intl(p.fax)}` : ""}<br>${p.email}${p.web ? `&nbsp;&nbsp;${p.web}` : ""}<br>${p.en.address}</div>`,
  // 영문 미니멀: 대문자 이름, M. 띄어 쓴 번호
  enE: (p) => `<div style="position:absolute;right:64px;top:56px" class=logo>${p.en.company}</div><div style="margin-top:150px;font-size:40px;font-weight:700;letter-spacing:2px">${p.en.name.toUpperCase()}</div><div class=title>${p.en.title}</div>
   <div class=small style="margin-top:40px">M. ${intl(p.mobile).replace(/-/g, " ")}<br>E. ${p.email}<br>${p.en.address}</div>`,
};
const V = {
  // 세로형(600×1050)
  koV: (p) => `<div style="text-align:center"><div class=logo>${p.ko.company}</div><div class=name style="margin-top:200px">${p.ko.name}</div><div class=title style="margin-top:8px">${p.ko.title}</div><div class="small muted">${p.ko.dept}</div>
   <div class=small style="margin-top:160px">M ${f(p.mobile)}<br>T ${f(p.tel)}<br>${p.fax ? `F ${f(p.fax)}<br>` : ""}${p.email}<br>${p.ko.address}</div></div>`,
  enV: (p) => `<div class=logo>${p.en.company}</div><div class=name style="margin-top:220px;font-size:40px">${p.en.name}</div><div class=title>${p.en.title}</div>
   <div class=small style="margin-top:180px">Mobile ${intl(p.mobile)}<br>Office ${intl(p.tel)}<br>${p.email}${p.web ? `<br>${p.web}` : ""}<br>${p.en.address}</div>`,
};

const plan = [
  ...Array(4).fill("koA"), ...Array(4).fill("koB"), ...Array(3).fill("koC"), ...Array(3).fill("enD"), ...Array(3).fill("enE"),
  "koV", "koV", "koV", "enV", "two", "two", "two",
];

const truth = [];
const browser = await chromium.launch({ channel: "chrome" });
for (let i = 0; i < plan.length; i++) {
  const p = person(i);
  const kind = plan[i];
  const isEn = kind.startsWith("en");
  const id = `card-${String(i + 1).padStart(2, "0")}`;
  const vertical = kind.endsWith("V");
  const shoot = async (html, file, w, h) => {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    const rot = (rnd() * 3 - 1.5).toFixed(2), blur = (rnd() * 0.6).toFixed(2);
    await page.setContent(`<style>${css} body{width:${w}px;height:${h}px;transform:rotate(${rot}deg);filter:blur(${blur}px)}</style><body>${html}</body>`);
    await page.screenshot({ path: path.join(out, file), type: "jpeg", quality: 70 });
    await page.close();
  };
  const files = [];
  if (kind === "two") {
    await shoot(L.koA(p), `${id}.jpg`, 1050, 600);
    await shoot(L.enD(p), `${id}-back.jpg`, 1050, 600);
    files.push(`${id}.jpg`, `${id}-back.jpg`);
  } else if (vertical) {
    await shoot(V[kind](p), `${id}.jpg`, 600, 1050);
    files.push(`${id}.jpg`);
  } else {
    await shoot(L[kind](p), `${id}.jpg`, 1050, 600);
    files.push(`${id}.jpg`);
  }
  const lang = isEn ? p.en : p.ko;
  const hasWeb = ["koA", "koC", "enD", "enV", "two"].includes(kind) && p.web;
  const hasFax = kind !== "enE" && kind !== "enV" && p.fax;
  truth.push({
    id, kind, files,
    name: lang.name, company: lang.company,
    department: kind === "enE" || kind === "enV" ? "" : lang.dept,
    title: lang.title,
    mobile: f(p.mobile), workPhone: kind === "enE" ? "" : f(p.tel), fax: hasFax ? f(p.fax) : "",
    emails: [p.email], address: lang.address, website: hasWeb ? p.web : "",
  });
}
await browser.close();
fs.writeFileSync(path.join(out, "truth.json"), JSON.stringify(truth, null, 2));
console.log(`${truth.length} cards → ${out}`);
