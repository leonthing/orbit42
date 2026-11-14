import test from "node:test";
import assert from "node:assert/strict";
import {
  normPhone, fmtPhone, kname, displayName, searchQueries, findCandidates, defaultChoice,
  buildCreate, buildUpdate, needsCardGroup, type CardFields, type GPerson,
} from "../src/lib/cards-match";

const card = (o: Partial<CardFields> = {}): CardFields => ({
  name: "홍길동", company: "새회사", department: "전략팀", title: "상무",
  mobile: "+82 10-1234-5678", workPhone: "02-555-1234", fax: "02-555-1235",
  emails: ["GILDONG@newco.kr"], address: "서울 강남구 테헤란로 1", website: "newco.kr", ...o,
});
const person = (o: Partial<GPerson> & { name?: string } = {}): GPerson => ({
  resourceName: o.resourceName ?? "people/c1", etag: "e1",
  names: [{ displayName: o.name ?? "홍길동 이사(옛회사)" }],
  organizations: o.organizations ?? [{ name: "옛회사", title: "이사" }],
  phoneNumbers: o.phoneNumbers ?? [{ value: "010-1234-5678", type: "mobile" }, { value: "02-777-0000", type: "work" }],
  emailAddresses: o.emailAddresses ?? [{ value: "gildong@oldco.kr" }],
  biographies: o.biographies, memberships: o.memberships, addresses: o.addresses, urls: o.urls,
});
const opts = { photoLinks: ["https://drive.google.com/file/d/A/view"], today: "2026-11-16", cardGroup: "contactGroups/card" };

test("번호 정규화·모양 — dedupe.py 와 같게", () => {
  assert.equal(normPhone("+82 10-1234-5678"), "01012345678");
  assert.equal(normPhone("010.1234.5678"), "01012345678");
  assert.equal(fmtPhone("01012345678"), "010-1234-5678");
  assert.equal(fmtPhone("025551234"), "02-555-1234");
  assert.equal(fmtPhone("0315551234"), "031-555-1234");
});

test("한글 이름·표시 이름", () => {
  assert.equal(kname("홍길동 상무(엔씽)"), "홍길동");
  assert.equal(kname("John Kim"), "");
  assert.equal(displayName(card()), "홍길동 상무(새회사)");
  assert.equal(displayName(card({ company: "", title: "" })), "홍길동");
});

test("검색 질의: 휴대폰 여러 모양 + 개인 메일, 공용 메일·대표번호 제외", () => {
  const q = searchQueries(card({ emails: ["info@newco.kr", "gd@newco.kr"] }));
  assert.ok(q.includes("010-1234-5678") && q.includes("01012345678") && q.includes("+82 10-1234-5678"));
  assert.ok(q.includes("gd@newco.kr"));
  assert.ok(!q.includes("info@newco.kr"));
  assert.ok(!q.some((x) => x.includes("555")));
});

test("휴대폰 같고 이름 같음 → 갱신 후보(기본 선택 갱신)", () => {
  const c = findCandidates(card(), [person()]);
  assert.equal(c.length, 1);
  assert.deepEqual(c[0].reasons, ["mobile"]);
  assert.equal(c[0].nameDiffers, false);
  assert.deepEqual(defaultChoice(c), { kind: "update", resourceName: "people/c1" });
});

test("번호 같은데 이름 다름 → 자동 갱신 금지(기본은 새로 만들기, 화면에서 묻기)", () => {
  const c = findCandidates(card(), [person({ name: "김철수 대리(옛회사)" })]);
  assert.equal(c[0].nameDiffers, true);
  assert.deepEqual(defaultChoice(c), { kind: "create" });
});

test("사무실 대표번호만 같으면 같은 사람 아님", () => {
  const p = person({ phoneNumbers: [{ value: "02-555-1234" }], emailAddresses: [] });
  assert.equal(findCandidates(card({ mobile: "010-9999-0000" }), [p]).length, 0);
});

test("공용 메일(info@)은 판단에 안 씀, 개인 메일은 씀", () => {
  const p = person({ phoneNumbers: [], emailAddresses: [{ value: "info@newco.kr" }] });
  assert.equal(findCandidates(card({ mobile: "", emails: ["info@newco.kr"] }), [p]).length, 0);
  const q = person({ phoneNumbers: [], emailAddresses: [{ value: "GILDONG@newco.kr" }] });
  assert.deepEqual(findCandidates(card({ mobile: "" }), [q])[0].reasons, ["email"]);
});

