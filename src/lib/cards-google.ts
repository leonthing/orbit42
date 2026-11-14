import { google, type people_v1 } from "googleapis";
import { Readable } from "node:stream";
import { getAdminClient } from "@/lib/supabase";
import { logCardsError } from "@/lib/cards-log";
import { getOAuth2Client, revokeGoogleToken, deleteExtraGoogleAccount } from "@/lib/google";
import {
  type CardFields,
  type GPerson,
  type Candidate,
  searchQueries,
  findCandidates,
  buildCreate,
  buildUpdate,
  needsCardGroup,
  UPDATE_FIELDS,
} from "@/lib/cards-match";

/**
 * 명함 → 구글 연락처(1차, Leo 전용). 구글 권한은 로그인·캘린더와 따로, 명함 기능에서만 묻는다.
 * 범위는 연락처 쓰기와 drive.file(앱이 만든 파일만) 둘뿐. include_granted_scopes 는 쓰지 않는다 —
 * 옛 동의로 남은 범위(contacts.readonly·gmail.send 등)가 명함 토큰에 따라 붙지 않게.
 * 토큰은 card_google_tokens(서버 전용 표)에 저장한다. 명함 사진·글자는 어디에도 남기지 않는다.
 */
export const CARD_SCOPES = [
  "https://www.googleapis.com/auth/contacts",
  "https://www.googleapis.com/auth/drive.file",
];
export const CARD_FOLDER_NAME = "Orbit42 명함";
export const CARD_GROUP_NAME = "Card";

export function getCardAuthUrl(state: string, loginHint?: string) {
  return getOAuth2Client().generateAuthUrl({
    access_type: "offline",
    scope: CARD_SCOPES,
    prompt: "consent",
    state,
    login_hint: loginHint,
  });
}

/** 받은 범위 확인 — 둘 다 있어야 연결. 요청하지 않은 범위가 붙었는지도 돌려준다(PO 확인 항목) */
export function checkCardScopes(scope: string | null | undefined): { ok: boolean; extra: string[] } {
  const granted = new Set((scope ?? "").split(/\s+/).filter(Boolean));
  const ok = CARD_SCOPES.every((s) => granted.has(s));
  const extra = Array.from(granted).filter((s) => !CARD_SCOPES.includes(s));
  return { ok, extra };
}

type Tokens = { access_token?: string | null; refresh_token?: string | null; expiry_date?: number | null; scope?: string | null };

/** 연결 직후 — 저장 계정 주소는 Drive about(drive.file 로 읽힘)에서 */
export async function saveCardTokens(userId: string, tokens: Tokens) {
  if (!tokens.refresh_token) throw new Error("no refresh token");
  const auth = getOAuth2Client();
  auth.setCredentials({ access_token: tokens.access_token, refresh_token: tokens.refresh_token });
  let email: string | null = null;
  try {
    const about = await google.drive({ version: "v3", auth }).about.get({ fields: "user(emailAddress)" });
    email = about.data.user?.emailAddress ?? null;
  } catch (e) {
    logCardsError("about", e);
  }
  const db = getAdminClient();
  const { data: prev } = await db.from("card_google_tokens").select("refresh_token, email").eq("user_id", userId).maybeSingle();
  const row = {
    user_id: userId,
    email,
    access_token: tokens.access_token ?? null,
    refresh_token: tokens.refresh_token,
    token_expiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
    scope: tokens.scope ?? null,
    updated_at: new Date().toISOString(),
    // 다른 구글 계정으로 다시 연결하면 폴더·그룹은 그 계정에서 새로 찾는다
    ...(prev && prev.email !== email ? { drive_folder_id: null, card_group_resource: null } : {}),
  };
  const { error } = await db.from("card_google_tokens").upsert(row, { onConflict: "user_id" });
  if (error) throw error;
  return { email };
}

export async function cardStatus(userId: string): Promise<{ connected: boolean; email: string | null }> {
  const { data } = await getAdminClient().from("card_google_tokens").select("email").eq("user_id", userId).maybeSingle();
  return { connected: !!data, email: data?.email ?? null };
}

/**
 * 연결 해제. 기본은 Orbit42 에 있는 명함 토큰만 지운다(캘린더 연결 그대로).
 * revokeAll: 구글 쪽 권한까지 회수 — 구글은 같은 앱의 권한을 한 묶음으로 회수하므로 캘린더 연결도 끊긴다.
 */
export async function disconnectCards(userId: string, revokeAll: boolean) {
  const db = getAdminClient();
  const { data } = await db.from("card_google_tokens").select("refresh_token").eq("user_id", userId).maybeSingle();
  if (revokeAll && data?.refresh_token) await revokeGoogleToken(data.refresh_token);
  await db.from("card_google_tokens").delete().eq("user_id", userId);
}

/**
 * '모두 회수' 뒤 — 같은 구글 계정의 캘린더 토큰도 구글에서 죽었으면 지워서 '연결됨인데 안 되는' 상태를 막는다.
 * 다른 구글 계정의 연결은 살아 있으므로, 실제로 갱신이 거절(invalid_grant)되는 것만 지운다.
 */
