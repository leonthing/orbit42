import { getAdminClient } from "@/lib/supabase";
import { clientKey, rateLimit, rateLimitExceeded } from "@/lib/rate-limit";
import {
  bookingIcs,
  isWellFormedToken,
  manageExpired,
  manageTokenHash,
} from "@/lib/guest-manage";
import { siteUrl } from "@/lib/email";

export const dynamic = "force-dynamic";

/**
 * 게스트 예약 관리 (개선-40) — 로그인 없이, 관리 링크의 토큰 하나로 그 예약 하나만.
 * POST { token, action: "view" | "options" | "cancel" | "reschedule" | "ics" | "reminders", confirm?, startAt?, availabilityId?, on? }
 * - reminders: 이 예약의 게스트 리마인더 메일 끄기/켜기(on: boolean). 다른 메일·호스트 쪽은 그대로.
 * - 시간 바꾸기는 같은 예약 행에서 시간만 옮긴다(새 시간이 잡혀야 바뀌고, 실패하면 그대로, 호스트 알림 한 번).
 * - 토큰은 본문으로만 받는다(URL·로그에 남지 않게). 로그에도 토큰을 적지 않는다.
 * - 잘못된 토큰은 IP당 15분에 20번까지(넘으면 429), 전체 요청은 IP당 15분에 120번까지.
 * - 만료(예약 끝 + 7일)·취소·완료된 예약은 조회만.
 * - 입금 대기 예약은 결제 안내까지만 보인다(확정·입금 처리는 호스트만).
 */
const MISS_LIMIT = 20;
const WINDOW_MS = 15 * 60_000;

type Body = { token?: unknown; action?: unknown; confirm?: unknown; startAt?: unknown; availabilityId?: unknown; on?: unknown };

const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });

