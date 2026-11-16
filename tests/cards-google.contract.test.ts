/**
 * 명함 → 구글 연락처: 계약 시험(PO 11/15 — 실계정 대신 가짜 People/Drive).
 * 모든 바깥 요청(googleapis·Supabase·토큰 회수)을 메모리 안 가짜 서버로 보낸다. 다른 주소는 즉시 실패 → 실계정·운영 DB에 닿을 수 없다.
 * 가짜 서버는 구글 문서의 요청·응답 모양을 따른다:
 *  - people.searchContacts / getBatchGet / get / createContact / updateContact(etag 필수·updatePersonFields 칸 통째 교체) / deleteContact
 *  - contactGroups.list / get / create / members.modify
 *  - drive about / files.get / files.create(폴더·multipart 올리기) / files.delete
 *  - PostgREST(card_google_tokens·users·google_accounts), oauth2 revoke
 * 실행: npx tsx --tsconfig tsconfig.json --test tests/cards-google.contract.test.ts
 */
import test from "node:test";
import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import { google } from "googleapis";
import { Gaxios } from "gaxios";
import type { CardFields, GPerson, CardUndo } from "../src/lib/cards-match";

process.env.NEXT_PUBLIC_SUPABASE_URL = "http://fake-supabase.test";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
process.env.GOOGLE_CLIENT_ID = "cid";
process.env.GOOGLE_CLIENT_SECRET = "secret";
process.env.GOOGLE_REDIRECT_URI = "http://localhost/api/google/callback";

const USER = "00000000-0000-0000-0000-00000000c4d5";

// ── 가짜 서버 ──────────────────────────────────────────────────────────────

type Row = Record<string, unknown>;
type Person = GPerson & { etag: string; metadata?: unknown };

class Fake {
  people = new Map<string, Person>();
  groups = new Map<string, { resourceName: string; name: string; groupType: string }>();
  files = new Map<string, { id: string; name: string; parents?: string[]; mimeType?: string; trashed?: boolean }>();
  db: Record<string, Row[]> = { card_google_tokens: [], users: [], google_accounts: [] };
  log: string[] = [];
  revoked: string[] = [];
  hosts = new Set<string>();
  /** 다음 요청 실패시키기: 키 = "METHOD 경로 시작" */
  fail: { key: string; status: number; body?: unknown; times: number }[] = [];
  /** updateContact 직전에 끼어드는 일(etag 충돌 흉내) */
  beforeUpdate: ((rn: string) => void) | null = null;
  seq = 0;

  reset() {
    this.people.clear(); this.groups.clear(); this.files.clear();
    this.db = { card_google_tokens: [], users: [], google_accounts: [] };
    this.log = []; this.revoked = []; this.fail = []; this.beforeUpdate = null;
    for (const g of [["contactGroups/myContacts", "myContacts", "SYSTEM_CONTACT_GROUP"], ["contactGroups/starred", "starred", "SYSTEM_CONTACT_GROUP"]])
      this.groups.set(g[0], { resourceName: g[0], name: g[1], groupType: g[2] });
  }

  etag() { return `%E${++this.seq}`; }

  addPerson(p: Omit<Person, "etag">): Person {
    const full = this.decorate({ ...p, etag: this.etag() });
    this.people.set(p.resourceName, full);
    return full;
  }
  addGroup(name: string) {
    const rn = `contactGroups/g${++this.seq}`;
    this.groups.set(rn, { resourceName: rn, name, groupType: "USER_CONTACT_GROUP" });
    return rn;
  }
  /** 구글처럼 읽기 전용 값(displayName·formattedType·canonicalForm·metadata)을 붙인다 */
  decorate(p: Person): Person {
    const md = { primary: true, source: { type: "CONTACT", id: p.resourceName.split("/")[1] } };
    const out: Person = JSON.parse(JSON.stringify(p));
    out.names = out.names?.map((n) => ({ ...n, displayName: [n.familyName, n.givenName].filter(Boolean).join("") || n.unstructuredName, metadata: md }));
    out.phoneNumbers = out.phoneNumbers?.map((x) => {
      const d = (x.value ?? "").replace(/\D/g, "");
      return { ...x, canonicalForm: d.startsWith("0") ? "+82" + d.slice(1) : "+" + d, formattedType: x.type, metadata: md };
    });
    out.emailAddresses = out.emailAddresses?.map((x) => ({ ...x, formattedType: x.type, metadata: md }));
    out.organizations = out.organizations?.map((x) => ({ ...x, formattedType: x.type, metadata: md }));
    out.biographies = out.biographies?.map((x) => ({ ...x, metadata: md }));
    out.memberships = out.memberships?.map((m) => ({ ...m, metadata: { source: md.source } }));
    out.metadata = { sources: [{ type: "CONTACT", id: md.source.id, etag: out.etag }] };
    return out;
  }
  /** 쓰기 본문에서 읽기 전용 값 빼기(구글이 무시하는 것) */
  strip<T>(v: T): T {
    return JSON.parse(JSON.stringify(v, (k, val) => (["metadata", "displayName", "formattedType", "canonicalForm", "displayNameLastFirst"].includes(k) ? undefined : val)));
  }

  json(status: number, body: unknown) {
    return new Response(status === 204 ? null : JSON.stringify(body ?? {}), { status, headers: { "content-type": "application/json" } });
  }
  gerr(status: number, message: string, st = "FAILED_PRECONDITION") {
    return this.json(status, { error: { code: status, message, status: st } });
  }

