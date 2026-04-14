"use server";

import { revalidatePath } from "next/cache";
import { getAdminClient } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import { getUserId, requireUserId } from "@/lib/db";
import { getAuthenticatedCalendar, sendGmailFromUser } from "@/lib/google";
import { computeAutoAvailability } from "@/lib/slot-availability";
import type { WorkingHours, AutoSlotOption } from "@/lib/slot-availability";

export type SlotType = "1on1" | "companion" | "group";
export type LocationType = "online" | "in_person" | "phone";
export type SlotMode = "manual" | "auto";

export type PricingModel = "fixed" | "auction";

export type TimeSlot = {
  id: string;
  host_id: string;
  slug: string;
  title: string;
  description: string | null;
  duration_min: number;
  price_cents: number;
  currency: string;
  capacity: number;
  slot_type: SlotType;
  location_type: LocationType | null;
  location_detail: string | null;
  active: boolean;
  mode: SlotMode;
  working_hours: WorkingHours;
  slot_interval_min: number;
  min_notice_hours: number;
  max_advance_days: number;
  buffer_min: number;
  pricing_model: PricingModel;
  reserve_price_cents: number | null;
  auction_ends_at: string | null;
  current_high_bid_cents: number | null;
  current_high_bidder_id: string | null;
  created_at: string;
};

export type Availability = {
  id: string;
  slot_id: string;
  start_at: string;
  capacity: number;
  booked_count: number;
};

export type SlotInput = {
  title: string;
  description?: string | null;
  duration_min: number;
  price_cents: number;
  capacity: number;
  slot_type: SlotType;
  location_type?: LocationType | null;
  location_detail?: string | null;
  active?: boolean;
  mode?: SlotMode;
  working_hours?: WorkingHours;
  slot_interval_min?: number;
  min_notice_hours?: number;
  max_advance_days?: number;
  buffer_min?: number;
  /** ISO datetime strings for initial availability windows (manual mode only) */
  availability_starts?: string[];
  pricing_model?: PricingModel;
  reserve_price_cents?: number | null;
  auction_ends_at?: string | null;
};

