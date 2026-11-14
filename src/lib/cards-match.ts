/**
 * 명함 → 구글 연락처: 같은 사람 판단·저장 내용 만들기(순수 함수, 네트워크 없음).
 * 규칙은 ~/CEO/산출물/contacts/dedupe.py(11/15 Leo 연락처 정리)와 같게 옮겼다.
 *  - 휴대폰: 숫자만, 82로 시작하면 0으로. 01로 시작하는 10자리 이상만 같은 사람 판단에 쓴다.
 *  - 이메일: 소문자. info@·contact@ 같은 공용 주소와, 서로 다른 한글 이름 3명 이상이 함께 쓰는 주소는 판단에서 뺀다.
 *  - 사무실 대표번호·팩스·주소는 판단에 쓰지 않는다.
 *  - 휴대폰·이메일이 하나도 없으면 '이름 + 전화 전체'가 같을 때만 같은 사람.
 *  - 한글 이름이 다르면 자동 갱신하지 않고 반드시 묻는다.
 * 갱신 규칙(요청서 4번): 회사·직함은 새 명함 기준, 예전 회사·직함은 메모에 '이전 명함: 회사 직함(연월)'.
 * 전화·이메일(그리고 주소·웹)은 합치기만 하고 지우지 않는다. 라벨은 'Card'를 더하고 기존 라벨은 그대로.
 */

export type CardFields = {
  name: string;
  company: string;
  department: string;
  title: string;
  mobile: string;
  workPhone: string;
  fax: string;
  emails: string[];
  address: string;
  website: string;
};

/** People API Person 중 쓰는 부분만 */
export type GPerson = {
  resourceName: string;
  etag?: string;
  names?: { displayName?: string; givenName?: string; familyName?: string; unstructuredName?: string }[];
  organizations?: { name?: string; title?: string; department?: string; type?: string }[];
  phoneNumbers?: { value?: string; type?: string; canonicalForm?: string }[];
  emailAddresses?: { value?: string; type?: string }[];
  addresses?: { formattedValue?: string; streetAddress?: string; type?: string }[];
  urls?: { value?: string; type?: string }[];
  biographies?: { value?: string; contentType?: string }[];
  memberships?: { contactGroupMembership?: { contactGroupResourceName?: string } }[];
};

export function normPhone(x: string): string {
  let d = (x ?? "").replace(/\D/g, "");
  if (d.startsWith("82")) d = "0" + d.slice(2);
  return d;
}

export function fmtPhone(d: string): string {
  if (d.startsWith("010") && d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.startsWith("02") && (d.length === 9 || d.length === 10)) return `02-${d.slice(2, -4)}-${d.slice(-4)}`;
  if (d.startsWith("0") && (d.length === 10 || d.length === 11)) return `${d.slice(0, 3)}-${d.slice(3, -4)}-${d.slice(-4)}`;
  return d;
}

export function isMobile(d: string): boolean {
  return d.startsWith("01") && d.length >= 10;
}

export const GENERIC_EMAIL =
  /^(info|contact|admin|sales|help|support|office|hello|master|webmaster|ir|pr|biz|cs|mail|team|hr|recruit|marketing|ceo)@/;

