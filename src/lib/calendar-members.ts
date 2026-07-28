/**
 * 공유 캘린더 (calendar_members) — 친구·가족·파트너와 하나의 캘린더를 같이 쓴다.
 *
 * 권한 모델은 단순하게 두 단계:
 *   - editor: 일정 추가·수정·삭제 가능 (기본)
 *   - viewer: 보기만
 * 소유자(calendars.user_id)는 항상 전권이며 멤버를 초대·해제할 수 있다.
 * 초대는 즉시 접근 권한을 주고 알림으로 알린다 (구글 캘린더 공유와 같은 방식).
 */

import { getAdminClient } from "@/lib/supabase";

export type MemberRole = "editor" | "viewer";

export type CalendarMember = {
  id: string;
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: MemberRole;
  isOwner: boolean;
};

/** 내가 접근 가능한 캘린더 id — 소유 + 공유받은 것. */
export async function accessibleCalendarIds(userId: string): Promise<string[]> {
  const db = getAdminClient();
  const [owned, shared] = await Promise.all([
    db.from("calendars").select("id").eq("user_id", userId),
    db.from("calendar_members").select("calendar_id").eq("user_id", userId),
  ]);
  return [
    ...(owned.data ?? []).map((c) => c.id as string),
    ...(shared.data ?? []).map((m) => m.calendar_id as string),
  ];
}

/** 공유받은 캘린더 (id → 역할·소유자) — 목록 표시와 권한 판단에 쓴다. */
export async function sharedCalendarsFor(userId: string): Promise<
  Map<string, { role: MemberRole; ownerId: string; ownerUsername: string; ownerName: string | null }>
> {
  const db = getAdminClient();
  const { data } = await db
    .from("calendar_members")
    .select(
      "calendar_id, role, calendar:calendars!calendar_members_calendar_id_fkey(user_id, owner:users!calendars_user_id_fkey(username, display_name))",
    )
    .eq("user_id", userId);
  const map = new Map<
    string,
    { role: MemberRole; ownerId: string; ownerUsername: string; ownerName: string | null }
  >();
  for (const row of data ?? []) {
    const cal = row.calendar as unknown as {
      user_id: string;
      owner: { username: string; display_name: string | null } | null;
    } | null;
    if (!cal) continue;
    map.set(row.calendar_id as string, {
      role: row.role as MemberRole,
      ownerId: cal.user_id,
      ownerUsername: cal.owner?.username ?? "",
      ownerName: cal.owner?.display_name ?? null,
    });
  }
  return map;
}

/** 이 캘린더에 일정을 쓸 수 있는지 (소유자 또는 editor). */
export async function canEditCalendar(
  userId: string,
  calendarId: string,
): Promise<boolean> {
  const db = getAdminClient();
  const { data: cal } = await db
    .from("calendars")
    .select("user_id")
    .eq("id", calendarId)
    .maybeSingle();
  if (!cal) return false;
  if (cal.user_id === userId) return true;
  const { data: member } = await db
    .from("calendar_members")
    .select("role")
    .eq("calendar_id", calendarId)
    .eq("user_id", userId)
    .maybeSingle();
  return member?.role === "editor";
}

/** 캘린더 멤버 목록 (소유자를 맨 앞에). */
export async function listMembers(
  calendarId: string,
): Promise<CalendarMember[] | { error: string }> {
  const db = getAdminClient();
  const { data: cal } = await db
    .from("calendars")
    .select("user_id, owner:users!calendars_user_id_fkey(username, display_name, avatar_url)")
    .eq("id", calendarId)
    .maybeSingle();
  if (!cal) return { error: "캘린더를 찾을 수 없어요." };

  const owner = cal.owner as unknown as {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;

  const { data: members } = await db
    .from("calendar_members")
    .select(
      "id, role, user_id, member:users!calendar_members_user_id_fkey(username, display_name, avatar_url)",
    )
    .eq("calendar_id", calendarId)
    .order("created_at", { ascending: true });

  const list: CalendarMember[] = [
    {
      id: "owner",
      userId: cal.user_id as string,
      username: owner?.username ?? "",
      displayName: owner?.display_name ?? null,
      avatarUrl: owner?.avatar_url ?? null,
      role: "editor",
      isOwner: true,
    },
  ];
  for (const m of members ?? []) {
    const user = m.member as unknown as {
      username: string;
      display_name: string | null;
      avatar_url: string | null;
    } | null;
    list.push({
      id: m.id as string,
      userId: m.user_id as string,
      username: user?.username ?? "",
      displayName: user?.display_name ?? null,
      avatarUrl: user?.avatar_url ?? null,
      role: m.role as MemberRole,
      isOwner: false,
    });
  }
  return list;
}

/** 멤버 초대 — 사용자명으로. 즉시 접근 권한을 주고 알림을 보낸다. */
export async function addMember(
  ownerId: string,
  calendarId: string,
  username: string,
  role: MemberRole = "editor",
): Promise<{ ok: true } | { error: string }> {
  const db = getAdminClient();
  const { data: cal } = await db
    .from("calendars")
    .select("id, user_id, name, source")
    .eq("id", calendarId)
    .maybeSingle();
  if (!cal) return { error: "캘린더를 찾을 수 없어요." };
  if (cal.user_id !== ownerId) return { error: "이 캘린더를 공유할 권한이 없어요." };
  if (cal.source !== "native") {
    return { error: "Google 연동 캘린더는 공유할 수 없어요. Google에서 직접 공유해 주세요." };
  }

  const { data: target } = await db
    .from("users")
    .select("id, username")
    .eq("username", username.trim().toLowerCase())
    .maybeSingle();
  if (!target) return { error: "사용자를 찾을 수 없어요." };
  if (target.id === ownerId) return { error: "이미 내 캘린더예요." };

  const { isBlockedEitherWay } = await import("@/lib/blocks");
  if (await isBlockedEitherWay(ownerId, target.id as string)) {
    return { error: "공유할 수 없는 상대예요." };
  }

  const { error } = await db.from("calendar_members").insert({
    calendar_id: calendarId,
    user_id: target.id,
    role,
    invited_by: ownerId,
  });
  if (error) {
    if (error.message.includes("duplicate")) return { error: "이미 함께 쓰고 있어요." };
    console.error("addMember", error);
    return { error: "공유에 실패했어요." };
  }

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
    type: "calendar_shared",
    title: `${label}님이 '${cal.name}' 캘린더를 함께 쓰자고 했어요`,
    body: role === "editor" ? "일정을 함께 기록할 수 있어요" : "일정을 볼 수 있어요",
    link: `/${owner?.username}`,
    actorId: ownerId,
  });
  return { ok: true };
}

/** 멤버 해제 — 소유자가 내보내거나, 멤버 본인이 나가기. */
export async function removeMember(
  actorId: string,
  calendarId: string,
  memberUserId: string,
): Promise<{ ok: true } | { error: string }> {
  const db = getAdminClient();
  const { data: cal } = await db
    .from("calendars")
    .select("user_id")
    .eq("id", calendarId)
    .maybeSingle();
  if (!cal) return { error: "캘린더를 찾을 수 없어요." };
  if (cal.user_id !== actorId && actorId !== memberUserId) {
    return { error: "권한이 없어요." };
  }
  const { error } = await db
    .from("calendar_members")
    .delete()
    .eq("calendar_id", calendarId)
    .eq("user_id", memberUserId);
  if (error) return { error: "해제에 실패했어요." };
  return { ok: true };
}