export async function clearRevokedCalendarTokens(userId: string) {
  const db = getAdminClient();
  const dead = async (refresh: string | null | undefined) => {
    if (!refresh) return false;
    const a = getOAuth2Client();
    a.setCredentials({ refresh_token: refresh });
    try { await a.getAccessToken(); return false; } catch (e) { return /invalid_grant/i.test(String((e as Error)?.message ?? e)); }
  };
  // 회수는 비동기로 퍼지므로 잠깐 기다린다
  await new Promise((r) => setTimeout(r, 1500));
  const { data: u } = await db.from("users").select("google_refresh_token").eq("id", userId).single();
  if (await dead(u?.google_refresh_token)) {
    await db.from("users").update({ google_access_token: null, google_refresh_token: null, google_token_expiry: null }).eq("id", userId);
  }
  const { data: extras } = await db.from("google_accounts").select("id, refresh_token").eq("user_id", userId);
  for (const x of extras ?? []) if (await dead(x.refresh_token)) await deleteExtraGoogleAccount(x.id, userId).catch(() => undefined);
}

type Conn = {
  auth: InstanceType<typeof google.auth.OAuth2>;
  people: people_v1.People;
  row: { drive_folder_id: string | null; card_group_resource: string | null };
};

export class CardsNotConnected extends Error {}

