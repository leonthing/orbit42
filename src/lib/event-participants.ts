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

/** "2026-08-14" (KST 기준) — 알림 링크에 실어 앱이 해당 날짜를 열게 한다. */
function kstDateKey(startAt: string): string | null {
  const date = new Date(startAt);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * 알림에서 해당 일정으로 바로 이동하기 위한 링크.
 * 웹은 `/calendar` 로 들어가 내 캘린더로 리다이렉트되고,
 * 앱은 event/date 쿼리를 읽어 그 날짜의 상세 시트를 연다.
 */
function calendarEventLink(eventId: string, startAt: string): string {
  const date = kstDateKey(startAt);
  const query = date ? `&date=${date}` : "";
  return `/calendar?event=${encodeURIComponent(eventId)}${query}`;
}

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

  // 알림 링크에 실을 참석자 행 id 가 필요해 insert 결과를 되받는다.
  const { data: inserted, error } = await db
    .from("event_participants")
    .insert({
      owner_id: ownerId,
      event_key: eventKey,
      participant_id: target.id,
      title: snapshot.title,
      start_at: snapshot.start_at,
      end_at: snapshot.end_at,
      all_day: snapshot.all_day,
      location: snapshot.location ?? null,
      description: snapshot.description ?? null,
    })
    .select("id")
    .single();
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
    // 초대받은 쪽 캘린더에서 이 일정의 id 는 `invite_{참석자 행 id}` 다.
    link: inserted?.id
      ? calendarEventLink(`invite_${inserted.id as string}`, snapshot.start_at)
      : `/${owner?.username}`,
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

/**
 * 원본 일정이 바뀌었을 때 참석자 행의 스냅샷을 따라 갱신한다.
 *
 * 초대 시점 값을 행에 복사해 두는 구조라, 이걸 호출하지 않으면 상대 캘린더와
 * 초대 목록에는 옛 제목·시간·장소가 그대로 남는다. 일정 수정 경로(로컬·구글·
 * 캘린더 이동)가 모두 여기를 지나야 한다.
 *
 * 시간·장소·제목이 실제로 달라진 경우에만 (거절하지 않은) 가입 참석자에게
 * 알린다. 메모만 바뀐 건 조용히 반영한다. 실패해도 일정 수정 자체는 이미
 * 끝난 뒤라 예외를 밖으로 던지지 않는다.
 */
export async function syncParticipantSnapshots(
  ownerId: string,
  eventKey: string,
  patch: Partial<EventSnapshot>,
): Promise<void> {
  const update: Record<string, unknown> = {};
  if (patch.title !== undefined) update.title = patch.title;
  if (patch.start_at !== undefined) update.start_at = patch.start_at;
  if (patch.end_at !== undefined) update.end_at = patch.end_at;
  if (patch.all_day !== undefined) update.all_day = patch.all_day;
  if (patch.location !== undefined) update.location = patch.location ?? null;
  if (patch.description !== undefined) {
    update.description = patch.description ?? null;
  }
  if (Object.keys(update).length === 0) return;

  try {
    const db = getAdminClient();
    const { data: rows } = await db
      .from("event_participants")
      .select(
        "id, participant_id, status, title, start_at, end_at, all_day, location",
      )
      .eq("owner_id", ownerId)
      .eq("event_key", eventKey);
    if (!rows || rows.length === 0) return;

    const { error } = await db
      .from("event_participants")
      .update(update)
      .eq("owner_id", ownerId)
      .eq("event_key", eventKey);
    if (error) {
      console.error("syncParticipantSnapshots update", error);
      return;
    }

    // 알림은 눈에 띄는 변화(제목·시간·장소)가 있을 때만.
    const sameTime = (a: string | null, b: string | null) => {
      if (a == null || b == null) return a == b;
      const ta = Date.parse(a);
      const tb = Date.parse(b);
      return Number.isNaN(ta) || Number.isNaN(tb) ? a === b : ta === tb;
    };
    const changed = rows.filter((row) => {
      if (update.title !== undefined && update.title !== row.title) return true;
      if (
        update.start_at !== undefined &&
        !sameTime(update.start_at as string, row.start_at as string | null)
      ) {
        return true;
      }
      if (
        update.end_at !== undefined &&
        !sameTime(update.end_at as string | null, row.end_at as string | null)
      ) {
        return true;
      }
      if (update.all_day !== undefined && update.all_day !== row.all_day) {
        return true;
      }
      if (
        update.location !== undefined &&
        (update.location ?? null) !== ((row.location as string | null) ?? null)
      ) {
        return true;
      }
      return false;
    });
    const recipients = changed.filter(
      (row) => row.participant_id && row.status !== "declined",
    );
    if (recipients.length === 0) return;

    const { data: owner } = await db
      .from("users")
      .select("username, display_name")
      .eq("id", ownerId)
      .single();
    const label =
      (owner?.display_name as string | null) ||
      (owner?.username as string) ||
      "누군가";
    const { createNotification } = await import("@/lib/notifications");
    for (const row of recipients) {
      const snapshot: EventSnapshot = {
        title: (update.title as string | undefined) ?? (row.title as string),
        start_at:
          (update.start_at as string | undefined) ?? (row.start_at as string),
        end_at:
          (update.end_at as string | null | undefined) ??
          (row.end_at as string | null),
        all_day:
          (update.all_day as boolean | undefined) ?? Boolean(row.all_day),
        location:
          (update.location as string | null | undefined) ??
          (row.location as string | null),
      };
      const body = snapshot.location
        ? `${whenText(snapshot)} · ${snapshot.location}`
        : whenText(snapshot);
      await createNotification({
        userId: row.participant_id as string,
        type: "event_invite_updated",
        title: `${label}님이 '${snapshot.title}' 일정을 변경했어요`,
        body,
        link: calendarEventLink(`invite_${row.id as string}`, snapshot.start_at),
        actorId: ownerId,
      });
    }
  } catch (err) {
    console.error("syncParticipantSnapshots", err);
  }
}

/** 일정이 다른 캘린더로 옮겨져 id 가 바뀔 때 참석자 행의 event_key 를 따라 옮긴다. */
export async function rekeyParticipants(
  ownerId: string,
  oldKey: string,
  newKey: string,
): Promise<void> {
  if (oldKey === newKey) return;
  const db = getAdminClient();
  const { error } = await db
    .from("event_participants")
    .update({ event_key: newKey })
    .eq("owner_id", ownerId)
    .eq("event_key", oldKey);
  if (error) console.error("rekeyParticipants", error);
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
    .select("id, owner_id, event_key, title, start_at, end_at, all_day")
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
    // 소유자 캘린더에서는 원본 일정 id(event_key)가 그대로 쓰인다.
    link: calendarEventLink(row.event_key as string, row.start_at as string),
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