function slugify(title: string) {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base || "slot"}-${suffix}`;
}

export async function listMySlots(): Promise<TimeSlot[]> {
  const userId = await requireUserId();
  const db = getAdminClient();
  const { data } = await db
    .from("time_slots")
    .select("*")
    .eq("host_id", userId)
    .order("created_at", { ascending: false });
  return (data ?? []) as TimeSlot[];
}

export async function listPublicSlotsByUsername(username: string): Promise<TimeSlot[]> {
  const db = getAdminClient();
  const { data: user } = await db
    .from("users")
    .select("id")
    .eq("username", username)
    .single();
  if (!user) return [];

  const { data } = await db
    .from("time_slots")
    .select("*")
    .eq("host_id", user.id)
    .eq("active", true)
    .order("created_at", { ascending: false });
  return (data ?? []) as TimeSlot[];
}

export async function getSlotBySlug(
  username: string,
  slug: string,
): Promise<{ slot: TimeSlot; host: { username: string; display_name: string | null } } | null> {
  const db = getAdminClient();
  const { data: user } = await db
    .from("users")
    .select("id, username, display_name")
    .eq("username", username)
    .single();
  if (!user) return null;

  const { data: slot } = await db
    .from("time_slots")
    .select("*")
    .eq("host_id", user.id)
    .eq("slug", slug)
    .maybeSingle();
  if (!slot) return null;

  return {
    slot: slot as TimeSlot,
    host: { username: user.username as string, display_name: user.display_name as string | null },
  };
}

export type BookableOption = {
  /** For manual slots: availability row id. For auto: null. */
  availability_id: string | null;
  start_at: string;
  end_at: string;
  remaining: number;
};

export async function getBookableOptions(slot: TimeSlot): Promise<BookableOption[]> {
  if (slot.mode === "auto") {
    const opts = await computeAutoAvailability(slot.host_id, {
      duration_min: slot.duration_min,
      slot_interval_min: slot.slot_interval_min,
      working_hours: slot.working_hours ?? {},
      min_notice_hours: slot.min_notice_hours,
      max_advance_days: slot.max_advance_days,
      buffer_min: slot.buffer_min,
    });
    return opts.map((o: AutoSlotOption) => ({
      availability_id: null,
      start_at: o.start_at,
      end_at: o.end_at,
      remaining: 1,
    }));
  }

  const avails = await getUpcomingAvailabilities(slot.id);
  return avails
    .filter((a) => a.booked_count < a.capacity)
    .map((a) => ({
      availability_id: a.id,
      start_at: a.start_at,
      end_at: new Date(
        new Date(a.start_at).getTime() + slot.duration_min * 60_000,
      ).toISOString(),
      remaining: a.capacity - a.booked_count,
    }));
}

export async function getUpcomingAvailabilities(slotId: string): Promise<Availability[]> {
  const db = getAdminClient();
  const nowIso = new Date().toISOString();
  const { data } = await db
    .from("slot_availabilities")
    .select("*")
    .eq("slot_id", slotId)
    .gte("start_at", nowIso)
    .order("start_at", { ascending: true });
  return (data ?? []) as Availability[];
}

export async function createSlot(input: SlotInput) {
  const userId = await requireUserId();
  const db = getAdminClient();

  const slug = slugify(input.title);
  const { data: slot, error } = await db
    .from("time_slots")
    .insert({
      host_id: userId,
      slug,
      title: input.title,
      description: input.description ?? null,
      duration_min: input.duration_min,
      price_cents: input.price_cents,
      capacity: input.capacity,
      slot_type: input.slot_type,
      location_type: input.location_type ?? null,
      location_detail: input.location_detail ?? null,
      active: input.active ?? true,
      mode: input.mode ?? "manual",
      working_hours: input.working_hours ?? {},
      slot_interval_min: input.slot_interval_min ?? 30,
      min_notice_hours: input.min_notice_hours ?? 4,
      max_advance_days: input.max_advance_days ?? 30,
      buffer_min: input.buffer_min ?? 0,
      pricing_model: input.pricing_model ?? "fixed",
      reserve_price_cents: input.reserve_price_cents ?? null,
      auction_ends_at: input.auction_ends_at ?? null,
    })
    .select()
    .single();

  if (error || !slot) return { error: "슬롯 생성에 실패했습니다." };

  if (input.availability_starts && input.availability_starts.length > 0) {
    const rows = input.availability_starts.map((start_at) => ({
      slot_id: slot.id as string,
      start_at,
      capacity: input.capacity,
    }));
    await db.from("slot_availabilities").insert(rows);
  }

  revalidatePath("/", "layout");
  return { success: true, slug: slot.slug as string };
}

export async function updateSlot(id: string, patch: Partial<SlotInput>) {
  const userId = await requireUserId();
  const db = getAdminClient();
  const { error } = await db
    .from("time_slots")
    .update({
      title: patch.title,
      description: patch.description,
      duration_min: patch.duration_min,
      price_cents: patch.price_cents,
      capacity: patch.capacity,
      slot_type: patch.slot_type,
      location_type: patch.location_type,
      location_detail: patch.location_detail,
      active: patch.active,
      mode: patch.mode,
      working_hours: patch.working_hours,
      slot_interval_min: patch.slot_interval_min,
      min_notice_hours: patch.min_notice_hours,
      max_advance_days: patch.max_advance_days,
      buffer_min: patch.buffer_min,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("host_id", userId);
  if (error) return { error: "수정 실패" };
  revalidatePath("/", "layout");
  return { success: true };
}

export async function deleteSlot(id: string) {
  const userId = await requireUserId();
  const db = getAdminClient();
  const { error } = await db.from("time_slots").delete().eq("id", id).eq("host_id", userId);
  if (error) return { error: "삭제 실패" };
  revalidatePath("/", "layout");
  return { success: true };
}

export async function addAvailability(slotId: string, startAt: string, capacity?: number) {
  const userId = await requireUserId();
  const db = getAdminClient();

  // Verify slot ownership and pull capacity default
  const { data: slot } = await db
    .from("time_slots")
    .select("capacity, host_id")
    .eq("id", slotId)
    .single();
  if (!slot || slot.host_id !== userId) return { error: "권한 없음" };

  const { error } = await db.from("slot_availabilities").insert({
    slot_id: slotId,
    start_at: startAt,
    capacity: capacity ?? slot.capacity,
  });
  if (error) return { error: "추가 실패" };
  revalidatePath("/", "layout");
  return { success: true };
}

export async function removeAvailability(availabilityId: string) {
  const userId = await requireUserId();
  const db = getAdminClient();

  const { data: avail } = await db
    .from("slot_availabilities")
    .select("slot_id, slot:time_slots(host_id)")
    .eq("id", availabilityId)
    .single();

  const hostId = (avail?.slot as unknown as { host_id?: string } | null)?.host_id;
  if (!avail || hostId !== userId) return { error: "권한 없음" };

  const { error } = await db.from("slot_availabilities").delete().eq("id", availabilityId);
  if (error) return { error: "삭제 실패" };
  revalidatePath("/", "layout");
  return { success: true };
}

export async function bookSlot(args: {
  slotId: string;
  /** Manual mode */
  availabilityId?: string;
  /** Auto mode: ISO start time */
  startAt?: string;
  message?: string;
  guest_name?: string;
  guest_email?: string;
}) {
  const session = await getSession();
  const guestId = await getUserId();

  if (!session && !(args.guest_name && args.guest_email)) {
    return { error: "로그인하거나 이름/이메일을 입력해주세요." };
  }

  const db = getAdminClient();

  const { data: slot } = await db
    .from("time_slots")
    .select(
      "id, host_id, duration_min, active, mode, pricing_model, title, location_detail, working_hours, slot_interval_min, min_notice_hours, max_advance_days, buffer_min, capacity",
    )
    .eq("id", args.slotId)
    .single();
  if (!slot || !slot.active) return { error: "예약할 수 없는 슬롯입니다." };
  if (slot.pricing_model === "auction") {
    return { error: "경매 슬롯은 입찰을 통해 거래됩니다." };
  }

  let startAt: Date;
  let availabilityId: string | null = null;

  if (slot.mode === "auto") {
    if (!args.startAt) return { error: "시간을 선택해주세요." };
    startAt = new Date(args.startAt);

    // Re-validate against current free/busy and working hours.
    const options = await computeAutoAvailability(slot.host_id as string, {
      duration_min: slot.duration_min as number,
      slot_interval_min: slot.slot_interval_min as number,
      working_hours: (slot.working_hours ?? {}) as WorkingHours,
      min_notice_hours: slot.min_notice_hours as number,
      max_advance_days: slot.max_advance_days as number,
      buffer_min: slot.buffer_min as number,
    });
    const ok = options.some(
      (o) => new Date(o.start_at).getTime() === startAt.getTime(),
    );
    if (!ok) return { error: "이미 지나갔거나 잡을 수 없는 시간입니다." };
  } else {
    if (!args.availabilityId) return { error: "시간을 선택해주세요." };
    const { data: avail } = await db
      .from("slot_availabilities")
      .select("id, slot_id, start_at, capacity, booked_count")
      .eq("id", args.availabilityId)
      .single();
    if (!avail) return { error: "시간을 찾을 수 없습니다." };
    if ((avail.booked_count as number) >= (avail.capacity as number)) {
      return { error: "이미 마감된 시간입니다." };
    }
    if (avail.slot_id !== slot.id) return { error: "잘못된 요청입니다." };
    startAt = new Date(avail.start_at as string);
    availabilityId = avail.id as string;
  }

  const endAt = new Date(startAt.getTime() + (slot.duration_min as number) * 60_000);

  // Create the booking row first so we never lose it on a Google API failure.
  const { data: booking, error: bookErr } = await db
    .from("bookings")
    .insert({
      slot_id: slot.id,
      availability_id: availabilityId,
      host_id: slot.host_id,
      guest_id: guestId,
      guest_name: args.guest_name ?? null,
      guest_email: args.guest_email ?? null,
      message: args.message ?? null,
      scheduled_at: startAt.toISOString(),
      scheduled_end_at: endAt.toISOString(),
    })
    .select("id")
    .single();
  if (bookErr || !booking) return { error: "예약에 실패했습니다." };

  if (availabilityId) {
    await db
      .from("slot_availabilities")
      .update({ booked_count: ((slot.capacity as number) ?? 1) })
      .eq("id", availabilityId);
  }

  // Best-effort: create a Google Calendar event on the host's primary calendar.
  try {
    const calendar = await getAuthenticatedCalendar(slot.host_id as string);
    if (calendar) {
      const guestEmail =
        args.guest_email ?? (await getEmailForUser(guestId));
      const guestLabel = args.guest_name ?? (guestId ? "Guest" : "Guest");
      const ev = await calendar.events.insert({
        calendarId: "primary",
        sendUpdates: guestEmail ? "all" : "none",
        requestBody: {
          summary: `[Orbit42] ${slot.title} — ${guestLabel}`,
          description:
            (args.message ? `${args.message}\n\n` : "") +
            `Booked via orbit42 · slot: ${slot.title}`,
          start: { dateTime: startAt.toISOString(), timeZone: "Asia/Seoul" },
          end: { dateTime: endAt.toISOString(), timeZone: "Asia/Seoul" },
          location: (slot.location_detail as string | null) ?? undefined,
          attendees: guestEmail ? [{ email: guestEmail, displayName: guestLabel }] : undefined,
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
    console.error("Google Calendar booking insert failed:", err);
  }

  // Best-effort: send a confirmation email to the guest from the host's Gmail.
  const guestEmailFinal =
    args.guest_email ?? (await getEmailForUser(guestId));
  if (guestEmailFinal) {
    const when = startAt.toLocaleString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
    void sendGmailFromUser(slot.host_id as string, {
      to: guestEmailFinal,
      subject: `[Orbit42] 예약 확인: ${slot.title}`,
      body: [
        `안녕하세요${args.guest_name ? ` ${args.guest_name}님` : ""},`,
        ``,
        `요청하신 시간으로 예약이 등록되었습니다.`,
        ``,
        `· 슬롯: ${slot.title}`,
        `· 시간: ${when} (${slot.duration_min}분)`,
        slot.location_detail ? `· 장소: ${slot.location_detail}` : null,
        ``,
        `이 메일은 Orbit42에서 자동으로 발송되었습니다.`,
      ]
        .filter(Boolean)
        .join("\n"),
    });
  }

  revalidatePath("/", "layout");
  return { success: true };
}

async function getEmailForUser(userId: string | null): Promise<string | null> {
  if (!userId) return null;
  // We don't store emails for users yet; placeholder for future expansion.
  return null;
}

export type BookingRow = {
  id: string;
  scheduled_at: string;
  scheduled_end_at: string;
  status: string;
  message: string | null;
  guest_name: string | null;
  guest_email: string | null;
  guest: { username: string; display_name: string | null } | null;
  slot: { title: string; slug: string };
};

export async function listMyHostBookings(): Promise<BookingRow[]> {
  const userId = await requireUserId();
  const db = getAdminClient();
  const { data } = await db
    .from("bookings")
    .select(
      "id, scheduled_at, scheduled_end_at, status, message, guest_name, guest_email, guest:users!bookings_guest_id_fkey(username, display_name), slot:time_slots!bookings_slot_id_fkey(title, slug)",
    )
    .eq("host_id", userId)
    .order("scheduled_at", { ascending: true });
  return ((data ?? []) as unknown) as BookingRow[];
}

export async function updateBookingStatus(
  id: string,
  status: "confirmed" | "canceled" | "completed",
) {
  const userId = await requireUserId();
  const db = getAdminClient();

  const { data: booking } = await db
    .from("bookings")
    .select("guest_email, guest_name, scheduled_at, slot:time_slots!bookings_slot_id_fkey(title)")
    .eq("id", id)
    .eq("host_id", userId)
    .single();

  const { error } = await db
    .from("bookings")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("host_id", userId);
  if (error) return { error: "변경 실패" };

  if (booking && booking.guest_email && status !== "completed") {
    const slotTitle =
      (booking.slot as unknown as { title: string } | null)?.title ?? "예약";
    const when = new Date(booking.scheduled_at as string).toLocaleString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    void sendGmailFromUser(userId, {
      to: booking.guest_email as string,
      subject: `[Orbit42] 예약 ${status === "confirmed" ? "확정" : "취소"}: ${slotTitle}`,
      body:
        status === "confirmed"
          ? `${booking.guest_name ?? "안녕하세요"}님, ${when} 예약이 확정되었습니다.\n\nOrbit42`
          : `${booking.guest_name ?? "안녕하세요"}님, ${when} 예약이 취소되었습니다. 죄송합니다.\n\nOrbit42`,
    });
  }

  revalidatePath("/", "layout");
  return { success: true };
}
