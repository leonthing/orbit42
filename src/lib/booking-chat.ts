import { getAdminClient } from "@/lib/supabase";
import { MANAGE_GRACE_MS } from "@/lib/guest-manage";

/**
 * 예약 대화 (1.8.0, 설계: 업무기록/설계_1.8.0_예약대화.md).
 * - 예약 1건에 대화방 1개(booking_threads), 메시지는 글자만(booking_messages).
 * - 보는 사람: 그 예약의 호스트, 로그인 게스트, 관리 링크(/b#토큰)를 가진 계정 없는 게스트.
 * - 쓰기 닫힘: 예약 끝 + 7일(관리 링크 만료와 같음), 취소된 예약, 호스트·관리자가 닫은 대화.
 * - 보관: 예약 끝 + 1년 뒤 cleanup cron 이 지운다. 탈퇴하면 그 사람이 낀 예약의 대화를 지운다.
 * - 알림: 앱 안 알림은 대화당 한 줄로 갱신, 메일은 cron 이 묶어서(3분 대기·10분 간격·하루 6통).
 */

export type ChatRole = "host" | "guest";
export const CHAT_BODY_MAX = 2000;
/** 계정 없는 게스트가 한 예약에 1시간 동안 쓸 수 있는 글 수 */
const GUEST_HOURLY_LIMIT = 30;
/** 계정 있는 사람도 한 예약에 1시간 동안 */
const MEMBER_HOURLY_LIMIT = 120;
export const CHAT_RETENTION_MS = 365 * 24 * 60 * 60_000;

export type ChatBooking = {
  id: string;
  host_id: string;
  guest_id: string | null;
  guest_name: string | null;
  guest_email: string | null;
  status: string;
  scheduled_at: string;
  scheduled_end_at: string | null;
  slot: { title: string; duration_min: number | null } | null;
  host: { username: string; display_name: string | null; email: string | null } | null;
  guest: { username: string; display_name: string | null; email: string | null } | null;
};

export type ChatThreadRow = {
  booking_id: string;
  last_message_at: string | null;
  last_sender_role: ChatRole | null;
  host_last_read_at: string | null;
  guest_last_read_at: string | null;
  host_emailed_at: string | null;
  guest_emailed_at: string | null;
  host_email_day: string | null;
  host_email_count: number;
  guest_email_day: string | null;
  guest_email_count: number;
  /** 앱 푸시 간격(같은 대화 60초) */
  host_pushed_at: string | null;
  guest_pushed_at: string | null;
  closed_at: string | null;
  closed_by: string | null;
};

export type ChatMessageOut = {
  id: string;
  role: ChatRole;
  mine: boolean;
  body: string;
  createdAt: string;
};

export type ChatState = {
  canWrite: boolean;
  /** 쓸 수 없는 이유(화면 안내용) */
  reason: string | null;
  closed: boolean;
  writeClosesAt: string;
};

const BOOKING_SELECT =
  "id, host_id, guest_id, guest_name, guest_email, status, scheduled_at, scheduled_end_at, slot:time_slots!bookings_slot_id_fkey(title, duration_min), host:users!bookings_host_id_fkey(username, display_name, email), guest:users!bookings_guest_id_fkey(username, display_name, email)";

export async function loadChatBooking(bookingId: string): Promise<ChatBooking | null> {
  if (!/^[0-9a-f-]{36}$/i.test(bookingId)) return null;
  const { data } = await getAdminClient().from("bookings").select(BOOKING_SELECT).eq("id", bookingId).maybeSingle();
  return (data as unknown as ChatBooking | null) ?? null;
}

/** 로그인한 사람이 이 예약에서 맡은 역할 (없으면 볼 수 없다) */
export function chatRoleFor(b: ChatBooking, userId: string | null | undefined): ChatRole | null {
  if (!userId) return null;
  if (b.host_id === userId) return "host";
  if (b.guest_id === userId) return "guest";
  return null;
}

export function bookingEndIso(b: Pick<ChatBooking, "scheduled_at" | "scheduled_end_at" | "slot">): string {
  return (
    b.scheduled_end_at ??
    new Date(new Date(b.scheduled_at).getTime() + (b.slot?.duration_min ?? 60) * 60_000).toISOString()
  );
}

