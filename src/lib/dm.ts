// 일반 서버 모듈 — 서버 액션 아님(보안-6). 웹 액션은 messages-actions.ts, 앱은 /api/v1/dm.
/**
 * 회원 사이 1:1 대화 (1.9.0, 설계: 업무기록/설계_1.9.0_1대1대화.md).
 * - 바로 대화: 서로 팔로우 또는 두 사람 사이에 확정·완료된 예약(계정 있는 게스트)이 있을 때.
 * - 그 밖에는 대화 요청: 첫 글 1개와 함께. 받는 사람이 수락하면 열린다. 거절은 보낸 사람에게 '아직 답이 없어요'로만 보인다.
 * - 하루 요청 5건(KST), 거절된 상대에게 30일 동안 다시 요청 못 함, 수락되지 않은 요청은 30일 뒤 정리.
 * - 차단(어느 쪽이든) → 시작·요청·보내기 막고 목록에서 숨김. 나가기 → 내 쪽 그 전 글 숨김, 둘 다 나가면 정리.
 * - 알림: 앱 안 알림 + 푸시(60초 간격, "새 메시지가 있어요"). 메일은 5분 cron(본문 없이). 요청은 앱 안 알림만.
 * - 시행일(11/20) 전에는 v190Open() 이 false 라 모든 함수가 거절한다.
 */
import { getAdminClient } from "@/lib/supabase";
import { V190_CLOSED_MESSAGE, v190Open, v190OpenFor, v190OpenPair } from "@/lib/dm-flags";

import { DM_MAX_LEN } from "@/lib/dm-limits";
export { DM_MAX_LEN };
export const DM_DAILY_REQUESTS = 5;
export const DM_REQUEST_TTL_MS = 30 * 24 * 3600_000;
export const DM_RETENTION_MS = 365 * 24 * 3600_000;
export const DM_PUSH_BODY = "새 메시지가 있어요";
const PUSH_GAP_MS = 60_000;

export type DmStatus = "open" | "requested" | "declined";
/** 보는 사람 기준 상태: open 대화 / incoming 받은 요청 / pending 내가 보낸 요청(거절돼도 이렇게 보인다) */
export type DmView = "open" | "incoming" | "pending";

export type DmRow = {
  id: string;
  user_a: string;
  user_b: string;
  status: DmStatus;
  requested_by: string | null;
  requested_at: string | null;
  accepted_at: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  last_sender_id: string | null;
  a_last_read_at: string | null;
  b_last_read_at: string | null;
  a_left_at: string | null;
  b_left_at: string | null;
  a_emailed_at: string | null;
  b_emailed_at: string | null;
  a_email_day: string | null;
  b_email_day: string | null;
  a_email_count: number;
  b_email_count: number;
  a_pushed_at: string | null;
  b_pushed_at: string | null;
  created_at: string;
};

export type DmPeer = { id: string; username: string; display_name: string | null; avatar_url: string | null };
export type DmMessage = { id: string; senderId: string; mine: boolean; body: string; createdAt: string };
export type DmSummary = {
  id: string;
  view: DmView;
  peer: DmPeer;
  lastMessageAt: string | null;
  preview: string | null;
  lastSenderIsMe: boolean;
  unread: boolean;
};

type Err = { error: string; code?: string };
const closed = (): Err => ({ error: V190_CLOSED_MESSAGE, code: "closed" });

// ── 순수 함수 (테스트용) ──────────────────────────────────

export function sideOf(c: Pick<DmRow, "user_a" | "user_b">, me: string): "a" | "b" | null {
  return c.user_a === me ? "a" : c.user_b === me ? "b" : null;
}

export function orderedPair(x: string, y: string): [string, string] {
  return x < y ? [x, y] : [y, x];
}

/** 보는 사람 기준 상태. null 이면 목록·열기에서 숨긴다(내가 거절한 요청). */
export function viewOf(c: Pick<DmRow, "status" | "requested_by">, me: string): DmView | null {
  if (c.status === "open") return "open";
  if (c.requested_by === me) return "pending"; // requested·declined 모두 — 거절 사실은 알리지 않는다
  return c.status === "requested" ? "incoming" : null;
}

/** 내가 나간 뒤로 새 글이 없으면 목록에서 뺀다 */
export function hiddenByLeave(c: Pick<DmRow, "last_message_at">, leftAt: string | null): boolean {
  if (!leftAt) return false;
  return !c.last_message_at || c.last_message_at <= leftAt;
}

