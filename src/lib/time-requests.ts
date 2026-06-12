"use server";

import { revalidatePath } from "next/cache";
import { getAdminClient } from "@/lib/supabase";
import { requireUserId } from "@/lib/db";
import { getAuthenticatedCalendar } from "@/lib/google";

export type TimeRequestRow = {
  id: string;
  message: string;
  duration_min: number;
  budget_cents: number | null;
  preferred_times: string | null;
  status: string;
  created_at: string;
  requester: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
  host: {
    username: string;
    display_name: string | null;
  } | null;
};

/** Ask someone to open time for you ("이런 시간 열어주세요"). */
export async function createTimeRequest(
  hostUsername: string,
  input: {
    message: string;
    duration_min: number;
    budget_cents?: number | null;
    preferred_times?: string | null;
  },
) {
  const userId = await requireUserId();
  const message = input.message.trim();
  if (!message) return { error: "어떤 시간이 필요한지 알려주세요." };
  const duration = Math.min(Math.max(input.duration_min || 60, 15), 24 * 60);

  const db = getAdminClient();
  const { data: host } = await db
    .from("users")
    .select("id, username, display_name, email, email_verified")
    .eq("username", hostUsername)
    .single();
  if (!host) return { error: "사용자를 찾을 수 없어요." };
  if (host.id === userId) return { error: "나에게는 요청할 수 없어요." };

  // One open request per (requester, host) keeps inboxes sane.
  const { data: existing } = await db
    .from("time_requests")
    .select("id")
    .eq("requester_id", userId)
    .eq("host_id", host.id)
    .eq("status", "pending")
    .maybeSingle();
  if (existing) return { error: "이미 대기 중인 요청이 있어요." };

  const { error } = await db.from("time_requests").insert({
    requester_id: userId,
    host_id: host.id,
    message: message.slice(0, 2000),
    duration_min: duration,
    budget_cents: input.budget_cents ?? null,
    preferred_times: input.preferred_times?.trim().slice(0, 500) || null,
  });
  if (error) {
    console.error("createTimeRequest", error);
    return { error: "요청 전송에 실패했어요." };
  }

  // Notify the host (bell + pref-gated email).
  try {
    const { data: requester } = await db
      .from("users")
      .select("username, display_name")
      .eq("id", userId)
      .single();
    const label =
      (requester?.display_name as string | null) ||
      (requester?.username as string) ||
      "누군가";
    const { createNotification } = await import("@/lib/notifications");
    await createNotification({
      userId: host.id as string,
      type: "time_request",
      title: `${label}님이 시간을 요청했어요`,
      body: message.slice(0, 120),
      link: `/${host.username}/bookings`,
      actorId: userId,
    });
    const { emailAllowed } = await import("@/lib/notification-prefs");
    if (
      host.email &&
      host.email_verified &&
      (await emailAllowed(host.id as string, "time_request"))
    ) {
      const { sendTimeRequestEmail } = await import("@/lib/email");
      await sendTimeRequestEmail(host.email as string, {
        requesterLabel: label,
        message,
        durationMin: duration,
        budgetCents: input.budget_cents ?? null,
        preferredTimes: input.preferred_times ?? null,
        manageUrl: `/${host.username}/bookings`,
      });
    }
  } catch (err) {
    console.error("createTimeRequest notify", err);
  }

  revalidatePath("/", "layout");
  return { ok: true as const };
}

export async function listRequestsForHost(): Promise<TimeRequestRow[]> {
  const userId = await requireUserId().catch(() => null);
  if (!userId) return [];
  const db = getAdminClient();
  const { data } = await db
    .from("time_requests")
    .select(
      "id, message, duration_min, budget_cents, preferred_times, status, created_at, requester:users!time_requests_requester_id_fkey(username, display_name, avatar_url)",
    )
    .eq("host_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(50);
  return ((data ?? []) as unknown as TimeRequestRow[]).map((r) => ({
    ...r,
    host: null,
  }));
}

export async function listMyRequests(): Promise<TimeRequestRow[]> {
  const userId = await requireUserId().catch(() => null);
  if (!userId) return [];
  const db = getAdminClient();
  const { data } = await db
    .from("time_requests")
    .select(
      "id, message, duration_min, budget_cents, preferred_times, status, created_at, host:users!time_requests_host_id_fkey(username, display_name)",
    )
    .eq("requester_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  return ((data ?? []) as unknown as TimeRequestRow[]).map((r) => ({
    ...r,
    requester: null,
  }));
}

/**
 * Host accepts: picks a concrete time, which becomes a confirmed
 * booking on a hidden one-off slot (the bookings table requires one).
 */