export function chatState(b: ChatBooking, thread: Pick<ChatThreadRow, "closed_at"> | null, now = Date.now()): ChatState {
  const writeClosesAt = new Date(new Date(bookingEndIso(b)).getTime() + MANAGE_GRACE_MS).toISOString();
  const closed = !!thread?.closed_at;
  let reason: string | null = null;
  if (b.status === "canceled" || b.status === "rejected") reason = "취소된 예약이라 대화를 더 쓸 수 없어요.";
  else if (now > new Date(writeClosesAt).getTime()) reason = "예약이 끝나고 7일이 지나 대화가 닫혔어요.";
  else if (closed) reason = "대화가 닫혔어요.";
  return { canWrite: reason === null, reason, closed, writeClosesAt };
}

async function loadThread(bookingId: string): Promise<ChatThreadRow | null> {
  const { data } = await getAdminClient().from("booking_threads").select("*").eq("booking_id", bookingId).maybeSingle();
  return (data as ChatThreadRow | null) ?? null;
}

export function hostLabelOf(b: ChatBooking) {
  return b.host?.display_name || b.host?.username || "호스트";
}
export function guestLabelOf(b: ChatBooking) {
  return b.guest_name || b.guest?.display_name || b.guest?.username || "게스트";
}

/** 대화 읽기 — 읽으면 내 쪽 읽은 시각을 갱신하고, 이 대화의 내 앱 알림도 읽음 처리한다 */
export async function getChat(b: ChatBooking, role: ChatRole, opts: { markRead?: boolean; viewerUserId?: string | null } = {}) {
  const db = getAdminClient();
  const thread = await loadThread(b.id);
  const { data: rows } = thread
    ? await db
        .from("booking_messages")
        .select("id, sender_role, body, created_at")
        .eq("booking_id", b.id)
        .order("created_at", { ascending: true })
        .limit(500)
    : { data: [] as unknown[] };
  const messages: ChatMessageOut[] = ((rows ?? []) as Array<{ id: string; sender_role: ChatRole; body: string; created_at: string }>).map(
    (m) => ({ id: m.id, role: m.sender_role, mine: m.sender_role === role, body: m.body, createdAt: m.created_at }),
  );
  if (opts.markRead !== false && thread) await markChatRead(b.id, role, opts.viewerUserId ?? null);
  return {
    messages,
    state: chatState(b, thread),
    hostLabel: hostLabelOf(b),
    guestLabel: guestLabelOf(b),
    slotTitle: b.slot?.title ?? "예약",
    /** 첫 글 도우미: 확정된 예약인데 호스트가 아직 쓴 글이 없으면 */
    suggestFirstNote: role === "host" && b.status === "confirmed" && !messages.some((m) => m.role === "host"),
  };
}

export async function markChatRead(bookingId: string, role: ChatRole, viewerUserId: string | null) {
  const db = getAdminClient();
  const now = new Date().toISOString();
  await db
    .from("booking_threads")
    .update(role === "host" ? { host_last_read_at: now } : { guest_last_read_at: now })
    .eq("booking_id", bookingId);
  if (viewerUserId) {
    await db
      .from("notifications")
      .update({ read_at: now })
      .eq("user_id", viewerUserId)
      .eq("type", "booking_message")
      .is("read_at", null)
      .like("link", `%chat=${bookingId}%`);
  }
}

/** 이 예약의 상대에게 가는 앱 안 링크 (예약 화면에서 이 대화를 연다) */
function inAppLinkFor(b: ChatBooking, recipient: ChatRole): string | null {
  if (recipient === "host") return b.host ? `/${b.host.username}/bookings?chat=${b.id}` : null;
  return b.guest ? `/${b.guest.username}/bookings?tab=guest&chat=${b.id}` : null;
}