/** 표시 이름 '홍길동 상무(엔씽)' 에서 한글 이름(2~4자)만. 영문 이름이면 '' */
export function kname(s: string): string {
  const tok = (s ?? "").trim().split(/[\s(/]/)[0] ?? "";
  return /^[가-힣]{2,4}$/.test(tok) ? tok : "";
}

export function normEmail(e: string): string {
  return (e ?? "").trim().toLowerCase();
}

export function displayName(c: Pick<CardFields, "name" | "title" | "company">): string {
  const disp = `${c.name.trim()} ${c.title.trim()}`.trim();
  return c.company.trim() ? `${disp}(${c.company.trim()})` : disp;
}

export function personName(p: GPerson): string {
  const n = p.names?.[0];
  return (n?.displayName || n?.unstructuredName || [n?.familyName, n?.givenName].filter(Boolean).join("") || "").trim();
}

function personPhones(p: GPerson): string[] {
  return (p.phoneNumbers ?? []).map((x) => normPhone(x.value ?? "")).filter(Boolean);
}
function personEmails(p: GPerson): string[] {
  return (p.emailAddresses ?? []).map((x) => normEmail(x.value ?? "")).filter((e) => e.includes("@"));
}

function cardMobiles(c: CardFields): string[] {
  return [c.mobile].map(normPhone).filter(isMobile);
}
function cardEmails(c: CardFields): string[] {
  return Array.from(new Set(c.emails.map(normEmail).filter((e) => e.includes("@"))));
}

/** searchContacts 에 보낼 질의. 구글 검색은 저장된 모양 그대로 맞춰 보므로 휴대폰은 여러 모양으로 */
export function searchQueries(c: CardFields): string[] {
  const q: string[] = [];
  for (const d of cardMobiles(c)) {
    q.push(fmtPhone(d), d, `+82 ${d.slice(1, 3)}-${d.slice(3, -4)}-${d.slice(-4)}`, "+82" + d.slice(1));
  }
  for (const e of cardEmails(c)) if (!GENERIC_EMAIL.test(e)) q.push(e);
  if (q.length === 0 && c.name.trim()) q.push(c.name.trim());
  return Array.from(new Set(q));
}

export type MatchReason = "mobile" | "email" | "name+phones";
export type Candidate = {
  person: GPerson;
  name: string;
  reasons: MatchReason[];
  /** 한글 이름이 서로 다름(또는 한쪽만 한글) — 자동 갱신 금지, 반드시 묻는다 */
  nameDiffers: boolean;
};

/**
 * 검색 결과 사람들 중 같은 사람 후보를 고른다.
 * 공용 주소 판단(서로 다른 한글 이름 3명 이상)은 그 메일로 찾힌 사람들 + 명함 이름으로 센다.
 */
export function findCandidates(card: CardFields, found: GPerson[]): Candidate[] {
  const people = dedupePeople(found);
  const mobiles = new Set(cardMobiles(card));
  const emails = cardEmails(card);
  const sharedEmail = new Set<string>();
  for (const e of emails) {
    if (GENERIC_EMAIL.test(e)) { sharedEmail.add(e); continue; }
    const names = new Set<string>();
    const cn = kname(card.name) || card.name.trim().slice(0, 6);
    if (cn) names.add(cn);
    for (const p of people) if (personEmails(p).includes(e)) names.add(kname(personName(p)) || personName(p).slice(0, 6));
    if (names.size >= 3) sharedEmail.add(e);
  }
  const goodEmails = new Set(emails.filter((e) => !sharedEmail.has(e)));
  const hasKeys = mobiles.size > 0 || goodEmails.size > 0;
  const cardPhones = [card.mobile, card.workPhone, card.fax].map(normPhone).filter(Boolean).sort().join(",");

  const out: Candidate[] = [];
  for (const p of people) {
    const reasons: MatchReason[] = [];
    if (personPhones(p).some((d) => mobiles.has(d))) reasons.push("mobile");
    if (personEmails(p).some((e) => goodEmails.has(e))) reasons.push("email");
    if (!hasKeys) {
      const pn = personName(p);
      const sameName = (kname(pn) || pn) === (kname(card.name) || card.name.trim());
      if (sameName && personPhones(p).sort().join(",") === cardPhones) reasons.push("name+phones");
    }
    if (!reasons.length) continue;
    const a = kname(card.name), b = kname(personName(p));
    const nameDiffers = a && b ? a !== b : (a || b) ? true : !sameLatinName(card.name, personName(p));
    out.push({ person: p, name: personName(p), reasons, nameDiffers });
  }
  // 이름 같은 후보 먼저, 휴대폰으로 찾은 것 먼저
  return out.sort((x, y) => Number(x.nameDiffers) - Number(y.nameDiffers) || Number(!x.reasons.includes("mobile")) - Number(!y.reasons.includes("mobile")));
}

function sameLatinName(a: string, b: string): boolean {
  const n = (s: string) => s.replace(/\(.*$/, "").toLowerCase().replace(/[^a-z]/g, "");
  const x = n(a), y = n(b);
  if (!x || !y) return false;
  return x.startsWith(y.slice(0, Math.min(y.length, 6))) || y.startsWith(x.slice(0, Math.min(x.length, 6)));
}

function dedupePeople(found: GPerson[]): GPerson[] {
  const seen = new Set<string>();
  return found.filter((p) => p?.resourceName && !seen.has(p.resourceName) && seen.add(p.resourceName));
}

/** 판단 결과: 후보 없음 → 새로 만들기 / 후보 있음 → 화면에서 고르기. 자동으로 쓰는 일은 없다('저장'을 눌러야만). */
export function defaultChoice(cands: Candidate[]): { kind: "create" } | { kind: "update"; resourceName: string } {
  const first = cands[0];
  if (!first || first.nameDiffers) return { kind: "create" };
  return { kind: "update", resourceName: first.person.resourceName };
}

const PHONE_TYPE = { mobile: "mobile", work: "work", fax: "workFax" } as const;

function cardPhoneList(c: CardFields): { value: string; type: string }[] {
  const out: { value: string; type: string }[] = [];
  const add = (raw: string, type: string) => {
    const d = normPhone(raw);
    if (d && !out.some((x) => normPhone(x.value) === d)) out.push({ value: fmtPhone(d), type });
  };
  add(c.mobile, PHONE_TYPE.mobile);
  add(c.workPhone, PHONE_TYPE.work);
  add(c.fax, PHONE_TYPE.fax);
  return out;
}

export type SaveOpts = {
  /** Drive 명함 사진 링크(앞·뒤) */
  photoLinks: string[];
  /** 'YYYY-MM-DD' (한국 시간) */
  today: string;
  cardGroup?: string | null;
};

function cardNoteLine(o: SaveOpts): string | null {
  if (!o.photoLinks.length) return null;
  return `명함(${o.today}): ${o.photoLinks.join(" ")}`;
}

/** 새 연락처 본문(people:createContact) */
export function buildCreate(c: CardFields, o: SaveOpts): GPerson & { resourceName?: never } {
  const notes = [cardNoteLine(o)].filter(Boolean) as string[];
  const body: Record<string, unknown> = {
    names: [{ givenName: displayName(c) }],
    phoneNumbers: cardPhoneList(c),
    emailAddresses: cardEmails(c).map((value) => ({ value, type: "work" })),
  };
  if (c.company || c.title || c.department)
    body.organizations = [{ name: c.company.trim(), title: c.title.trim(), department: c.department.trim(), type: "work" }];
  if (c.address.trim()) body.addresses = [{ streetAddress: c.address.trim(), formattedValue: c.address.trim(), type: "work" }];
  if (c.website.trim()) body.urls = [{ value: c.website.trim(), type: "work" }];
  if (notes.length) body.biographies = [{ value: notes.join("\n"), contentType: "TEXT_PLAIN" }];
  if (o.cardGroup) body.memberships = [{ contactGroupMembership: { contactGroupResourceName: o.cardGroup } }];
  return body as GPerson & { resourceName?: never };
}

export const UPDATE_FIELDS = "names,organizations,phoneNumbers,emailAddresses,addresses,urls,biographies";

/** 기존 연락처 갱신 본문(people:updateContact, updatePersonFields=UPDATE_FIELDS). 라벨은 따로(contactGroups.members.modify) */
export function buildUpdate(old: GPerson, c: CardFields, o: SaveOpts): GPerson {
  // 전화: 새 명함 번호 + 기존 번호(지우지 않음), 휴대폰 먼저
  const phones = cardPhoneList(c);
  for (const p of old.phoneNumbers ?? []) {
    const d = normPhone(p.value ?? "");
    if (d && !phones.some((x) => normPhone(x.value) === d)) phones.push({ value: p.value ?? fmtPhone(d), type: p.type ?? "other" });
  }
  phones.sort((a, b) => Number(!isMobile(normPhone(a.value))) - Number(!isMobile(normPhone(b.value))));

  const emails = cardEmails(c).map((value) => ({ value, type: "work" }));
  for (const e of old.emailAddresses ?? []) {
    const v = normEmail(e.value ?? "");
    if (v && !emails.some((x) => x.value === v)) emails.push({ value: e.value ?? v, type: e.type ?? "other" });
  }

  const addresses: { streetAddress?: string; formattedValue?: string; type?: string }[] = [];
  if (c.address.trim()) addresses.push({ streetAddress: c.address.trim(), formattedValue: c.address.trim(), type: "work" });
  for (const a of old.addresses ?? []) {
    const v = (a.formattedValue || a.streetAddress || "").trim();
    if (v && !addresses.some((x) => squash(x.formattedValue ?? "") === squash(v))) addresses.push(a);
  }

  const urls: { value?: string; type?: string }[] = [];
  if (c.website.trim()) urls.push({ value: c.website.trim(), type: "work" });
  for (const u of old.urls ?? []) if (u.value && !urls.some((x) => squash(x.value ?? "") === squash(u.value!))) urls.push(u);

  // 메모: 기존 메모 그대로 + 이전 명함 + 새 명함 사진 링크
  const oldNote = old.biographies?.[0]?.value ?? "";
  const lines = oldNote ? oldNote.split("\n") : [];
  const oldOrg = old.organizations?.[0];
  const prevText = [oldOrg?.name, oldOrg?.title].map((s) => (s ?? "").trim()).filter(Boolean).join(" ");
  const newText = [c.company, c.title].map((s) => s.trim()).filter(Boolean).join(" ");
  if (prevText && squash(prevText) !== squash(newText)) {
    const entry = `${prevText}(${o.today.slice(0, 7)})`;
    const i = lines.findIndex((l) => l.startsWith("이전 명함: "));
    if (i >= 0) {
      if (!lines[i].includes(prevText)) lines[i] = `${lines[i]} / ${entry}`;
    } else lines.push(`이전 명함: ${entry}`);
  }
  const photo = cardNoteLine(o);
  if (photo) lines.push(photo);
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();

  const body: GPerson = {
    resourceName: old.resourceName,
    etag: old.etag,
    names: [{ givenName: displayName(c) }],
    organizations: [{ name: c.company.trim(), title: c.title.trim(), department: c.department.trim(), type: "work" }],
    phoneNumbers: phones,
    emailAddresses: emails,
    addresses,
    urls,
    biographies: [{ value: lines.join("\n"), contentType: "TEXT_PLAIN" }],
  };
  return body;
}

function squash(s: string): string {
  return s.toLowerCase().replace(/[\s,.\-/]/g, "").replace(/^https?:\/\//, "").replace(/\/$/, "");
}

/** 갱신 때 Card 라벨을 더해야 하는지(이미 있으면 안 함). 기존 'Remember' 등은 건드리지 않는다 */
export function needsCardGroup(p: GPerson, group: string): boolean {
  return !(p.memberships ?? []).some((m) => m.contactGroupMembership?.contactGroupResourceName === group);
}