  fetch = async (input: unknown, init: RequestInit & { data?: unknown } = {}): Promise<Response> => {
    const req = input instanceof Request ? input : null;
    const url = new URL(req ? req.url : String(input));
    const method = (init.method ?? req?.method ?? "GET").toUpperCase();
    this.hosts.add(url.host);
    const path = decodeURIComponent(url.pathname);
    const key = `${method} ${url.host}${path}`;
    this.log.push(key + (url.search ? "?" + url.searchParams.toString() : ""));
    const f = this.fail.find((x) => key.includes(x.key) && x.times > 0);
    if (f) { f.times--; return this.json(f.status, f.body ?? { error: { code: f.status, message: "injected", status: "INTERNAL" } }); }
    let bodyText = "";
    const b = init.body ?? (req ? await req.text() : undefined);
    if (typeof b === "string") bodyText = b;
    else if (b instanceof URLSearchParams) bodyText = b.toString();
    else if (b instanceof Uint8Array) bodyText = Buffer.from(b).toString("utf8");
    else if (b && typeof (b as unknown as AsyncIterable<unknown>)[Symbol.asyncIterator] === "function") {
      const chunks: Buffer[] = [];
      for await (const c of b as unknown as AsyncIterable<Buffer | string>) chunks.push(Buffer.from(c));
      bodyText = Buffer.concat(chunks).toString("utf8");
    }
    const body = () => (bodyText ? JSON.parse(bodyText) : {});
    const auth = new Headers(init.headers ?? req?.headers ?? {}).get("authorization") ?? "";

    if (url.host === "fake-supabase.test") return this.rest(method, path, url.searchParams, bodyText, new Headers(init.headers ?? {}));
    if (url.host === "oauth2.googleapis.com" && path === "/token") {
      const form = new URLSearchParams(bodyText);
      if (form.get("grant_type") !== "refresh_token" || !form.get("refresh_token")?.startsWith("rt-")) return this.json(400, { error: "invalid_grant" });
      return this.json(200, { access_token: "at-refreshed", expires_in: 3600, token_type: "Bearer" });
    }
    if (url.host === "oauth2.googleapis.com" && path === "/revoke") {
      this.revoked.push(url.searchParams.get("token") ?? "");
      return this.json(200, {});
    }
    if (!/^Bearer at-/.test(auth)) return this.gerr(401, "Request had invalid authentication credentials.", "UNAUTHENTICATED");

    if (url.host === "people.googleapis.com") return this.peopleApi(method, path, url.searchParams, body);
    if (url.host === "www.googleapis.com") return this.driveApi(method, path, url.searchParams, body, bodyText);
    throw new Error("가짜 서버에 없는 주소: " + key);
  };