/** 앱 안 알림: 같은 대화에 안 읽은 알림이 있으면 새로 만들지 않고 그 알림을 갱신한다 */
async function upsertChatNotification(b: ChatBooking, recipient: ChatRole, fromLabel: string, actorId: string | null) {
  const userId = recipient === "host" ? b.host_id : b.guest_id;
  const link = inAppLinkFor(b, recipient);
  if (!userId || !link) return;
  const db = getAdminClient();
  const title = `${fromLabel}님의 메시지`;
  const body = b.slot?.title ?? "예약 대화";
  const { data: existing } = await db
    .from("notifications")
    .select("id")
    .eq("user_id", userId)
    .eq("type", "booking_message")
    .eq("link", link)
    .is("read_at", null)
    .limit(1)
    .maybeSingle();
  if (existing) {
    await db.from("notifications").update({ title, body, created_at: new Date().toISOString() }).eq("id", existing.id);
    return;
  }
  const { createNotification } = await import("@/lib/notifications");
  await createNotification({ userId, type: "booking_message", title, body, link, actorId });
}

export async function sendChatMessage(args: {
  booking: ChatBooking;
  role: ChatRole;
  /** 계정 없는 게스트는 null */
  senderId: string | null;
  body: string;
}): Promise<{ ok: true; message: ChatMessageOut } | { error: string; status?: number }> {
  const b = args.booking;
  const text = (args.body ?? "").replace(/\r\n/g, "\n").trim();
  if (!text) return { error: "내용을 입력해 주세요." };
  if (text.length > CHAT_BODY_MAX) return { error: `메시지는 ${CHAT_BODY_MAX}자까지 쓸 수 있어요.` };

  const db = getAdminClient();
  const thread = await loadThread(b.id);
  const state = chatState(b, thread);
  if (!state.canWrite) return { error: state.reason ?? "지금은 쓸 수 없어요.", status: 403 };

  // 너무 잦은 글 막기(예약·역할 단위, 지난 1시간)
  if (thread) {
    const since = new Date(Date.now() - 60 * 60_000).toISOString();
    const { count } = await db
      .from("booking_messages")
      .select("id", { count: "exact", head: true })
      .eq("booking_id", b.id)
      .eq("sender_role", args.role)
      .gte("created_at", since);
    const limit = args.senderId ? MEMBER_HOURLY_LIMIT : GUEST_HOURLY_LIMIT;
    if ((count ?? 0) >= limit) return { error: "잠시 후 다시 보내 주세요.", status: 429 };
  }

  if (!thread) {
    const { error } = await db.from("booking_threads").upsert({ booking_id: b.id }, { onConflict: "booking_id", ignoreDuplicates: true });
    if (error) {
      console.error("[chat] thread", error.message);
      return { error: "메시지를 보내지 못했어요. 잠시 후 다시 시도해 주세요.", status: 500 };
    }
  }
  const { data: msg, error } = await db
    .from("booking_messages")
    .insert({ booking_id: b.id, sender_role: args.role, sender_id: args.senderId, body: text })
    .select("id, created_at")
    .single();
  if (error || !msg) {
    console.error("[chat] insert", error?.message);
    return { error: "메시지를 보내지 못했어요. 잠시 후 다시 시도해 주세요.", status: 500 };
  }
  const at = msg.created_at as string;
  await db
    .from("booking_threads")
    .update({
      last_message_at: at,
      last_sender_role: args.role,
      // 내가 쓴 글까지는 읽은 것으로
      ...(args.role === "host" ? { host_last_read_at: at } : { guest_last_read_at: at }),
    })
    .eq("booking_id", b.id);

  // 상대에게 앱 안 알림(계정이 있을 때) + 푸시 대상이면 앱 푸시. 그 밖은 cron 이 메일로 묶어서 보낸다.
  const recipient: ChatRole = args.role === "host" ? "guest" : "host";
  const fromLabel = args.role === "host" ? hostLabelOf(b) : guestLabelOf(b);
  try {
    await upsertChatNotification(b, recipient, fromLabel, args.senderId);
  } catch (err) {
    console.error("[chat] notify", err);
  }
  try {
    const { pushChatMessage } = await import("@/lib/booking-chat-push");
    await pushChatMessage(b, recipient);
  } catch (err) {
    console.error("[chat] push", err);
  }

  return { ok: true, message: { id: msg.id as string, role: args.role, mine: true, body: text, createdAt: at } };
}

