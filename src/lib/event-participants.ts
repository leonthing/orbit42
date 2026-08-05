/**
 * 일정 참석자 (event_participants) — 일정에 사용자를 태그하거나 이메일로 초대.
 *
 * event_key 는 분류·수익·시간로그와 같은 클라이언트 원형 id (uuid/gcal_*).
 * 상대 캘린더 표시용으로 일정 스냅샷(title/start/end)을 행에 함께 저장한다.
 */

import { getAdminClient } from "@/lib/supabase";

export type ParticipantRow = {
  id: string;
  event_key: string;
  participant_id: string | null;
  invited_email: string | null;
  title: string;
  start_at: string;
  end_at: string | null;
  all_day: boolean;
  location: string | null;
  description: string | null;
  status: "invited" | "accepted" | "declined";
};

/**
 * 초대 시점의 일정 정보 — 상대 캘린더 표시용으로 행에 함께 저장하고,
 * 초대 메일에도 같은 값을 싣는다.
 */
export type EventSnapshot = {
  title: string;
  start_at: string;
  end_at: string | null;
  all_day: boolean;
  location?: string | null;
  description?: string | null;
};

const KST_FMT: Intl.DateTimeFormatOptions = {
  timeZone: "Asia/Seoul",
  month: "long",
  day: "numeric",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
};

function whenText(snapshot: EventSnapshot): string {
  const date = new Date(snapshot.start_at);
  if (Number.isNaN(date.getTime())) return snapshot.start_at;
  return snapshot.all_day
    ? date.toLocaleDateString("ko-KR", {
        timeZone: "Asia/Seoul",
        month: "long",
        day: "numeric",
        weekday: "short",
      }) + " (종일)"
    : date.toLocaleString("ko-KR", KST_FMT);
}

/** 소유자 기준 참석자 목록 (+사용자 프로필 조인). */
export async function listParticipants(ownerId: string, eventKey: string) {
  const db = getAdminClient();
  const { data } = await db
    .from("event_participants")
    .select(
      "id, participant_id, invited_email, status, participant:users!event_participants_participant_id_fkey(username, display_name, avatar_url)",
    )
    .eq("owner_id", ownerId)
    .eq("event_key", eventKey)
    .order("created_at", { ascending: true });
  return (data ?? []).map((row) => {
    const user = row.participant as unknown as {
      username: string;
      display_name: string | null;
      avatar_url: string | null;
    } | null;
    return {
      id: row.id as string,
      status: row.status as string,
      username: user?.username ?? null,
      displayName: user?.display_name ?? null,
      avatarUrl: user?.avatar_url ?? null,
      email: (row.invited_email as string | null) ?? null,
    };
  });
}

/** 사용자 태그 — 알림 발송 포함. */
export async function addParticipantByUsername(
  ownerId: string,
  eventKey: string,
  snapshot: EventSnapshot,
  username: string,
): Promise<{ ok: true } | { error: string }> {
  const db = getAdminClient();
  const { data: target } = await db
    .from("users")
    .select("id, username, email, email_verified")
    .eq("username", username.trim().toLowerCase())
    .maybeSingle();
  if (!target) return { error: "사용자를 찾을 수 없어요." };
  if (target.id === ownerId) return { error: "나 자신은 태그할 수 없어요." };

  const { isBlockedEitherWay } = await import("@/lib/blocks");
  if (await isBlockedEitherWay(ownerId, target.id as string)) {
    return { error: "초대할 수 없는 상대예요." };
  }

  const { error } = await db.from("event_participants").insert({
    owner_id: ownerId,
    event_key: eventKey,
    participant_id: target.id,
    title: snapshot.title,
    start_at: snapshot.start_at,
    end_at: snapshot.end_at,
    all_day: snapshot.all_day,
    location: snapshot.location ?? null,
    description: snapshot.description ?? null,
  });
  if (error) {
    if (error.message.includes("duplicate")) {
      return { error: "이미 초대한 사람이에요." };
    }
    console.error("addParticipant", error);
    return { error: "초대에 실패했어요." };
  }

  // 알림: 초대받은 사람에게.
  const { data: owner } = await db
    .from("users")
    .select("username, display_name")
    .eq("id", ownerId)
    .single();
  const label =
    (owner?.display_name as string | null) || (owner?.username as string) || "누군가";
  const { createNotification } = await import("@/lib/notifications");
  await createNotification({
    userId: target.id as string,
    type: "event_invite",
    title: `${label}님이 '${snapshot.title}' 일정에 초대했어요`,
    body: whenText(snapshot),
    link: `/${owner?.username}`,
    actorId: ownerId,
  });

  // 이메일: 인증된 주소가 있고 알림 설정이 켜져 있을 때만.
  try {
    const { emailAllowed } = await import("@/lib/notification-prefs");
    if (
      target.email &&
      target.email_verified &&
      (await emailAllowed(target.id as string, "event_invite"))
    ) {
      const { sendEventParticipantEmail } = await import("@/lib/email");
      await sendEventParticipantEmail(target.email as string, {
        inviterName: label,
        eventTitle: snapshot.title,
        when: whenText(snapshot),
        location: snapshot.location ?? null,
        memo: snapshot.description ?? null,
        recipientUsername: (target.username as string) ?? null,
      });
    }
  } catch (err) {
    console.error("event_invite email", err);
  }
  return { ok: true };
}