  peopleApi(method: string, path: string, q: URLSearchParams, body: () => Record<string, unknown>): Response {
    if (method === "GET" && path === "/v1/people:searchContacts") {
      if (!q.get("readMask")) return this.gerr(400, "readMask is required", "INVALID_ARGUMENT");
      const query = (q.get("query") ?? "").toLowerCase();
      if (!query) return this.json(200, {});
      const hit = Array.from(this.people.values()).filter((p) =>
        (p.phoneNumbers ?? []).some((x) => (x.value ?? "").toLowerCase().startsWith(query) || (x.canonicalForm ?? "").startsWith(query)) ||
        (p.emailAddresses ?? []).some((x) => (x.value ?? "").toLowerCase().startsWith(query)) ||
        (p.names ?? []).some((x) => (x.displayName ?? "").toLowerCase().startsWith(query)));
      return this.json(200, hit.length ? { results: hit.map((person) => ({ person })) } : {});
    }
    if (method === "GET" && path === "/v1/people:batchGet") {
      const rns = q.getAll("resourceNames");
      return this.json(200, { responses: rns.map((rn) => (this.people.has(rn) ? { person: this.people.get(rn), requestedResourceName: rn } : { status: { code: 5 }, requestedResourceName: rn })) });
    }
    if (method === "POST" && path === "/v1/people:createContact") {
      const b = body();
      if (b.resourceName || b.etag) return this.gerr(400, "Resource name and etag must be empty", "INVALID_ARGUMENT");
      for (const m of (b.memberships as GPerson["memberships"]) ?? []) {
        const g = m.contactGroupMembership?.contactGroupResourceName;
        if (!g || !this.groups.has(g)) return this.gerr(400, "Contact group not found", "INVALID_ARGUMENT");
      }
      const rn = `people/c${++this.seq}`;
      const p = this.decorate({ ...(this.strip(b) as GPerson), resourceName: rn, etag: this.etag() } as Person);
      p.memberships = [...(p.memberships ?? []), { contactGroupMembership: { contactGroupResourceName: "contactGroups/myContacts" } }];
      this.people.set(rn, p);
      return this.json(200, p);
    }
    let m = path.match(/^\/v1\/(people\/[\w-]+):updateContact$/);
    if (method === "PATCH" && m) {
      const rn = m[1];
      this.beforeUpdate?.(rn);
      const cur = this.people.get(rn);
      if (!cur) return this.gerr(404, "Requested entity was not found.", "NOT_FOUND");
      const b = body();
      const fields = (q.get("updatePersonFields") ?? "").split(",").filter(Boolean);
      if (!fields.length) return this.gerr(400, "updatePersonFields mask is required", "INVALID_ARGUMENT");
      if (b.etag !== cur.etag) return this.gerr(400, "Request person.etag is different than the current person.etag. Clear local cache and get the latest person.", "FAILED_PRECONDITION");
      const next: Person = { ...cur };
      for (const k of fields) (next as Record<string, unknown>)[k] = this.strip((b as Record<string, unknown>)[k] ?? []);
      next.etag = this.etag();
      const out = this.decorate(this.strip(next) as Person);
      out.memberships = cur.memberships;
      this.people.set(rn, out);
      return this.json(200, out);
    }
    m = path.match(/^\/v1\/(people\/[\w-]+):deleteContact$/);
    if (method === "DELETE" && m) {
      if (!this.people.delete(m[1])) return this.gerr(404, "Requested entity was not found.", "NOT_FOUND");
      return this.json(200, {});
    }
    m = path.match(/^\/v1\/(people\/[\w-]+)$/);
    if (method === "GET" && m) {
      const p = this.people.get(m[1]);
      if (!p) return this.gerr(404, "Requested entity was not found.", "NOT_FOUND");
      if (!q.get("personFields")) return this.gerr(400, "personFields mask is required", "INVALID_ARGUMENT");
      return this.json(200, p);
    }
    if (method === "GET" && path === "/v1/contactGroups") return this.json(200, { contactGroups: Array.from(this.groups.values()) });
    if (method === "POST" && path === "/v1/contactGroups") {
      const name = ((body().contactGroup as { name?: string }) ?? {}).name ?? "";
      if (Array.from(this.groups.values()).some((g) => g.name === name)) return this.gerr(409, "Contact group name already exists", "ALREADY_EXISTS");
      const rn = this.addGroup(name);
      return this.json(200, this.groups.get(rn));
    }
    m = path.match(/^\/v1\/(contactGroups\/[\w-]+)\/members:modify$/);
    if (method === "POST" && m) {
      const g = m[1];
      if (!this.groups.has(g)) return this.gerr(404, "Requested entity was not found.", "NOT_FOUND");
      const b = body() as { resourceNamesToAdd?: string[]; resourceNamesToRemove?: string[] };
      for (const rn of b.resourceNamesToAdd ?? []) {
        const p = this.people.get(rn);
        if (!p) continue;
        if (!(p.memberships ?? []).some((x) => x.contactGroupMembership?.contactGroupResourceName === g))
          p.memberships = [...(p.memberships ?? []), { contactGroupMembership: { contactGroupResourceName: g } }];
        p.etag = this.etag();
      }
      for (const rn of b.resourceNamesToRemove ?? []) {
        const p = this.people.get(rn);
        if (!p) continue;
        p.memberships = (p.memberships ?? []).filter((x) => x.contactGroupMembership?.contactGroupResourceName !== g);
        p.etag = this.etag();
      }
      return this.json(200, {});
    }
    m = path.match(/^\/v1\/(contactGroups\/[\w-]+)$/);
    if (method === "GET" && m) return this.groups.has(m[1]) ? this.json(200, this.groups.get(m[1])) : this.gerr(404, "Requested entity was not found.", "NOT_FOUND");
    throw new Error(`가짜 People 에 없는 요청: ${method} ${path}`);
  }

  driveApi(method: string, path: string, q: URLSearchParams, body: () => Record<string, unknown>, raw: string): Response {
    if (method === "GET" && path === "/drive/v3/about") return this.json(200, { user: { emailAddress: "demo@example.test" } });
    if (method === "POST" && path === "/drive/v3/files") {
      const b = body();
      const id = `fold${++this.seq}xxxxxxxx`;
      this.files.set(id, { id, name: String(b.name), mimeType: String(b.mimeType) });
      return this.json(200, { id });
    }
    if (method === "POST" && path === "/upload/drive/v3/files") {
      if (q.get("uploadType") !== "multipart") return this.gerr(400, "uploadType", "INVALID_ARGUMENT");
      const meta = JSON.parse(raw.match(/\r\n\r\n(\{[\s\S]*?\})\r\n/)?.[1] ?? "{}");
      if (!(meta.parents ?? []).every((p: string) => this.files.has(p))) return this.gerr(404, "File not found: parent", "NOT_FOUND");
      if (!raw.includes("image/jpeg")) return this.gerr(400, "media type", "INVALID_ARGUMENT");
      const id = `file${++this.seq}xxxxxxxx`;
      this.files.set(id, { id, name: meta.name, parents: meta.parents });
      return this.json(200, { id, webViewLink: `https://drive.google.com/file/d/${id}/view?usp=drivesdk` });
    }
    let m = path.match(/^\/drive\/v3\/files\/([\w-]+)$/);
    if (method === "GET" && m) {
      const f = this.files.get(m[1]);
      return f ? this.json(200, { id: f.id, trashed: !!f.trashed }) : this.gerr(404, "File not found", "NOT_FOUND");
    }
    m = path.match(/^\/drive\/v3\/files\/([\w-]+)$/);
    if (method === "DELETE" && m) {
      return this.files.delete(m[1]) ? this.json(204, null) : this.gerr(404, "File not found", "NOT_FOUND");
    }
    throw new Error(`가짜 Drive 에 없는 요청: ${method} ${path}`);
  }