/** 호스트가 대화 닫기·다시 열기 (관리자는 by='admin') */
export async function setChatClosed(bookingId: string, closed: boolean, by: "host" | "admin") {
  const db = getAdminClient();
  await db.from("booking_threads").upsert({ booking_id: bookingId }, { onConflict: "booking_id", ignoreDuplicates: true });
  const { error } = await db
    .from("booking_threads")
    .update(closed ? { closed_at: new Date().toISOString(), closed_by: by } : { closed_at: null, closed_by: null })
    .eq("booking_id", bookingId);
  return error ? { error: "바꾸지 못했어요." } : { ok: true as const };
}

/** 신고 — 신고된 메시지와 앞뒤 각 5개만 사본으로 남긴다(처리 기록, 처리 뒤 1년 보관) */
export async function reportChatMessage(args: {
  booking: ChatBooking;
  role: ChatRole;
  reporterId: string | null;
  messageId: string;
  reason: string | null;
}) {
  const db = getAdminClient();
  const { data: rows } = await db
    .from("booking_messages")
    .select("id, sender_role, body, created_at")
    .eq("booking_id", args.booking.id)
    .order("created_at", { ascending: true })
    .limit(500);
  const list = (rows ?? []) as Array<{ id: string; sender_role: string; body: string; created_at: string }>;
  const idx = list.findIndex((m) => m.id === args.messageId);
  if (idx < 0) return { error: "메시지를 찾을 수 없어요." };
  const context = list.slice(Math.max(0, idx - 5), idx + 6).map((m) => ({
    role: m.sender_role,
    at: m.created_at,
    body: m.body,
    reported: m.id === args.messageId,
  }));
  const { error } = await db.from("message_reports").insert({
    booking_id: args.booking.id,
    message_id: args.messageId,
    reporter_role: args.role,
    reporter_id: args.reporterId,
    reason: (args.reason ?? "").slice(0, 500) || null,
    body_snapshot: JSON.stringify(context),
  });
  if (error) {
    console.error("[chat] report", error.message);
    return { error: "신고를 접수하지 못했어요. 잠시 후 다시 시도해 주세요." };
  }
  // 관리자에게 앱 안 알림
  try {
    const admins = (process.env.ADMIN_USERNAMES || "").split(",").map((s) => s.trim()).filter(Boolean);
    if (admins.length) {
      const { data: users } = await db.from("users").select("id").in("username", admins);
      const { createNotification } = await import("@/lib/notifications");
      for (const u of users ?? []) {
        await createNotification({ userId: u.id as string, type: "booking_message_report", title: "예약 대화 신고가 들어왔어요", body: args.booking.slot?.title ?? null, link: "/admin/reports" });
      }
    }
  } catch (err) {
    console.error("[chat] report notify", err);
  }
  return { ok: true as const };
}

/** 관리자: 대화방 하나를 통째로 지운다(게스트 삭제 요청 처리). 신고 기록은 남는다. */
export async function adminDeleteChatThread(bookingId: string) {
  const { error, count } = await getAdminClient()
    .from("booking_threads")
    .delete({ count: "exact" })
    .eq("booking_id", bookingId);
  if (error) return { error: error.message };
  return { ok: true as const, deleted: count ?? 0 };
}

/** 탈퇴: 그 사람이 호스트나 게스트인 예약의 대화를 지운다 */
export async function deleteChatsForUser(userId: string) {
  const db = getAdminClient();
  const { data: rows } = await db.from("bookings").select("id").or(`host_id.eq.${userId},guest_id.eq.${userId}`).limit(5000);
  const ids = (rows ?? []).map((r) => r.id as string);
  for (let i = 0; i < ids.length; i += 200) {
    await db.from("booking_threads").delete().in("booking_id", ids.slice(i, i + 200));
  }
  return ids.length;
}