async function connect(userId: string): Promise<Conn> {
  const db = getAdminClient();
  const { data } = await db
    .from("card_google_tokens")
    .select("access_token, refresh_token, token_expiry, drive_folder_id, card_group_resource")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data?.refresh_token) throw new CardsNotConnected();
  const auth = getOAuth2Client();
  auth.setCredentials({
    access_token: data.access_token ?? undefined,
    refresh_token: data.refresh_token,
    expiry_date: data.token_expiry ? new Date(data.token_expiry).getTime() : undefined,
  });
  auth.on("tokens", (t) => {
    void db
      .from("card_google_tokens")
      .update({
        access_token: t.access_token,
        token_expiry: t.expiry_date ? new Date(t.expiry_date).toISOString() : undefined,
        ...(t.refresh_token ? { refresh_token: t.refresh_token } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .then(({ error }) => error && logCardsError("token persist", { name: "DbError", code: error.code }));
  });
  return { auth, people: google.people({ version: "v1", auth }), row: data };
}

/** 사용자가 구글에서 권한을 없앤 경우(invalid_grant) — 토큰을 지우고 '다시 연결' 로 안내 */
export async function handleGoogleError(userId: string, e: unknown): Promise<never> {
  const msg = String((e as { message?: string })?.message ?? e);
  if (/invalid_grant|unauthorized_client/i.test(msg)) {
    await getAdminClient().from("card_google_tokens").delete().eq("user_id", userId);
    throw new CardsNotConnected();
  }
  throw e;
}

const READ_MASK = "names,organizations,phoneNumbers,emailAddresses,addresses,urls,biographies,memberships,metadata";

/** 검색 색인 깨우기(구글 권장: 검색 전에 빈 질의 한 번) — 앱이 스캔 화면을 열 때 부른다 */
export async function warmupSearch(userId: string) {
  const c = await connect(userId);
  await c.people.people.searchContacts({ query: "", readMask: "names" }).catch(() => undefined);
}

/** 같은 사람 후보 찾기 — 그때그때 searchContacts(캐시 없음). 질의는 동시에 */
export async function matchCard(userId: string, card: CardFields): Promise<Candidate[]> {
  const c = await connect(userId);
  try {
    const qs = searchQueries(card);
    const res = await Promise.all(
      qs.map((query) =>
        c.people.people.searchContacts({ query, readMask: READ_MASK, pageSize: 30 }).then((r) => r.data.results ?? []),
      ),
    );
    const found = res.flat().map((r) => r.person as GPerson).filter(Boolean);
    return findCandidates(card, found);
  } catch (e) {
    return handleGoogleError(userId, e);
  }
}

async function ensureFolder(userId: string, c: Conn): Promise<string> {
  const drive = google.drive({ version: "v3", auth: c.auth });
  if (c.row.drive_folder_id) {
    const ok = await drive.files
      .get({ fileId: c.row.drive_folder_id, fields: "id, trashed" })
      .then((r) => !r.data.trashed)
      .catch(() => false);
    if (ok) return c.row.drive_folder_id;
  }
  const f = await drive.files.create({
    requestBody: { name: CARD_FOLDER_NAME, mimeType: "application/vnd.google-apps.folder" },
    fields: "id",
  });
  const id = f.data.id!;
  await getAdminClient().from("card_google_tokens").update({ drive_folder_id: id }).eq("user_id", userId);
  c.row.drive_folder_id = id;
  return id;
}

async function ensureGroup(userId: string, c: Conn): Promise<string> {
  if (c.row.card_group_resource) {
    const ok = await c.people.contactGroups
      .get({ resourceName: c.row.card_group_resource, maxMembers: 0 })
      .then(() => true)
      .catch(() => false);
    if (ok) return c.row.card_group_resource;
  }
  // 이미 'Card' 라벨이 있으면 그것을 쓴다
  const list = await c.people.contactGroups.list({ pageSize: 1000, groupFields: "name,groupType" });
  let rn = (list.data.contactGroups ?? []).find((g) => g.groupType === "USER_CONTACT_GROUP" && g.name === CARD_GROUP_NAME)?.resourceName;
  if (!rn) {
    const g = await c.people.contactGroups.create({ requestBody: { contactGroup: { name: CARD_GROUP_NAME } } });
    rn = g.data.resourceName!;
  }
  await getAdminClient().from("card_google_tokens").update({ card_group_resource: rn }).eq("user_id", userId);
  c.row.card_group_resource = rn;
  return rn;
}

export type CardPhoto = { side: "앞" | "뒤"; data: Buffer; mime: string };

export type SaveChoice = { kind: "create" } | { kind: "update"; resourceName: string };

export type SaveResult =
  | { ok: true; kind: "created" | "updated"; resourceName: string; name: string }
  | { ok: false; reason: "new_candidates"; candidates: Candidate[] }
  | { ok: false; reason: "not_candidate" };

function kstToday(): string {
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
}

/**
 * 저장('저장'을 눌렀을 때만 불린다).
 * 저장 직전에 다시 찾아, 화면에서 못 본 후보가 새로 생겼으면 쓰지 않고 돌려준다(seen = 화면에 보인 후보).
 * 갱신은 그 사람이 지금도 후보일 때만(번호·메일로 묶인 사람) — 아무 연락처나 덮어쓰지 않게.
 * 사진은 Drive 에 먼저 올리고, 연락처 쓰기가 실패하면 올린 사진을 지운다.
 */
export async function saveCard(
  userId: string,
  card: CardFields,
  choice: SaveChoice,
  seen: string[],
  photos: CardPhoto[],
): Promise<SaveResult> {
  const c = await connect(userId);
  const uploaded: string[] = [];
  const drive = google.drive({ version: "v3", auth: c.auth });
  try {
    const cands = await matchCard(userId, card);
    const unseen = cands.filter((x) => !seen.includes(x.person.resourceName));
    if (unseen.length) return { ok: false, reason: "new_candidates", candidates: cands };
    const target = choice.kind === "update" ? cands.find((x) => x.person.resourceName === choice.resourceName) : null;
    if (choice.kind === "update" && !target) return { ok: false, reason: "not_candidate" };

    const today = kstToday();
    const links: string[] = [];
    if (photos.length) {
      const folder = await ensureFolder(userId, c);
      const base = [today, card.name.trim(), card.company.trim()].filter(Boolean).join(" ").replace(/[\\/:*?"<>|]/g, " ");
      for (const p of photos) {
        const f = await drive.files.create({
          requestBody: { name: `${base} (${p.side}).jpg`, parents: [folder] },
          media: { mimeType: p.mime, body: Readable.from(p.data) },
          fields: "id, webViewLink",
        });
        uploaded.push(f.data.id!);
        links.push(f.data.webViewLink ?? `https://drive.google.com/file/d/${f.data.id}/view`);
      }
    }
    const group = await ensureGroup(userId, c);
    const opts = { photoLinks: links, today, cardGroup: group };

    if (choice.kind === "create") {
      const r = await c.people.people.createContact({ requestBody: buildCreate(card, opts) as people_v1.Schema$Person, personFields: "names" });
      return { ok: true, kind: "created", resourceName: r.data.resourceName!, name: r.data.names?.[0]?.displayName ?? card.name };
    }
    // 갱신: 최신 etag 로 다시 읽고 쓴다
    const fresh = await c.people.people.get({ resourceName: choice.resourceName, personFields: READ_MASK });
    const body = buildUpdate(fresh.data as GPerson, card, opts);
    const r = await c.people.people.updateContact({
      resourceName: choice.resourceName,
      updatePersonFields: UPDATE_FIELDS,
      personFields: "names",
      requestBody: body as people_v1.Schema$Person,
    });
    if (needsCardGroup(fresh.data as GPerson, group)) {
      await c.people.contactGroups.members.modify({
        resourceName: group,
        requestBody: { resourceNamesToAdd: [choice.resourceName] },
      });
    }
    return { ok: true, kind: "updated", resourceName: choice.resourceName, name: r.data.names?.[0]?.displayName ?? card.name };
  } catch (e) {
    for (const id of uploaded) await drive.files.delete({ fileId: id }).catch(() => undefined);
    return handleGoogleError(userId, e);
  }
}

/** 화면용 후보 요약(메모·주소 등은 보내지 않음) */
export function candidateView(x: Candidate) {
  const p = x.person;
  return {
    resourceName: p.resourceName,
    name: x.name,
    company: p.organizations?.[0]?.name ?? "",
    title: p.organizations?.[0]?.title ?? "",
    phones: (p.phoneNumbers ?? []).map((n) => n.value ?? "").filter(Boolean).slice(0, 4),
    emails: (p.emailAddresses ?? []).map((n) => n.value ?? "").filter(Boolean).slice(0, 3),
    reasons: x.reasons,
    nameDiffers: x.nameDiffers,
  };
}