  /** PostgREST 최소 흉내: eq 거르기, select·insert(upsert)·update·delete, single */
  rest(method: string, path: string, q: URLSearchParams, raw: string, h: Headers): Response {
    const table = path.replace(/^\/rest\/v1\//, "");
    const rows = this.db[table];
    if (!rows) return this.json(404, { message: "no table " + table });
    const filters = Array.from(q.entries()).filter(([k]) => !["select", "on_conflict", "columns", "order"].includes(k));
    const match = (r: Row) => filters.every(([k, v]) => v.startsWith("eq.") && String(r[k]) === v.slice(3));
    const one = (h.get("accept") ?? "").includes("vnd.pgrst.object");
    const reply = (list: Row[]) => {
      if (!one) return this.json(200, list);
      if (list.length !== 1) return this.json(406, { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned", details: `The result contains ${list.length} rows` });
      return this.json(200, list[0]);
    };
    if (method === "GET") return reply(rows.filter(match));
    if (method === "PATCH") {
      const b = JSON.parse(raw || "{}");
      const hit = rows.filter(match);
      for (const r of hit) Object.assign(r, Object.fromEntries(Object.entries(b).filter(([, v]) => v !== undefined)));
      return reply(hit);
    }
    if (method === "DELETE") {
      const keep = rows.filter((r) => !match(r));
      const gone = rows.length - keep.length;
      this.db[table] = keep;
      return this.json(200, Array(gone).fill({}));
    }
    if (method === "POST") {
      const b = JSON.parse(raw || "{}");
      for (const r of Array.isArray(b) ? b : [b]) {
        const i = rows.findIndex((x) => x.user_id === r.user_id);
        if (i >= 0) Object.assign(rows[i], r); else rows.push({ ...r });
      }
      return this.json(201, []);
    }
    return this.json(405, {});
  }
}

const fake = new Fake();
const realFetch = globalThis.fetch;

let G: typeof import("../src/lib/cards-google");
let M: typeof import("../src/lib/cards-match");

test.before(async () => {
  globalThis.fetch = fake.fetch as typeof fetch;
  google.options({ fetchImplementation: fake.fetch as never });
  // OAuth2 토큰 갱신은 googleapis 옵션을 안 타고 자체 Gaxios(node-fetch)로 나간다 — 그것도 가짜로
  const req = Gaxios.prototype.request;
  Gaxios.prototype.request = function (this: Gaxios, opts: Parameters<typeof req>[0] = {}) {
    return req.call(this, { ...opts, fetchImplementation: fake.fetch as never });
  } as typeof req;
  G = await import("../src/lib/cards-google");
  M = await import("../src/lib/cards-match");
});
test.after(() => {
  globalThis.fetch = realFetch;
  // 실계정·운영 DB 로 나간 요청이 없어야 한다
  assert.deepEqual(Array.from(fake.hosts).filter((h) => !["fake-supabase.test", "people.googleapis.com", "www.googleapis.com", "oauth2.googleapis.com"].includes(h)), []);
});

test.beforeEach(() => {
  fake.reset();
  fake.db.card_google_tokens.push({
    user_id: USER, email: "demo@example.test", access_token: "at-fake", refresh_token: "rt-card",
    token_expiry: new Date(Date.now() + 3600_000).toISOString(), scope: "", drive_folder_id: null, card_group_resource: null,
  });
  fake.db.users.push({ id: USER, google_access_token: "at-cal", google_refresh_token: "rt-cal", google_token_expiry: null });
});

const card = (o: Partial<CardFields> = {}): CardFields => ({
  name: "홍길동", company: "새회사", department: "전략팀", title: "상무",
  mobile: "010-1234-5678", workPhone: "02-555-1234", fax: "02-555-1235",
  emails: ["gildong@newco.kr"], address: "서울 강남구 테헤란로 1", website: "newco.kr", ...o,
});
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const photos = () => [{ side: "앞" as const, data: jpeg, mime: "image/jpeg" }, { side: "뒤" as const, data: jpeg, mime: "image/jpeg" }];
const writes = () => fake.log.filter((l) => /^(POST|PATCH|DELETE) (people|www)/.test(l));
const photoFiles = () => Array.from(fake.files.values()).filter((f) => f.id.startsWith("file"));
const groupsOf = (p: GPerson) => (p.memberships ?? []).map((m) => m.contactGroupMembership?.contactGroupResourceName);

/** 기존 연락처: Remember 라벨, 옛 회사·직함, 메모 */
function seedOld() {
  const remember = fake.addGroup("Remember");
  const old = fake.addPerson({
    resourceName: "people/c900",
    names: [{ givenName: "홍길동 이사(옛회사)" }],
    organizations: [{ name: "옛회사", title: "이사", type: "work" }],
    phoneNumbers: [{ value: "+82 10-1234-5678", type: "mobile" }, { value: "031-777-8888", type: "work" }],
    emailAddresses: [{ value: "gildong@oldco.kr", type: "work" }],
    biographies: [{ value: "2019 행사에서 만남", contentType: "TEXT_PLAIN" }],
    memberships: [{ contactGroupMembership: { contactGroupResourceName: "contactGroups/myContacts" } }, { contactGroupMembership: { contactGroupResourceName: remember } }],
  });
  return { remember, old };
}

// ── 시험 ───────────────────────────────────────────────────────────────────

test("새로 만들기: 표시 이름·회사 칸·전화 종류·Card 라벨·Drive 폴더와 사진 링크", async () => {
  const r = await G.saveCard(USER, card(), { kind: "create" }, [], photos());
  assert.equal(r.ok, true);
  if (!r.ok) return;
  const p = fake.people.get(r.resourceName)!;
  assert.equal(p.names?.[0].givenName, "홍길동 상무(새회사)");
  assert.deepEqual(p.organizations?.map((o) => [o.name, o.title, o.department]), [["새회사", "상무", "전략팀"]]);
  assert.deepEqual(p.phoneNumbers?.map((x) => [x.value, x.type]), [["010-1234-5678", "mobile"], ["02-555-1234", "work"], ["02-555-1235", "workFax"]]);
  assert.deepEqual(p.emailAddresses?.map((x) => x.value), ["gildong@newco.kr"]);
  const card1 = Array.from(fake.groups.values()).find((g) => g.name === "Card")!;
  assert.ok(groupsOf(p).includes(card1.resourceName), "Card 라벨");
  const folder = Array.from(fake.files.values()).find((f) => f.mimeType === "application/vnd.google-apps.folder")!;
  assert.equal(folder.name, "Orbit42 명함");
  const files = photoFiles();
  assert.equal(files.length, 2);
  assert.ok(files.every((f) => f.parents?.[0] === folder.id));
  assert.match(files[0].name, /^\d{4}-\d\d-\d\d 홍길동 새회사 \(앞\)\.jpg$/);
  assert.match(p.biographies?.[0].value ?? "", /^명함\(\d{4}-\d\d-\d\d\): https:\/\/drive\.google\.com\/file\/d\/file\S+ https:\/\/drive\.google\.com\/file\/d\/file\S+$/);
  // 폴더·라벨은 기억해 두고 다음에 다시 만들지 않는다
  const row = fake.db.card_google_tokens[0];
  assert.equal(row.drive_folder_id, folder.id);
  assert.equal(row.card_group_resource, card1.resourceName);
  await G.saveCard(USER, card({ name: "김철수", mobile: "010-2222-3333", emails: ["cs@x.kr"] }), { kind: "create" }, [], photos());
  assert.equal(Array.from(fake.groups.values()).filter((g) => g.name === "Card").length, 1);
  assert.equal(Array.from(fake.files.values()).filter((f) => f.mimeType?.includes("folder")).length, 1);
});

test("이미 있는 'Card' 라벨은 새로 만들지 않고 쓴다", async () => {
  const existing = fake.addGroup("Card");
  const r = await G.saveCard(USER, card(), { kind: "create" }, [], []);
  assert.ok(r.ok);
  if (r.ok) assert.ok(groupsOf(fake.people.get(r.resourceName)!).includes(existing));
  assert.equal(fake.log.some((l) => l.startsWith("POST people.googleapis.com/v1/contactGroups")), false);
});

test("갱신: 이전 명함 메모·전화/메일 합치기(안 지움)·Card 더하기·Remember 유지", async () => {
  const { remember, old } = seedOld();
  const cands = await G.matchCard(USER, card());
  assert.deepEqual(cands.map((c) => [c.person.resourceName, c.reasons, c.nameDiffers]), [["people/c900", ["mobile"], false]]);
  assert.deepEqual(M.defaultChoice(cands), { kind: "update", resourceName: "people/c900" });
  const r = await G.saveCard(USER, card(), { kind: "update", resourceName: old.resourceName }, ["people/c900"], photos());
  assert.ok(r.ok && r.kind === "updated");
  const p = fake.people.get("people/c900")!;
  assert.equal(p.names?.[0].givenName, "홍길동 상무(새회사)");
  assert.deepEqual(p.organizations?.map((o) => [o.name, o.title]), [["새회사", "상무"]]);
  const phones = p.phoneNumbers!.map((x) => x.value);
  assert.deepEqual(phones.slice(0, 1), ["010-1234-5678"]);
  assert.ok(phones.includes("031-777-8888"), "옛 회사전화 그대로");
  assert.equal(phones.filter((v) => v?.replace(/\D/g, "").endsWith("12345678")).length, 1, "같은 휴대폰은 한 번만");
  assert.deepEqual(p.emailAddresses!.map((x) => x.value).sort(), ["gildong@newco.kr", "gildong@oldco.kr"]);
  const note = p.biographies![0].value!.split("\n");
  assert.equal(note[0], "2019 행사에서 만남");
  assert.match(note[1], /^이전 명함: 옛회사 이사\(\d{4}-\d\d\)$/);
  assert.match(note[2], /^명함\(\d{4}-\d\d-\d\d\): /);
  const g = groupsOf(p);
  const cardG = Array.from(fake.groups.values()).find((x) => x.name === "Card")!.resourceName;
  assert.ok(g.includes(remember), "Remember 유지");
  assert.ok(g.includes(cardG), "Card 더함");
  assert.ok(g.includes("contactGroups/myContacts"));
});

test("같은 명함 두 번째 갱신: 이전 명함 줄을 또 늘리지 않음, Card 라벨 다시 붙이지 않음", async () => {
  const { old } = seedOld();
  await G.saveCard(USER, card(), { kind: "update", resourceName: old.resourceName }, ["people/c900"], []);
  fake.log = [];
  const r = await G.saveCard(USER, card(), { kind: "update", resourceName: old.resourceName }, ["people/c900"], []);
  assert.ok(r.ok);
  if (r.ok) assert.equal(r.undo.groupAdded, null);
  const note = fake.people.get("people/c900")!.biographies![0].value!;
  assert.equal(note.match(/이전 명함/g)?.length, 1);
  assert.equal(fake.log.some((l) => l.includes("members:modify")), false);
});

test("이름이 다른 후보: 휴대폰은 같아도 nameDiffers — 자동 선택은 새로 만들기", async () => {
  seedOld();
  const cands = await G.matchCard(USER, card({ name: "김영희" }));
  assert.equal(cands.length, 1);
  assert.equal(cands[0].nameDiffers, true);
  assert.deepEqual(M.defaultChoice(cands), { kind: "create" });
});

test("저장 직전 새 후보(409): 화면에서 못 본 후보가 생기면 아무것도 쓰지 않는다", async () => {
  seedOld();
  const r = await G.saveCard(USER, card(), { kind: "create" }, [], photos());
  assert.deepEqual(r.ok ? null : r.reason, "new_candidates");
  assert.deepEqual(writes(), []);
  assert.equal(photoFiles().length, 0);
});

test("후보가 아닌 연락처로 갱신 요청: 쓰지 않는다", async () => {
  seedOld();
  fake.addPerson({ resourceName: "people/c901", names: [{ givenName: "남남" }], phoneNumbers: [{ value: "010-9999-0000" }] });
  const r = await G.saveCard(USER, card(), { kind: "update", resourceName: "people/c901" }, ["people/c900"], photos());
  assert.deepEqual(r.ok ? null : r.reason, "not_candidate");
  assert.deepEqual(writes(), []);
  assert.equal(fake.people.get("people/c901")!.names?.[0].givenName, "남남");
});

test("etag 충돌: 읽은 뒤 다른 곳에서 고쳐졌으면 덮어쓰지 않고, 올린 사진도 지운다", async () => {
  const { old } = seedOld();
  fake.beforeUpdate = (rn) => {
    const p = fake.people.get(rn)!;
    p.biographies = [{ value: "휴대폰에서 방금 고침" }];
    p.etag = fake.etag();
    fake.beforeUpdate = null;
  };
  await assert.rejects(G.saveCard(USER, card(), { kind: "update", resourceName: old.resourceName }, ["people/c900"], photos()));
  const p = fake.people.get("people/c900")!;
  assert.equal(p.biographies?.[0].value, "휴대폰에서 방금 고침");
  assert.equal(p.names?.[0].givenName, "홍길동 이사(옛회사)");
  assert.equal(photoFiles().length, 0, "올린 사진 지움");
  assert.equal(fake.db.card_google_tokens.length, 1, "연결은 그대로");
});

test("Drive 실패 → 연락처를 쓰지 않음(먼저 올린 사진도 지움)", async () => {
  // 두 번째 사진만 실패
  let n = 0;
  const orig = fake.driveApi.bind(fake);
  fake.driveApi = (m, p, q, b, raw) => (m === "POST" && p.startsWith("/upload") && ++n === 2 ? fake.gerr(500, "backendError", "INTERNAL") : orig(m, p, q, b, raw));
  try {
    await assert.rejects(G.saveCard(USER, card(), { kind: "create" }, [], photos()));
  } finally {
    fake.driveApi = orig;
  }
  assert.equal(fake.people.size, 0, "연락처 안 씀");
  assert.equal(photoFiles().length, 0, "먼저 올린 앞면도 지움");
  assert.equal(fake.log.some((l) => l.includes("createContact")), false);
});

test("연락처 쓰기 실패 → Drive 사진 지움", async () => {
  fake.fail.push({ key: "POST people.googleapis.com/v1/people:createContact", status: 500, times: 1 });
  await assert.rejects(G.saveCard(USER, card(), { kind: "create" }, [], photos()));
  assert.equal(fake.people.size, 0);
  assert.equal(photoFiles().length, 0);
  assert.equal(fake.log.filter((l) => l.startsWith("DELETE www.googleapis.com/drive/v3/files/file")).length, 2);
});

test("갱신은 됐는데 라벨만 실패 → 저장은 그대로, 사진도 남김(메모에 링크가 있으므로)", async () => {
  const { old } = seedOld();
  fake.fail.push({ key: "members:modify", status: 500, times: 1 });
  const r = await G.saveCard(USER, card(), { kind: "update", resourceName: old.resourceName }, ["people/c900"], photos());
  assert.ok(r.ok);
  if (r.ok) assert.equal(r.undo.groupAdded, null);
  assert.equal(photoFiles().length, 2);
  assert.equal(fake.people.get("people/c900")!.names?.[0].givenName, "홍길동 상무(새회사)");
});

test("검색 색인 지연: 방금 만든 연락처는 recent 로 찾는다", async () => {
  const r = await G.saveCard(USER, card(), { kind: "create" }, [], []);
  assert.ok(r.ok);
  if (!r.ok) return;
  // 색인에 아직 없다고 치고 검색을 비운다
  fake.fail.push({ key: "GET people.googleapis.com/v1/people:searchContacts", status: 200, body: {}, times: 99 });
  const none = await G.matchCard(USER, card());
  assert.equal(none.length, 0);
  const viaRecent = await G.matchCard(USER, card(), [r.resourceName]);
  assert.deepEqual(viaRecent.map((c) => c.person.resourceName), [r.resourceName]);
});

// ── 되돌리기 ─────────────────────────────────────────────────────────────

/** 앱이 기기에 두었다가 돌려주는 것처럼 JSON 왕복 + 검사 */
const roundTrip = (u: CardUndo) => M.parseUndo(JSON.parse(JSON.stringify(u)))!;

test("되돌리기(새로 만든 것): 연락처와 Drive 사진을 지운다", async () => {
  const r = await G.saveCard(USER, card(), { kind: "create" }, [], photos());
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.undo.fileIds.length, 2);
  const u = await G.undoCard(USER, roundTrip(r.undo));
  assert.deepEqual(u, { ok: true });
  assert.equal(fake.people.has(r.resourceName), false);
  assert.equal(photoFiles().length, 0);
  // 두 번 눌러도 문제없음(이미 없음)
  assert.deepEqual(await G.undoCard(USER, roundTrip(r.undo)), { ok: true });
});

test("되돌리기(갱신한 것): 갱신 전 값으로, 이번에 붙인 Card 만 떼고 Remember 는 그대로, 사진 지움", async () => {
  const { remember, old } = seedOld();
  const before = M.fieldsFingerprint(fake.people.get("people/c900")!);
  const r = await G.saveCard(USER, card(), { kind: "update", resourceName: old.resourceName }, ["people/c900"], photos());
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.ok(r.undo.groupAdded);
  const u = await G.undoCard(USER, roundTrip(r.undo));
  assert.deepEqual(u, { ok: true });
  const p = fake.people.get("people/c900")!;
  assert.equal(M.fieldsFingerprint(p), before, "갱신 전 값과 같음");
  assert.equal(p.names?.[0].givenName, "홍길동 이사(옛회사)");
  assert.equal(p.biographies?.[0].value, "2019 행사에서 만남");
  assert.deepEqual(p.phoneNumbers?.map((x) => x.type), ["mobile", "work"]);
  const g = groupsOf(p);
  assert.ok(g.includes(remember));
  assert.equal(g.includes(r.undo.groupAdded), false);
  assert.equal(photoFiles().length, 0);
});

test("되돌리기: 이미 Card 라벨이 있던 사람은 라벨을 떼지 않는다", async () => {
  const { old } = seedOld();
  await G.saveCard(USER, card(), { kind: "update", resourceName: old.resourceName }, ["people/c900"], []);
  const r = await G.saveCard(USER, card({ title: "부사장" }), { kind: "update", resourceName: old.resourceName }, ["people/c900"], []);
  assert.ok(r.ok);
  if (!r.ok) return;
  await G.undoCard(USER, roundTrip(r.undo));
  const cardG = Array.from(fake.groups.values()).find((x) => x.name === "Card")!.resourceName;
  assert.ok(groupsOf(fake.people.get("people/c900")!).includes(cardG));
  assert.equal(fake.people.get("people/c900")!.organizations?.[0].title, "상무");
});

test("되돌리기: 저장한 뒤 휴대폰에서 고쳤으면 손대지 않는다(새로 만든 것·갱신한 것 모두)", async () => {
  const r1 = await G.saveCard(USER, card({ name: "김철수", mobile: "010-2222-3333", emails: ["cs@x.kr"] }), { kind: "create" }, [], photos());
  assert.ok(r1.ok);
  if (!r1.ok) return;
  const p1 = fake.people.get(r1.resourceName)!;
  p1.phoneNumbers = [...(p1.phoneNumbers ?? []), { value: "010-4444-5555", type: "mobile" }];
  p1.etag = fake.etag();
  assert.deepEqual(await G.undoCard(USER, roundTrip(r1.undo)), { ok: false, reason: "changed" });
  assert.ok(fake.people.has(r1.resourceName));
  assert.equal(photoFiles().length, 2, "사진도 그대로");

  const { old } = seedOld();
  const r2 = await G.saveCard(USER, card(), { kind: "update", resourceName: old.resourceName }, ["people/c900"], []);
  assert.ok(r2.ok);
  if (!r2.ok) return;
  fake.people.get("people/c900")!.biographies = [{ value: "직접 쓴 메모" }];
  assert.deepEqual(await G.undoCard(USER, roundTrip(r2.undo)), { ok: false, reason: "changed" });
  assert.equal(fake.people.get("people/c900")!.biographies?.[0].value, "직접 쓴 메모");
});

test("되돌리기: 라벨 붙이기만으로 바뀐 etag 는 '고침'으로 보지 않는다", async () => {
  const { old } = seedOld();
  const r = await G.saveCard(USER, card(), { kind: "update", resourceName: old.resourceName }, ["people/c900"], []);
  assert.ok(r.ok);
  if (!r.ok) return;
  fake.addGroup("다른라벨");
  fake.people.get("people/c900")!.etag = fake.etag();
  assert.deepEqual(await G.undoCard(USER, roundTrip(r.undo)), { ok: true });
});

test("되돌리기 정보 검사: 모양이 틀리면 거절", () => {
  assert.equal(M.parseUndo({ kind: "created", resourceName: "people/../x", after: "", fileIds: [] }), null);
  assert.equal(M.parseUndo({ kind: "updated", resourceName: "people/c1", after: "{}", fileIds: [], groupAdded: null }), null, "갱신인데 before 없음");
  assert.equal(M.parseUndo({ kind: "created", resourceName: "people/c1", after: "{}", fileIds: ["../../x"] }), null);
  assert.equal(M.parseUndo({ kind: "created", resourceName: "people/c1", after: "{}", fileIds: [], groupAdded: "x" }), null);
  assert.ok(M.parseUndo({ kind: "created", resourceName: "people/c1", after: "{}", fileIds: [], groupAdded: null }));
});

// ── 연결 해제 ────────────────────────────────────────────────────────────

test("해제(기본): 명함 토큰만 지운다 — 구글 회수 없음, 캘린더 그대로", async () => {
  await G.disconnectCards(USER, false);
  assert.equal(fake.db.card_google_tokens.length, 0);
  assert.deepEqual(fake.revoked, []);
  assert.equal(fake.db.users[0].google_refresh_token, "rt-cal");
});

test("모두 회수: 구글에 회수 요청 + 명함 토큰 삭제, 죽은 캘린더 토큰만 정리", async () => {
  fake.db.google_accounts.push({ id: "ga-1", user_id: USER, refresh_token: "rt-other-alive" });
  await G.disconnectCards(USER, true);
  assert.deepEqual(fake.revoked, ["rt-card"]);
  assert.equal(fake.db.card_google_tokens.length, 0);
  // 같은 구글 계정의 캘린더 토큰은 함께 죽고(invalid_grant), 다른 계정 것은 살아 있다
  const proto = google.auth.OAuth2.prototype as unknown as { getAccessToken: () => Promise<unknown> };
  const orig = proto.getAccessToken;
  proto.getAccessToken = async function (this: { credentials: { refresh_token?: string } }) {
    if (this.credentials.refresh_token === "rt-cal") throw new Error("invalid_grant");
    return { token: "ok" };
  };
  try {
    await G.clearRevokedCalendarTokens(USER);
  } finally {
    proto.getAccessToken = orig;
  }
  assert.equal(fake.db.users[0].google_refresh_token, null);
  assert.equal(fake.db.google_accounts.length, 1, "다른 구글 계정 연결은 그대로");
});

test("구글에서 권한을 없앤 경우(invalid_grant): 토큰을 지우고 '다시 연결'", async () => {
  fake.fail.push({ key: "searchContacts", status: 400, body: { error: "invalid_grant", error_description: "Token has been expired or revoked." }, times: 99 });
  await assert.rejects(G.matchCard(USER, card()), G.CardsNotConnected);
  assert.equal(fake.db.card_google_tokens.length, 0);
});

test("연결 안 됨: 아무 요청 없이 CardsNotConnected", async () => {
  fake.db.card_google_tokens = [];
  await assert.rejects(G.saveCard(USER, card(), { kind: "create" }, [], photos()), G.CardsNotConnected);
  assert.deepEqual(writes(), []);
});

// ── 토큰 암호화(GOOGLE_TOKEN_KEY 켜짐, PO 11/16) ───────────────────────────────

test("암호화 켜짐: 저장은 암호문만, 명함 저장·자동 갱신·회수는 같은 모듈로 풀어서", async () => {
  const T = await import("../src/lib/google-tokens");
  process.env.GOOGLE_TOKEN_KEY = randomBytes(32).toString("base64");
  try {
    // 연결 직후 저장 → 암호문
    fake.db.card_google_tokens = [];
    await G.saveCardTokens(USER, { access_token: "at-new", refresh_token: "rt-card2", expiry_date: Date.now() - 1000, scope: "x" });
    const row = fake.db.card_google_tokens[0];
    assert.ok(T.isSealed(row.access_token as string) && T.isSealed(row.refresh_token as string), "평문 저장");
    assert.ok(!JSON.stringify(fake.db).includes("rt-card2"));
    // 만료 → 자동 갱신 → 새 access 토큰도 암호문으로
    const r = await G.saveCard(USER, card(), { kind: "create" }, [], []);
    assert.equal(r.ok, true);
    assert.ok(fake.log.some((l) => l.startsWith("POST oauth2.googleapis.com/token")), "갱신 안 함");
    await new Promise((res) => setTimeout(res, 50)); // tokens 이벤트 저장은 기다리지 않는다
    const after = fake.db.card_google_tokens[0];
    assert.ok(T.isSealed(after.access_token as string));
    assert.equal(T.openToken(after.access_token as string, "card_google_tokens", "access", USER), "at-refreshed");
    // 회수는 풀어서 원래 토큰으로
    await G.disconnectCards(USER, true);
    assert.deepEqual(fake.revoked, ["rt-card2"]);
  } finally {
    delete process.env.GOOGLE_TOKEN_KEY;
  }
});

test("키가 없는데 암호문 행: 연결 없음으로(요청 없음), 행은 지우지 않음", async () => {
  const T = await import("../src/lib/google-tokens");
  process.env.GOOGLE_TOKEN_KEY = randomBytes(32).toString("base64");
  fake.db.card_google_tokens[0].refresh_token = T.sealToken("rt-card", "card_google_tokens", "refresh", USER);
  delete process.env.GOOGLE_TOKEN_KEY;
  await assert.rejects(G.saveCard(USER, card(), { kind: "create" }, [], photos()), G.CardsNotConnected);
  assert.deepEqual(writes(), []);
  assert.equal(fake.db.card_google_tokens.length, 1);
});
