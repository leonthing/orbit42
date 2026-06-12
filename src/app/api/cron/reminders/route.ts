import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import { sendBookingReminderEmail } from "@/lib/email";
import { emailAllowed } from "@/lib/notification-prefs";
import { createNotification } from "@/lib/notifications";

/**
 * 24h-before booking reminders. Runs hourly; picks up confirmed
 * bookings inside the next-24h window that haven't been reminded yet.
 * Fresh bookings (created within the last 2h) are skipped — their
 * confirmation email just went out. Gated by CRON_SECRET.
 */
function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;
  return request.nextUrl.searchParams.get("key") === secret;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = getAdminClient();
  const now = new Date();
  const windowEnd = new Date(now.getTime() + 24 * 60 * 60_000);
  const freshCutoff = new Date(now.getTime() - 2 * 60 * 60_000);

  const { data: due, error } = await db
    .from("bookings")
    .select(
      "id, host_id, guest_id, guest_name, guest_email, scheduled_at, selected_location, slot:time_slots!bookings_slot_id_fkey(title, location_detail)",
    )
    .eq("status", "confirmed")
    .is("reminder_sent_at", null)
    .gt("scheduled_at", now.toISOString())
    .lte("scheduled_at", windowEnd.toISOString())
    .lt("created_at", freshCutoff.toISOString())
    .limit(200);
  if (error) {
    console.error("reminders cron select", error);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  let sent = 0;

  for (const b of due ?? []) {
    // Mark first — a retried cron run must never double-send.
    const { error: markErr } = await db
      .from("bookings")
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq("id", b.id)
      .is("reminder_sent_at", null);
    if (markErr) continue;

    const slotInfo = b.slot as unknown as {
      title: string;
      location_detail: string | null;
    } | null;
    const slotTitle = slotInfo?.title ?? "예약";
    const location =
      (b.selected_location as string | null) ??
      slotInfo?.location_detail ??
      null;
    const whenLabel = new Date(b.scheduled_at as string).toLocaleString(
      "ko-KR",
      {
        timeZone: "Asia/Seoul",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      },
    );

    const [{ data: host }, { data: guest }] = await Promise.all([
      db
        .from("users")
        .select("email, display_name, username")
        .eq("id", b.host_id)
        .single(),
      b.guest_id
        ? db
            .from("users")
            .select("email, display_name, username")
            .eq("id", b.guest_id)
            .single()
        : Promise.resolve({ data: null }),
    ]);
    const hostLabel = (host?.display_name || host?.username || "Host") as string;
    const guestLabel = ((b.guest_name as string | null) ||
      guest?.display_name ||
      guest?.username ||
      "게스트") as string;

    try {
      if (
        host?.email &&
        (await emailAllowed(b.host_id as string, "booking_reminder"))
      ) {
        await sendBookingReminderEmail(host.email as string, {
          role: "host",
          slotTitle,
          when: b.scheduled_at as string,
          otherLabel: guestLabel,
          location,
          manageUrl: `/${host.username}/bookings`,
        });
      }
      const guestEmail =
        (b.guest_email as string | null) ?? (guest?.email as string | null);
      if (
        guestEmail &&
        (await emailAllowed(b.guest_id as string | null, "booking_reminder"))
      ) {
        await sendBookingReminderEmail(guestEmail, {
          role: "guest",
          slotTitle,
          when: b.scheduled_at as string,
          otherLabel: hostLabel,
          location,
          manageUrl: `/bookings`,
        });
      }
    } catch (err) {
      console.error("reminders cron email", err);
    }

    // In-app bells for both registered parties.
    try {
      await createNotification({
        userId: b.host_id as string,
        type: "booking_reminder",
        title: `내일 예약: ${slotTitle}`,
        body: `${guestLabel} · ${whenLabel}`,
        link: `/${host?.username}/bookings`,
        actorId: null,
      });
      if (b.guest_id) {
        await createNotification({
          userId: b.guest_id as string,
          type: "booking_reminder",
          title: `내일 예약: ${slotTitle}`,
          body: `${hostLabel} · ${whenLabel}`,
          link: `/bookings`,
          actorId: null,
        });
      }
    } catch (err) {
      console.error("reminders cron notification", err);
    }

    sent++;
  }

  return NextResponse.json({ ok: true, sent });
}