export async function POST(request: Request) {
  const all = rateLimit(clientKey("guest-manage"), 120, WINDOW_MS);
  if (!all.ok) return json({ error: "잠시 후 다시 시도해 주세요." }, 429);
  const missKey = clientKey("guest-manage-miss");
  const blocked = rateLimitExceeded(missKey, MISS_LIMIT);
  if (blocked.exceeded) return json({ error: "잠시 후 다시 시도해 주세요." }, 429);

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return json({ error: "잘못된 요청이에요." }, 400);
  }
  const notFound = () => {
    rateLimit(missKey, MISS_LIMIT, WINDOW_MS);
    return json({ error: "예약을 찾을 수 없어요. 링크가 바뀌었거나 만료됐을 수 있어요." }, 404);
  };
  if (!isWellFormedToken(body.token)) return notFound();

  const db = getAdminClient();
  const { data: b } = await db
    .from("bookings")
    .select(
      "id, slot_id, host_id, guest_id, guest_name, scheduled_at, scheduled_end_at, status, selected_location, payment_status, payment_due_at, reschedule_by, reschedule_start_at, reschedule_end_at, reschedule_note, guest_reminders_off_at, slot:time_slots!bookings_slot_id_fkey(id, title, location_detail, price_cents, duration_min), host:users!bookings_host_id_fkey(username, display_name, payment_instructions)",
    )
    .eq("guest_manage_token_hash", manageTokenHash(body.token))
    .maybeSingle();
  if (!b) return notFound();

  const slot = b.slot as unknown as { id: string; title: string; location_detail: string | null; price_cents: number | null; duration_min: number } | null;
  const host = b.host as unknown as { username: string; display_name: string | null; payment_instructions: string | null } | null;
  const hostLabel = host?.display_name || host?.username || "호스트";
  const endIso = (b.scheduled_end_at as string | null) ?? new Date(new Date(b.scheduled_at as string).getTime() + (slot?.duration_min ?? 60) * 60_000).toISOString();
  const expired = manageExpired(b.scheduled_end_at as string | null, b.scheduled_at as string);
  const live = b.status === "pending" || b.status === "confirmed";
  const ended = new Date(endIso).getTime() <= Date.now();
  const canCancel = !expired && live && !ended;
  const canPropose = !expired && live && new Date(b.scheduled_at as string).getTime() > Date.now();
  const canToggleReminders = !expired && live && !ended;
  // 계정이 있는 게스트면 그 계정으로, 없으면 링크 게스트로 행동한다
  const actor = { userId: (b.guest_id as string | null) ?? null };
  const action = typeof body.action === "string" ? body.action : "view";

  if (action === "ics") {
    if (!slot) return notFound();
    const ics = bookingIcs({
      id: b.id as string,
      title: slot.title,
      start: b.scheduled_at as string,
      end: endIso,
      location: (b.selected_location as string | null) ?? slot.location_detail,
      hostLabel,
    });
    return new Response(ics, {
      headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
    });
  }

  if (action === "cancel") {
    if (body.confirm !== true) return json({ error: "취소를 한 번 더 확인해 주세요." }, 400);
    if (!canCancel) return json({ error: ended ? "이미 지난 예약은 취소할 수 없어요." : "이 예약은 취소할 수 없어요." }, 400);
    const { cancelBookingAsGuest } = await import("@/lib/slots");
    const res = await cancelBookingAsGuest(b.id as string, actor);
    if ("error" in res) return json({ error: res.error }, 400);
    return json({ ok: true });
  }

  if (action === "reschedule") {
    if (!canPropose) return json({ error: "이 예약은 시간을 바꿀 수 없어요." }, 400);
    if (body.confirm !== true) return json({ error: "바꿀 시간을 한 번 더 확인해 주세요." }, 400);
    const pick = {
      startAt: typeof body.startAt === "string" ? body.startAt : undefined,
      availabilityId: typeof body.availabilityId === "string" ? body.availabilityId : undefined,
    };
    if (!pick.startAt && !pick.availabilityId) return json({ error: "시간을 골라 주세요." }, 400);
    const { rescheduleBookingAsGuest } = await import("@/lib/slots");
    const res = await rescheduleBookingAsGuest(b.id as string, actor, pick);
    if ("error" in res) return json({ error: res.error }, 400);
    return json({ ok: true, status: res.status });
  }

  if (action === "reminders") {
    if (typeof body.on !== "boolean") return json({ error: "잘못된 요청이에요." }, 400);
    if (!canToggleReminders) return json({ error: "이 예약은 알림 설정을 바꿀 수 없어요." }, 400);
    const { error } = await db
      .from("bookings")
      .update({ guest_reminders_off_at: body.on ? null : new Date().toISOString() })
      .eq("id", b.id as string);
    if (error) {
      console.error("[guest-booking] reminders", error.message);
      return json({ error: "알림 설정을 바꾸지 못했어요. 잠시 후 다시 시도해 주세요." }, 500);
    }
    return json({ ok: true, remindersOn: body.on });
  }

  if (action === "options") {
    if (!canPropose || !slot) return json({ options: [] });
    const { data: fullSlot } = await db.from("time_slots").select("*").eq("id", slot.id).single();
    if (!fullSlot) return json({ options: [] });
    const { getBookableOptions } = await import("@/lib/slots");
    const options = await getBookableOptions(fullSlot as never, (b.selected_location as string | null) ?? null);
    return json({
      options: options
        .filter((o) => new Date(o.start_at).getTime() !== new Date(b.scheduled_at as string).getTime())
        .slice(0, 80)
        .map((o) => ({ startAt: o.start_at, endAt: o.end_at, availabilityId: o.availability_id ?? null })),
    });
  }

  // view
  const proposal = b.reschedule_start_at
    ? {
        startAt: b.reschedule_start_at as string,
        endAt: b.reschedule_end_at as string,
        note: (b.reschedule_note as string | null) ?? null,
        byMe: Boolean(actor.userId && b.reschedule_by === actor.userId),
      }
    : null;
  const awaiting = b.payment_status === "awaiting";
  return json({
    booking: {
      title: slot?.title ?? "예약",
      hostName: hostLabel,
      hostPageUrl: host?.username ? siteUrl(`/${host.username}`) : null,
      guestName: (b.guest_name as string | null) ?? null,
      startAt: b.scheduled_at,
      endAt: endIso,
      location: (b.selected_location as string | null) ?? slot?.location_detail ?? null,
      status: b.status,
      priceCents: slot?.price_cents ?? 0,
      payment: awaiting
        ? { status: "awaiting", dueAt: b.payment_due_at, instructions: host?.payment_instructions ?? null }
        : b.payment_status
          ? { status: b.payment_status, dueAt: null, instructions: null }
          : null,
      proposal,
      expired,
      ended,
      canCancel,
      canPropose,
      remindersOn: !b.guest_reminders_off_at,
      canToggleReminders,
    },
  });
}
