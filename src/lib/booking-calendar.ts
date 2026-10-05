/**
 * 예약에 딸린 호스트의 Google 일정을 지운다. slots.ts 는 "use server" 라 여기 두지
 * 않으면 클라이언트에서 부를 수 있는 server action 이 되어 버린다 — 그래서 분리했다.
 */
import { getAdminClient } from "@/lib/supabase";
import { getAuthenticatedCalendar } from "@/lib/google";

export async function removeBookingCalendarEvent(bookingId: string) {
  try {
    const db = getAdminClient();
    const { data: booking } = await db
      .from("bookings")
      .select("google_event_id, host_id, slot:time_slots!bookings_slot_id_fkey(calendar_id)")
      .eq("id", bookingId)
      .maybeSingle();
    const eventId = booking?.google_event_id as string | null | undefined;
    if (!booking || !eventId) return;

    // Resolve the same calendar the event was created on.
    const slotInfo = booking.slot as unknown as {
      calendar_id: string | null;
    } | null;
    // We only get here when a Google event exists (eventId set). It lives on
    // the slot's Google calendar if one is set, otherwise the host's primary
    // (native-calendar slots are mirrored to primary when Google is linked).
    let calendarId = "primary";
    if (slotInfo?.calendar_id) {
      const { data: cal } = await db
        .from("calendars")
        .select("source, google_calendar_id")
        .eq("id", slotInfo.calendar_id)
        .single();
      if (cal?.source === "google" && cal.google_calendar_id) {
        calendarId = cal.google_calendar_id as string;
      }
    }

    const calendar = await getAuthenticatedCalendar(booking.host_id as string);
    if (!calendar) return;
    await calendar.events.delete({
      calendarId,
      eventId,
      sendUpdates: "all",
    });
    await db
      .from("bookings")
      .update({ google_event_id: null })
      .eq("id", bookingId);
  } catch (err) {
    console.error("removeBookingCalendarEvent", err);
  }
}