export async function acceptTimeRequest(requestId: string, startAtIso: string) {
  const userId = await requireUserId();
  const db = getAdminClient();

  const { data: req } = await db
    .from("time_requests")
    .select("id, requester_id, host_id, message, duration_min, budget_cents, status")
    .eq("id", requestId)
    .eq("host_id", userId)
    .maybeSingle();
  if (!req) return { error: "요청을 찾을 수 없어요." };
  if (req.status !== "pending") return { error: "이미 처리된 요청이에요." };

  const startAt = new Date(startAtIso);
  if (isNaN(startAt.getTime()) || startAt < new Date()) {
    return { error: "미래의 시간을 선택해주세요." };
  }
  const endAt = new Date(
    startAt.getTime() + (req.duration_min as number) * 60_000,
  );

  const [{ data: requester }, { data: host }] = await Promise.all([
    db
      .from("users")
      .select("username, display_name, email")
      .eq("id", req.requester_id)
      .single(),
    db
      .from("users")
      .select("username, display_name, email")
      .eq("id", userId)
      .single(),
  ]);
  const requesterLabel = (requester?.display_name ||
    requester?.username ||
    "게스트") as string;

  // Hidden one-off slot to anchor the booking.
  const { data: slot, error: slotErr } = await db
    .from("time_slots")
    .insert({
      host_id: userId,
      slug: `request-${requestId.slice(0, 8)}`,
      title: `요청 미팅 · ${requesterLabel}`,
      description: req.message,
      duration_min: req.duration_min,
      price_cents: req.budget_cents ?? 0,
      capacity: 1,
      slot_type: "1on1",
      active: false,
    })
    .select("id, title")
    .single();
  if (slotErr || !slot) {
    console.error("acceptTimeRequest slot insert", slotErr);
    return { error: "수락 처리에 실패했어요." };
  }

  const { data: booking, error: bookErr } = await db
    .from("bookings")
    .insert({
      slot_id: slot.id,
      availability_id: null,
      host_id: userId,
      guest_id: req.requester_id,
      scheduled_at: startAt.toISOString(),
      scheduled_end_at: endAt.toISOString(),
      status: "confirmed",
      message: req.message,
    })
    .select("id")
    .single();
  if (bookErr || !booking) {
    console.error("acceptTimeRequest booking insert", bookErr);
    return { error: "예약 생성에 실패했어요." };
  }

  await db
    .from("time_requests")
    .update({
      status: "accepted",
      booking_id: booking.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", requestId);

  // Best-effort Google mirror on the host's primary calendar.
  try {
    const calendar = await getAuthenticatedCalendar(userId);
    if (calendar) {
      const ev = await calendar.events.insert({
        calendarId: "primary",
        sendUpdates: requester?.email ? "all" : "none",
        requestBody: {
          summary: `[Orbit42] 요청 미팅 — ${requesterLabel}`,
          description: req.message as string,
          start: { dateTime: startAt.toISOString(), timeZone: "Asia/Seoul" },
          end: { dateTime: endAt.toISOString(), timeZone: "Asia/Seoul" },
          attendees: requester?.email
            ? [{ email: requester.email as string, displayName: requesterLabel }]
            : undefined,
        },
      });
      if (ev.data.id) {
        await db
          .from("bookings")
          .update({ google_event_id: ev.data.id })
          .eq("id", booking.id);
      }
    }
  } catch (err) {
    console.error("acceptTimeRequest calendar", err);
  }

  // Tell the requester.
  try {
    const whenLabel = startAt.toLocaleString("ko-KR", {
      timeZone: "Asia/Seoul",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    const { createNotification } = await import("@/lib/notifications");
    await createNotification({
      userId: req.requester_id as string,
      type: "booking_confirmed",
      title: `시간 요청이 수락됐어요`,
      body: `${host?.display_name || host?.username} · ${whenLabel}`,
      link: `/bookings`,
      actorId: userId,
    });
    const { emailAllowed } = await import("@/lib/notification-prefs");
    if (
      requester?.email &&
      (await emailAllowed(req.requester_id as string, "booking_confirmed"))
    ) {
      const { sendBookingConfirmedToGuest } = await import("@/lib/email");
      await sendBookingConfirmedToGuest(requester.email as string, {
        slotTitle: slot.title as string,
        when: startAt.toISOString(),
        hostLabel: (host?.display_name || host?.username || "Host") as string,
        location: null,
      });
    }
  } catch (err) {
    console.error("acceptTimeRequest notify", err);
  }

  revalidatePath("/", "layout");
  return { ok: true as const };
}

export async function declineTimeRequest(requestId: string) {
  const userId = await requireUserId();
  const db = getAdminClient();
  const { data: req } = await db
    .from("time_requests")
    .select("id, requester_id, status")
    .eq("id", requestId)
    .eq("host_id", userId)
    .maybeSingle();
  if (!req) return { error: "요청을 찾을 수 없어요." };
  if (req.status !== "pending") return { error: "이미 처리된 요청이에요." };

  await db
    .from("time_requests")
    .update({ status: "declined", updated_at: new Date().toISOString() })
    .eq("id", requestId);

  try {
    const { data: host } = await db
      .from("users")
      .select("username, display_name")
      .eq("id", userId)
      .single();
    const { createNotification } = await import("@/lib/notifications");
    await createNotification({
      userId: req.requester_id as string,
      type: "time_request",
      title: `${host?.display_name || host?.username}님이 지금은 시간을 내기 어렵대요`,
      body: "다른 시간이나 다른 사람에게 다시 요청해보세요.",
      link: host?.username ? `/${host.username}` : null,
      actorId: userId,
    });
  } catch (err) {
    console.error("declineTimeRequest notify", err);
  }

  revalidatePath("/", "layout");
  return { ok: true as const };
}