export function isUnread(c: Pick<DmRow, "last_message_at" | "last_sender_id">, me: string, readAt: string | null, leftAt: string | null): boolean {
  if (!c.last_message_at || c.last_sender_id === me) return false;
  const seen = [readAt, leftAt].filter(Boolean).sort().pop() ?? null;
  return !seen || seen < c.last_message_at;
}

export function kstDayStart(now: Date): string {
  const kst = new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
  return new Date(`${kst}T00:00:00+09:00`).toISOString();
}

/** 내가 보낸 요청이 거절된 뒤 30일 안이면 다시 요청 못 함(보낸 사람에게는 그냥 '답이 없음'으로 보인다) */
export function requestCoolingDown(c: Pick<DmRow, "status" | "requested_by" | "requested_at">, me: string, now: number): boolean {
  return (
    (c.status === "declined" || c.status === "requested") &&
    c.requested_by === me &&
    !!c.requested_at &&
    now - new Date(c.requested_at).getTime() < DM_REQUEST_TTL_MS
  );
}

export function cleanBody(body: unknown): string | Err {
  const text = typeof body === "string" ? body.trim() : "";
  if (!text) return { error: "내용을 입력해 주세요." };
  if (text.length > DM_MAX_LEN) return { error: `메시지는 ${DM_MAX_LEN}자까지 쓸 수 있어요.` };
  return text;
}

// ── 조회 도우미 ──────────────────────────────────────────

const db = () => getAdminClient();