test("서로 다른 한글 이름 3명 이상이 쓰는 메일은 공용으로 봄", () => {
  const share = [{ value: "team.a@newco.kr" }];
  const ps = [
    person({ resourceName: "people/1", name: "김철수", phoneNumbers: [], emailAddresses: share }),
    person({ resourceName: "people/2", name: "이영희", phoneNumbers: [], emailAddresses: share }),
  ];
  assert.equal(findCandidates(card({ mobile: "", emails: ["team.a@newco.kr"] }), ps).length, 0);
  // 2명(명함 포함)이면 아직 개인 메일로 봄 → 이름 다른 후보로 묻기
  const c = findCandidates(card({ mobile: "", emails: ["team.a@newco.kr"] }), ps.slice(0, 1));
  assert.equal(c.length, 1);
  assert.equal(c[0].nameDiffers, true);
});

test("휴대폰·메일 없으면 이름+전화 전체가 같을 때만", () => {
  const c0 = card({ mobile: "", emails: [], workPhone: "02-555-1234", fax: "" });
  assert.equal(findCandidates(c0, [person({ name: "홍길동 이사", phoneNumbers: [{ value: "02-555-1234" }], emailAddresses: [] })]).length, 1);
  assert.equal(findCandidates(c0, [person({ name: "홍길동 이사", phoneNumbers: [{ value: "02-555-9999" }], emailAddresses: [] })]).length, 0);
});

test("새로 만들기 본문: 표시 이름·조직·라벨·사진 링크", () => {
  const b: any = buildCreate(card(), opts);
  assert.equal(b.names[0].givenName, "홍길동 상무(새회사)");
  assert.equal(b.organizations[0].name, "새회사");
  assert.deepEqual(b.phoneNumbers.map((p: any) => p.value), ["010-1234-5678", "02-555-1234", "02-555-1235"]);
  assert.equal(b.phoneNumbers[2].type, "workFax");
  assert.equal(b.emailAddresses[0].value, "gildong@newco.kr");
  assert.equal(b.memberships[0].contactGroupMembership.contactGroupResourceName, "contactGroups/card");
  assert.match(b.biographies[0].value, /^명함\(2026-11-16\): https:\/\/drive/);
});

test("갱신: 회사·직함은 새 명함, 이전 명함은 메모, 전화·메일 합치기(지우지 않음)", () => {
  const old = person({ biographies: [{ value: "2019 행사에서 만남" }] });
  const b: any = buildUpdate(old, card(), opts);
  assert.equal(b.etag, "e1");
  assert.equal(b.names[0].givenName, "홍길동 상무(새회사)");
  assert.equal(b.organizations[0].title, "상무");
  const nums = b.phoneNumbers.map((p: any) => normPhone(p.value));
  assert.deepEqual(nums, ["01012345678", "025551234", "025551235", "027770000"]);
  assert.deepEqual(b.emailAddresses.map((e: any) => e.value), ["gildong@newco.kr", "gildong@oldco.kr"]);
  const note = b.biographies[0].value.split("\n");
  assert.equal(note[0], "2019 행사에서 만남");
  assert.equal(note[1], "이전 명함: 옛회사 이사(2026-11)");
  assert.match(note[2], /^명함\(2026-11-16\)/);
});

test("갱신: 이미 '이전 명함' 줄이 있으면 덧붙임, 같은 회사·직함이면 안 남김", () => {
  const old = person({ biographies: [{ value: "이전 명함: 첫회사 과장(2015-03)" }] });
  const b: any = buildUpdate(old, card(), opts);
  assert.equal(b.biographies[0].value.split("\n")[0], "이전 명함: 첫회사 과장(2015-03) / 옛회사 이사(2026-11)");
  const same = buildUpdate(person({ organizations: [{ name: "새회사", title: "상무" }] }), card(), { ...opts, photoLinks: [] });
  assert.equal(same.biographies![0].value, "");
});

test("Card 라벨: 없으면 더하고, Remember 는 그대로", () => {
  const p = person({ memberships: [{ contactGroupMembership: { contactGroupResourceName: "contactGroups/remember" } }] });
  assert.equal(needsCardGroup(p, "contactGroups/card"), true);
  const q = person({ memberships: [{ contactGroupMembership: { contactGroupResourceName: "contactGroups/card" } }] });
  assert.equal(needsCardGroup(q, "contactGroups/card"), false);
});