/** 이메일 초대 — 가입자면 사용자 태그로 전환, 아니면 초대 메일 발송. */
export async function addParticipantByEmail(
  ownerId: string,
  eventKey: string,
  snapshot: EventSnapshot,
  email: string,
): Promise<{ ok: true } | { error: string }> {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return { error: "이메일 형식이 올바르지 않아요." };
  }
  const db = getAdminClient();
  const { data: existing } = await db
    .from("users")
    .select("username")
    .ilike("email", normalized)
    .maybeSingle();
  if (existing?.username) {
    return addParticipantByUsername(
      ownerId,
      eventKey,
      snapshot,
      existing.username as string,
    );
  }

  const { error } = await db.from("event_participants").insert({
    owner_id: ownerId,
    event_key: eventKey,
    invited_email: normalized,
    title: snapshot.title,
    start_at: snapshot.start_at,
    end_at: snapshot.end_at,
    all_day: snapshot.all_day,
    location: snapshot.location ?? null,
    description: snapshot.description ?? null,
  });
  if (error) {
    if (error.message.includes("duplicate")) {
      return { error: "이미 초대한 이메일이에요." };
    }
    console.error("addParticipantByEmail", error);
    return { error: "초대에 실패했어요." };
  }

  const { data: owner } = await db
    .from("users")
    .select("username, display_name")
    .eq("id", ownerId)
    .single();
  const { sendEventInviteEmail } = await import("@/lib/email");
  await sendEventInviteEmail(normalized, {
    inviterName:
      (owner?.display_name as string | null) ||
      (owner?.username as string) ||
      "Orbit42 사용자",
    eventTitle: snapshot.title,
    when: whenText(snapshot),
    location: snapshot.location ?? null,
    memo: snapshot.description ?? null,
    refUsername: (owner?.username as string) ?? "",
  });
  return { ok: true };
}

export async function removeParticipant(
  ownerId: string,
  eventKey: string,
  participantRowId: string,
): Promise<{ ok: true } | { error: string }> {
  const db = getAdminClient();
  const { error } = await db
    .from("event_participants")
    .delete()
    .eq("id", participantRowId)
    .eq("owner_id", ownerId)
    .eq("event_key", eventKey);
  if (error) return { error: "삭제에 실패했어요." };
  return { ok: true };
}

/** 초대받은 쪽의 수락/거절 — 소유자에게 알림. */
export async function respondToInvite(
  participantUserId: string,
  participationId: string,
  status: "accepted" | "declined",
): Promise<{ ok: true } | { error: string }> {
  const db = getAdminClient();
  const { data: row } = await db
    .from("event_participants")
    .select("id, owner_id, title, start_at, end_at, all_day")
    .eq("id", participationId)
    .eq("participant_id", participantUserId)
    .maybeSingle();
  if (!row) return { error: "초대를 찾을 수 없어요." };

  const { error } = await db
    .from("event_participants")
    .update({ status })
    .eq("id", participationId)
    .eq("participant_id", participantUserId);
  if (error) return { error: "저장에 실패했어요." };

  const { data: me } = await db
    .from("users")
    .select("username, display_name")
    .eq("id", participantUserId)
    .single();
  const label =
    (me?.display_name as string | null) || (me?.username as string) || "상대";
  const { createNotification } = await import("@/lib/notifications");
  await createNotification({
    userId: row.owner_id as string,
    type: "event_invite_response",
    title:
      status === "accepted"
        ? `${label}님이 '${row.title}' 일정 초대를 수락했어요`
        : `${label}님이 '${row.title}' 일정 초대를 거절했어요`,
    body: whenText({
      title: row.title as string,
      start_at: row.start_at as string,
      end_at: row.end_at as string | null,
      all_day: Boolean(row.all_day),
    }),
    link: `/${me?.username}`,
    actorId: participantUserId,
  });
  return { ok: true };
}

/** 내가 초대받은 일정 (거절 제외) — 캘린더 병합용. */
export async function listMyInvites(
  userId: string,
  rangeStart: Date,
  rangeEnd: Date,
) {
  const db = getAdminClient();
  const { data } = await db
    .from("event_participants")
    .select(
      "id, title, start_at, end_at, all_day, location, description, status, owner:users!event_participants_owner_id_fkey(username, display_name, avatar_url)",
    )
    .eq("participant_id", userId)
    .neq("status", "declined")
    .gte("start_at", rangeStart.toISOString())
    .lte("start_at", rangeEnd.toISOString());
  return (data ?? []).map((row) => {
    const owner = row.owner as unknown as {
      username: string;
      display_name: string | null;
      avatar_url: string | null;
    } | null;
    return {
      id: row.id as string,
      title: row.title as string,
      start_at: row.start_at as string,
      end_at: (row.end_at as string | null) ?? (row.start_at as string),
      all_day: Boolean(row.all_day),
      location: (row.location as string | null) ?? null,
      description: (row.description as string | null) ?? null,
      status: row.status as "invited" | "accepted",
      inviterUsername: owner?.username ?? null,
      inviterName: owner?.display_name ?? owner?.username ?? null,
      inviterAvatar: owner?.avatar_url ?? null,
    };
  });
}