export async function userIdOf(username: string): Promise<string | null> {
  const { data } = await db().from("users").select("id").eq("username", username).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

async function peersOf(ids: string[]): Promise<Map<string, DmPeer>> {
  if (ids.length === 0) return new Map();
  const { data } = await db().from("users").select("id, username, display_name, avatar_url").in("id", ids);
  return new Map(
    (data ?? []).map((u) => [
      u.id as string,
      {
        id: u.id as string,
        username: u.username as string,
        display_name: (u.display_name as string | null) ?? null,
        avatar_url: (u.avatar_url as string | null) ?? null,
      },
    ]),
  );
}

/** 나와 차단 관계(어느 쪽이든)인 사람들 */
async function blockedSet(me: string): Promise<Set<string>> {
  const { data } = await db()
    .from("user_blocks")
    .select("blocker_id, blocked_id")
    .or(`blocker_id.eq.${me},blocked_id.eq.${me}`)
    .limit(5000);
  const s = new Set<string>();
  for (const r of data ?? []) s.add((r.blocker_id === me ? r.blocked_id : r.blocker_id) as string);
  return s;
}

async function blockedEitherWay(me: string, other: string): Promise<boolean> {
  const { isBlockedEitherWay } = await import("@/lib/blocks");
  return isBlockedEitherWay(me, other);
}

/** 바로 대화 조건: 서로 팔로우 또는 확정·완료된 예약(방향 무관, 계정 없는 게스트 예약은 제외) */
export async function directAllowed(me: string, other: string): Promise<boolean> {
  const { count: follows } = await db()
    .from("follows")
    .select("follower_id", { count: "exact", head: true })
    .or(`and(follower_id.eq.${me},following_id.eq.${other}),and(follower_id.eq.${other},following_id.eq.${me})`);
  if ((follows ?? 0) >= 2) return true;
  const { count: booked } = await db()
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .in("status", ["confirmed", "completed"])
    .or(`and(host_id.eq.${me},guest_id.eq.${other}),and(host_id.eq.${other},guest_id.eq.${me})`);
  return (booked ?? 0) > 0;
}

async function loadRow(id: string): Promise<DmRow | null> {
  const { data } = await db().from("conversations").select("*").eq("id", id).maybeSingle();
  return (data as DmRow | null) ?? null;
}

/** 대기 중 요청을 다시 판단 — 조건이 생겼으면 open 으로(거절은 다시 보지 않는다) */
async function promoteIfAllowed(c: DmRow): Promise<DmRow> {
  if (c.status !== "requested") return c;
  if (!(await directAllowed(c.user_a, c.user_b))) return c;
  const at = new Date().toISOString();
  await db().from("conversations").update({ status: "open", accepted_at: at }).eq("id", c.id).eq("status", "requested");
  return { ...c, status: "open", accepted_at: at };
}

/** 참여자이고 차단 관계가 아니고 내가 볼 수 있는 대화인지 */
async function access(me: string, id: string): Promise<{ c: DmRow; side: "a" | "b"; other: string; view: DmView } | Err> {
  const c0 = await loadRow(id);
  const side = c0 ? sideOf(c0, me) : null;
  if (!c0 || !side) return { error: "대화를 찾을 수 없어요.", code: "not_found" };
  const other = side === "a" ? c0.user_b : c0.user_a;
  if (!v190OpenPair(me, other)) return { error: "대화를 찾을 수 없어요.", code: "not_found" };
  if (await blockedEitherWay(me, other)) return { error: "이 사용자와 대화할 수 없어요.", code: "blocked" };
  const c = await promoteIfAllowed(c0);
  const view = viewOf(c, me);
  if (!view) return { error: "대화를 찾을 수 없어요.", code: "not_found" };
  return { c, side, other, view };
}

// ── 시작·요청 ────────────────────────────────────────────

export type StartResult = { id: string; view: DmView } | (Err & { needsRequest?: boolean });

/**
 * 프로필·오르빗의 '대화' 버튼. 바로 대화 조건이면 방을 열고, 아니면 firstBody 가 있어야 요청이 된다
 * (없으면 needsRequest 로 알려 첫 글 입력을 띄운다).
 */
export async function startDm(me: string, targetUsername: string, firstBody?: string | null, now = new Date()): Promise<StartResult> {
  if (!v190OpenFor(me, now)) return closed();
  const target = await userIdOf(targetUsername);
  if (!target) return { error: "상대를 찾을 수 없어요.", code: "not_found" };
  if (target === me) return { error: "자기 자신과는 대화할 수 없어요.", code: "self" };
  if (!v190OpenPair(me, target, now)) return { error: "이 사용자와는 아직 대화할 수 없어요.", code: "closed" };
  if (await blockedEitherWay(me, target)) return { error: "이 사용자와 대화할 수 없어요.", code: "blocked" };

  const [a, b] = orderedPair(me, target);
  const { data: found } = await db().from("conversations").select("*").eq("user_a", a).eq("user_b", b).maybeSingle();
  const existing = (found as DmRow | null) ?? null;
  const allowed = await directAllowed(me, target);
  // 요청 창에서 첫 글을 썼는데 그 사이 바로 대화 조건이 됐으면(맞팔·예약) 글을 버리지 않고 열린 방에 보낸다
  const openWith = async (id: string): Promise<StartResult> => {
    if (firstBody != null && firstBody !== "") {
      const sent = await sendDm(me, id, firstBody, now);
      if ("error" in sent) return sent;
    }
    return { id, view: "open" };
  };

  if (existing) {
    if (existing.status === "open") return openWith(existing.id);
    // 거절은 받은 사람의 뜻 — 보낸 사람은 30일 동안 조건이 생겨도(맞팔·예약) 다시 열지 못한다(promoteIfAllowed 와 같은 규칙)
    if (existing.status === "declined" && requestCoolingDown(existing, me, now.getTime())) return { id: existing.id, view: "pending" };
    if (allowed) {
      const at = now.toISOString();
      await db().from("conversations").update({ status: "open", accepted_at: at }).eq("id", existing.id);
      return openWith(existing.id);
    }
    if (existing.status === "requested" && existing.requested_by !== me) return { id: existing.id, view: "incoming" };
    if (requestCoolingDown(existing, me, now.getTime())) return { id: existing.id, view: "pending" };
    // 오래된 요청(30일 지남) 또는 내가 거절했던 상대에게 내가 요청 → 아래에서 새 요청으로 바꾼다
  } else if (allowed) {
    const { data: created, error } = await db()
      .from("conversations")
      .insert({ user_a: a, user_b: b, status: "open", accepted_at: now.toISOString() })
      .select("id")
      .single();
    if (error || !created) {
      // 동시에 두 번 눌렀을 때(고유 쌍) — 다시 읽는다
      const { data: again } = await db().from("conversations").select("id").eq("user_a", a).eq("user_b", b).maybeSingle();
      if (again) return openWith(again.id as string);
      return { error: "대화를 시작하지 못했어요." };
    }
    return openWith(created.id as string);
  }

  // 대화 요청: 첫 글 필요
  if (firstBody == null || firstBody === "") return { error: "대화 요청에는 첫 메시지가 필요해요.", code: "needs_request", needsRequest: true };
  const text = cleanBody(firstBody);
  if (typeof text !== "string") return text;
  const { count: today } = await db()
    .from("conversations")
    .select("id", { count: "exact", head: true })
    .eq("requested_by", me)
    .gte("requested_at", kstDayStart(now));
  if ((today ?? 0) >= DM_DAILY_REQUESTS) return { error: "오늘은 더 요청할 수 없어요. 내일 다시 시도해 주세요.", code: "daily_limit" };

  const at = now.toISOString();
  const patch = {
    status: "requested" as const,
    requested_by: me,
    requested_at: at,
    accepted_at: null,
    a_left_at: null,
    b_left_at: null,
  };
  let id: string;
  if (existing) {
    // 지난 요청의 글은 지우고 새 요청으로
    await db().from("messages").delete().eq("conversation_id", existing.id);
    await db().from("conversations").update({ ...patch, last_message_at: null, last_message_preview: null, last_sender_id: null }).eq("id", existing.id);
    id = existing.id;
  } else {
    const { data: created, error } = await db().from("conversations").insert({ user_a: a, user_b: b, ...patch }).select("id").single();
    if (error || !created) return { error: "대화 요청을 보내지 못했어요." };
    id = created.id as string;
  }
  const sent = await insertMessage(me, id, text, at);
  if ("error" in sent) return sent;
  const { createNotification } = await import("@/lib/notifications");
  const label = await labelOf(me);
  await createNotification({ userId: target, type: "direct_message", title: `${label}님이 대화를 요청했어요`, body: null, link: `/messages/${id}`, actorId: me });
  return { id, view: "pending" };
}

async function labelOf(userId: string): Promise<string> {
  const { data } = await db().from("users").select("username, display_name").eq("id", userId).maybeSingle();
  return ((data?.display_name as string | null) || (data?.username as string | undefined) || "누군가") as string;
}

async function insertMessage(me: string, id: string, text: string, at: string): Promise<{ id: string; createdAt: string } | Err> {
  const { data: m, error } = await db()
    .from("messages")
    .insert({ conversation_id: id, sender_id: me, body: text, created_at: at })
    .select("id, created_at")
    .single();
  if (error || !m) return { error: "보내지 못했어요. 잠시 후 다시 시도해 주세요." };
  const c = await loadRow(id);
  const side = c ? sideOf(c, me) : null;
  const patch: Record<string, unknown> = {
    last_message_at: m.created_at,
    last_message_preview: text.slice(0, 200),
    last_sender_id: me,
  };
  if (side) patch[`${side}_last_read_at`] = m.created_at;
  await db().from("conversations").update(patch).eq("id", id);
  return { id: m.id as string, createdAt: m.created_at as string };
}

// ── 목록·열기·보내기 ─────────────────────────────────────

export async function listDm(me: string, now = new Date()): Promise<{ items: DmSummary[]; requests: DmSummary[] }> {
  if (!v190OpenFor(me, now)) return { items: [], requests: [] };
  const { data } = await db()
    .from("conversations")
    .select("*")
    .or(`user_a.eq.${me},user_b.eq.${me}`)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(500);
  const rows = (data ?? []) as DmRow[];
  const blocked = await blockedSet(me);
  const peers = await peersOf(rows.map((c) => (c.user_a === me ? c.user_b : c.user_a)));
  const items: DmSummary[] = [];
  const requests: DmSummary[] = [];
  for (const c0 of rows) {
    const side = sideOf(c0, me)!;
    const otherId = side === "a" ? c0.user_b : c0.user_a;
    if (blocked.has(otherId)) continue;
    if (!v190Open(now) && !v190OpenPair(me, otherId, now)) continue; // 시행 전 미리보기: 미리보기 계정끼리만
    const peer = peers.get(otherId);
    if (!peer) continue;
    const c = await promoteIfAllowed(c0);
    const view = viewOf(c, me);
    if (!view) continue;
    if (!c.last_message_at && view === "open") continue; // 글 없는 빈 방은 목록에 안 둔다
    const leftAt = side === "a" ? c.a_left_at : c.b_left_at;
    if (hiddenByLeave(c, leftAt)) continue;
    const readAt = side === "a" ? c.a_last_read_at : c.b_last_read_at;
    const s: DmSummary = {
      id: c.id,
      view,
      peer,
      lastMessageAt: c.last_message_at,
      preview: c.last_message_preview,
      lastSenderIsMe: c.last_sender_id === me,
      unread: view === "incoming" ? true : view === "open" && isUnread(c, me, readAt, leftAt),
    };
    (view === "incoming" ? requests : items).push(s);
  }
  return { items, requests };
}

export async function unreadDmCount(me: string, now = new Date()): Promise<number> {
  if (!v190OpenFor(me, now)) return 0;
  const { items, requests } = await listDm(me, now);
  return items.filter((i) => i.unread).length + requests.length;
}

export type DmThread = {
  id: string;
  view: DmView;
  peer: DmPeer;
  canWrite: boolean;
  /** 쓸 수 없을 때 이유 문구 */
  reason: string | null;
  messages: DmMessage[];
};

export async function getDm(me: string, id: string, opts: { markRead?: boolean; since?: string | null } = {}, now = new Date()): Promise<DmThread | Err> {
  if (!v190OpenFor(me, now)) return closed();
  const r = await access(me, id);
  if ("error" in r) return r;
  const { c, side, other, view } = r;
  const leftAt = side === "a" ? c.a_left_at : c.b_left_at;
  let q = db().from("messages").select("id, sender_id, body, created_at").eq("conversation_id", id).order("created_at", { ascending: true }).limit(500);
  const after = [leftAt, opts.since ?? null].filter(Boolean).sort().pop();
  if (after) q = q.gt("created_at", after);
  const { data: rows } = await q;
  const peer = (await peersOf([other])).get(other);
  if (!peer) return { error: "대화를 찾을 수 없어요.", code: "not_found" };
  if (opts.markRead !== false && view !== "pending") {
    await db().from("conversations").update({ [`${side}_last_read_at`]: now.toISOString() }).eq("id", id);
  }
  return {
    id,
    view,
    peer,
    canWrite: view === "open" || view === "incoming",
    reason: view === "pending" ? "상대가 수락하면 이어서 대화할 수 있어요." : null,
    messages: (rows ?? []).map((m) => ({
      id: m.id as string,
      senderId: m.sender_id as string,
      mine: m.sender_id === me,
      body: m.body as string,
      createdAt: m.created_at as string,
    })),
  };
}

/** 보내기. 받은 요청에 답장하면 수락으로 본다. */
export async function sendDm(me: string, id: string, body: unknown, now = new Date()): Promise<{ ok: true; message: DmMessage } | Err> {
  if (!v190OpenFor(me, now)) return closed();
  const text = cleanBody(body);
  if (typeof text !== "string") return text;
  {
    const { clientKey, rateLimit } = await import("@/lib/rate-limit");
    if (!rateLimit(clientKey("dm-send", me), 60, 60_000).ok) return { error: "너무 자주 보냈어요. 잠시 후 다시 보내 주세요.", code: "rate" };
  }
  const r = await access(me, id);
  if ("error" in r) return r;
  const { c, side, other, view } = r;
  if (view === "pending") return { error: "상대가 수락하면 이어서 대화할 수 있어요.", code: "pending" };
  const at = now.toISOString();
  if (view === "incoming") {
    await db().from("conversations").update({ status: "open", accepted_at: at }).eq("id", id);
  }
  const sent = await insertMessage(me, id, text, at);
  if ("error" in sent) return sent;
  await notifyNewMessage(me, other, { ...c, status: "open" }, side === "a" ? "b" : "a", now);
  return { ok: true, message: { id: sent.id, senderId: me, mine: true, body: text, createdAt: sent.createdAt } };
}

async function notifyNewMessage(me: string, other: string, c: DmRow, otherSide: "a" | "b", now: Date) {
  try {
    const { createNotification } = await import("@/lib/notifications");
    const label = await labelOf(me);
    // 본문은 넣지 않는다(예약 대화와 같은 기준)
    await createNotification({ userId: other, type: "direct_message", title: `${label}님의 새 메시지`, body: null, link: `/messages/${c.id}`, actorId: me });
    await pushDm(other, c, otherSide, now.getTime());
  } catch (err) {
    console.error("[dm] notify", err);
  }
}

/** 이 사람에게 푸시로 알릴 수 있으면 기기 목록, 아니면 null(메일로 알린다) */
export async function dmPushTarget(userId: string) {
  const { apnsConfigured, devicesOf } = await import("@/lib/apns");
  if (!apnsConfigured()) return null;
  const { pushAllowed } = await import("@/lib/notification-prefs");
  if (!(await pushAllowed(userId, "direct_message"))) return null;
  const devices = await devicesOf(userId);
  return devices.length > 0 ? devices : null;
}

async function pushDm(userId: string, c: DmRow, side: "a" | "b", now: number) {
  const devices = await dmPushTarget(userId);
  if (!devices) return;
  const pushedAt = side === "a" ? c.a_pushed_at : c.b_pushed_at;
  if (pushedAt && now - new Date(pushedAt).getTime() < PUSH_GAP_MS) return;
  const { sendPush } = await import("@/lib/apns");
  const delivered = await sendPush(devices, { body: DM_PUSH_BODY, collapseId: c.id, data: { kind: "direct_message", conversationId: c.id } });
  if (delivered > 0) await db().from("conversations").update({ [`${side}_pushed_at`]: new Date(now).toISOString() }).eq("id", c.id);
}

// ── 수락·거절·나가기·신고·차단 ────────────────────────────

export async function acceptDm(me: string, id: string, now = new Date()) {
  if (!v190OpenFor(me, now)) return closed();
  const r = await access(me, id);
  if ("error" in r) return r;
  if (r.view === "open") return { ok: true as const };
  if (r.view !== "incoming") return { error: "받은 요청만 수락할 수 있어요.", code: "not_incoming" };
  await db().from("conversations").update({ status: "open", accepted_at: now.toISOString() }).eq("id", id);
  return { ok: true as const };
}

export async function declineDm(me: string, id: string, now = new Date()) {
  if (!v190OpenFor(me, now)) return closed();
  const r = await access(me, id);
  if ("error" in r) return r;
  if (r.view !== "incoming") return { error: "받은 요청만 거절할 수 있어요.", code: "not_incoming" };
  // 요청한 사람에게는 알리지 않는다. 30일 뒤 정리 cron 이 지운다(requested_at 기준).
  await db().from("conversations").update({ status: "declined" }).eq("id", id);
  return { ok: true as const };
}

export async function leaveDm(me: string, id: string, now = new Date()) {
  if (!v190OpenFor(me, now)) return closed();
  const c = await loadRow(id);
  const side = c ? sideOf(c, me) : null;
  if (!c || !side) return { error: "대화를 찾을 수 없어요.", code: "not_found" };
  const at = now.toISOString();
  // 방은 지우지 않는다 — 지우면 하루 요청 수·거절 뒤 30일 기다림을 피해 다시 요청할 수 있다(검토 11/13).
  // 열리지 않은 요청·거절은 30일 뒤, 둘 다 나간 열린 방은 정리 cron 이 지운다.
  const patch: Record<string, unknown> = { [`${side}_left_at`]: at };
  if (c.status === "requested" && c.requested_by !== me) patch.status = "declined"; // 받은 요청에서 나가기 = 거절
  await db().from("conversations").update(patch).eq("id", id);
  return { ok: true as const };
}

export async function reportDm(me: string, id: string, messageId: string, reason: string | null, now = new Date()) {
  if (!v190OpenFor(me, now)) return closed();
  const r = await access(me, id);
  if ("error" in r) return r;
  const { data: rows } = await db()
    .from("messages")
    .select("id, sender_id, body, created_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true })
    .limit(500);
  const list = rows ?? [];
  const idx = list.findIndex((m) => m.id === messageId);
  if (idx < 0) return { error: "메시지를 찾을 수 없어요.", code: "not_found" };
  if (list[idx].sender_id === me) return { error: "내 메시지는 신고할 수 없어요.", code: "own" };
  const context = list.slice(Math.max(0, idx - 5), idx + 6).map((m) => ({
    role: m.sender_id === me ? "reporter" : "reported",
    at: m.created_at,
    body: m.body,
    reported: m.id === messageId,
  }));
  // 방·글이 나중에 지워져도 누구를 신고했는지 남도록 신고된 사람 id 를 사본에 함께 둔다
  const { error } = await db().from("message_reports").insert({
    conversation_id: id,
    dm_message_id: messageId,
    reporter_role: "member",
    reporter_id: me,
    reason: (reason ?? "").slice(0, 500) || null,
    body_snapshot: JSON.stringify({ reportedUserId: r.other, messages: context }),
  });
  if (error) {
    console.error("[dm] report", error.message);
    return { error: "신고를 접수하지 못했어요. 잠시 후 다시 시도해 주세요." };
  }
  // 받은 요청을 신고하면 거절로 처리한다
  if (r.view === "incoming") await db().from("conversations").update({ status: "declined" }).eq("id", id);
  try {
    const admins = (process.env.ADMIN_USERNAMES || "").split(",").map((s) => s.trim()).filter(Boolean);
    if (admins.length) {
      const { data: users } = await db().from("users").select("id").in("username", admins);
      const { createNotification } = await import("@/lib/notifications");
      for (const u of users ?? []) {
        await createNotification({ userId: u.id as string, type: "booking_message_report", title: "1:1 대화 신고가 들어왔어요", body: null, link: "/admin/reports" });
      }
    }
  } catch (err) {
    console.error("[dm] report notify", err);
  }
  return { ok: true as const };
}

/** 대화에서 상대 차단 — 받은 요청이면 요청을 지운다. 팔로우는 양쪽 다 끊는다(기존 차단과 같다). */
export async function blockFromDm(me: string, id: string, now = new Date()) {
  if (!v190OpenFor(me, now)) return closed();
  const c = await loadRow(id);
  const side = c ? sideOf(c, me) : null;
  if (!c || !side) return { error: "대화를 찾을 수 없어요.", code: "not_found" };
  const other = side === "a" ? c.user_b : c.user_a;
  await db().from("user_blocks").upsert({ blocker_id: me, blocked_id: other }, { onConflict: "blocker_id,blocked_id" });
  await db().from("follows").delete().match({ follower_id: me, following_id: other });
  await db().from("follows").delete().match({ follower_id: other, following_id: me });
  if (c.status === "requested" && c.requested_by !== me) await db().from("conversations").delete().eq("id", id);
  return { ok: true as const };
}

/** 프로필에서 쓸 버튼 상태: 'open'(대화) / 'request'(대화 요청) / 'pending'(요청 보냄) / 'incoming'(요청 받음) / null(숨김) */
export async function dmButtonState(me: string | null, targetId: string, now = new Date()): Promise<"open" | "request" | "pending" | "incoming" | null> {
  if (!me || me === targetId || !v190OpenPair(me, targetId, now)) return null;
  if (await blockedEitherWay(me, targetId)) return null;
  const [a, b] = orderedPair(me, targetId);
  const { data } = await db().from("conversations").select("*").eq("user_a", a).eq("user_b", b).maybeSingle();
  const c = data as DmRow | null;
  if (c && viewOf(c, me) === "open") return "open";
  if (c && c.status === "declined" && requestCoolingDown(c, me, now.getTime())) return "pending";
  // 서로 팔로우·확정 예약이 생겼으면 바로 대화(startDm 도 같은 순서)
  if (await directAllowed(me, targetId)) return "open";
  if (c) {
    const v = viewOf(c, me);
    if (v === "incoming") return "incoming";
    if (v === "pending" && requestCoolingDown(c, me, now.getTime())) return "pending";
  }
  return "request";
}

// ── 정리 cron ────────────────────────────────────────────

export async function cleanupDm(now = Date.now()) {
  const reqCutoff = new Date(now - DM_REQUEST_TTL_MS).toISOString();
  const keepCutoff = new Date(now - DM_RETENTION_MS).toISOString();
  let requests = 0, left = 0, old = 0;
  {
    const { count } = await db().from("conversations").delete({ count: "exact" }).in("status", ["requested", "declined"]).lt("requested_at", reqCutoff);
    requests = count ?? 0;
  }
  {
    const { count } = await db().from("conversations").delete({ count: "exact" }).not("a_left_at", "is", null).not("b_left_at", "is", null);
    left = count ?? 0;
  }
  {
    const { count: c1 } = await db().from("conversations").delete({ count: "exact" }).lt("last_message_at", keepCutoff);
    const { count: c2 } = await db().from("conversations").delete({ count: "exact" }).is("last_message_at", null).lt("created_at", keepCutoff);
    old = (c1 ?? 0) + (c2 ?? 0);
  }
  return { requests, left, old };
}