/** cleanup cron: 예약 끝 + 1년 지난 대화, 처리하고 1년 지난 신고 기록을 지운다 */
export async function cleanupChats() {
  const db = getAdminClient();
  const cutoff = new Date(Date.now() - CHAT_RETENTION_MS).toISOString();
  let threads = 0;
  const { data: old } = await db
    .from("booking_threads")
    .select("booking_id, booking:bookings!booking_threads_booking_id_fkey(scheduled_at, scheduled_end_at)")
    .lt("last_message_at", cutoff)
    .limit(500);
  const expired = ((old ?? []) as unknown as Array<{ booking_id: string; booking: { scheduled_at: string; scheduled_end_at: string | null } | null }>)
    .filter((t) => !t.booking || new Date(t.booking.scheduled_end_at ?? t.booking.scheduled_at).toISOString() < cutoff)
    .map((t) => t.booking_id);
  if (expired.length) {
    const { count } = await db.from("booking_threads").delete({ count: "exact" }).in("booking_id", expired);
    threads = count ?? 0;
  }
  const { count: reports } = await db.from("message_reports").delete({ count: "exact" }).lt("handled_at", cutoff);
  return { threads, reports: reports ?? 0 };
}

/** 내 예약들의 안 읽은 대화 수 (예약 탭 표시) — bookingId → 안 읽은 메시지 수 */
export async function unreadChatCounts(userId: string): Promise<Record<string, number>> {
  const db = getAdminClient();
  const { data: mine } = await db
    .from("bookings")
    .select("id, host_id")
    .or(`host_id.eq.${userId},guest_id.eq.${userId}`)
    .order("scheduled_at", { ascending: false })
    .limit(300);
  const roleById = new Map(((mine ?? []) as Array<{ id: string; host_id: string }>).map((r) => [r.id, r.host_id === userId ? "host" : "guest"] as const));
  if (roleById.size === 0) return {};
  const { data: threads } = await db
    .from("booking_threads")
    .select("booking_id, last_message_at, last_sender_role, host_last_read_at, guest_last_read_at")
    .in("booking_id", Array.from(roleById.keys()))
    .not("last_message_at", "is", null);
  const out: Record<string, number> = {};
  for (const t of (threads ?? []) as Array<Pick<ChatThreadRow, "booking_id" | "last_message_at" | "host_last_read_at" | "guest_last_read_at">>) {
    const role = roleById.get(t.booking_id);
    const readAt = role === "host" ? t.host_last_read_at : t.guest_last_read_at;
    if (readAt && t.last_message_at && readAt >= t.last_message_at) continue;
    const { count } = await db
      .from("booking_messages")
      .select("id", { count: "exact", head: true })
      .eq("booking_id", t.booking_id)
      .neq("sender_role", role!)
      .gt("created_at", readAt ?? "1970-01-01T00:00:00Z");
    if (count) out[t.booking_id] = count;
  }
  return out;
}

/** 안 읽은 대화가 있는 예약 수 — 메뉴 '예약' 배지용, 쿼리 두 번 (1.8.0) */
export async function unreadChatThreadCount(userId: string): Promise<number> {
  const db = getAdminClient();
  const { data: mine } = await db
    .from("bookings")
    .select("id, host_id")
    .or(`host_id.eq.${userId},guest_id.eq.${userId}`)
    .order("scheduled_at", { ascending: false })
    .limit(300);
  const roleById = new Map(((mine ?? []) as Array<{ id: string; host_id: string }>).map((r) => [r.id, r.host_id === userId ? "host" : "guest"] as const));
  if (roleById.size === 0) return 0;
  const { data: threads } = await db
    .from("booking_threads")
    .select("booking_id, last_message_at, host_last_read_at, guest_last_read_at")
    .in("booking_id", Array.from(roleById.keys()))
    .not("last_message_at", "is", null);
  let n = 0;
  for (const t of (threads ?? []) as Array<Pick<ChatThreadRow, "booking_id" | "last_message_at" | "host_last_read_at" | "guest_last_read_at">>) {
    const readAt = roleById.get(t.booking_id) === "host" ? t.host_last_read_at : t.guest_last_read_at;
    if (!readAt || (t.last_message_at && t.last_message_at > readAt)) n++;
  }
  return n;
}
