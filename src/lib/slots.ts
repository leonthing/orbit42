"use server";

import { revalidatePath } from "next/cache";
import { getAdminClient } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import { getUserId, requireUserId } from "@/lib/db";
import { getAuthenticatedCalendar } from "@/lib/google";
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
  calendar_id: string | null;
  valid_from: string | null;
  valid_until: string | null;
  auto_approve: boolean;
  payment_method: "online" | "offline";
  image_urls: string[];
  show_on_feed: boolean;
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
  calendar_id?: string | null;
  valid_from?: string | null;
  valid_until?: string | null;
  auto_approve?: boolean;
  payment_method?: "online" | "offline";
  image_urls?: string[];
  show_on_feed?: boolean;
};

function safeDecode(s: string) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

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

  const decoded = safeDecode(slug);
  const { data: slot } = await db
    .from("time_slots")
    .select("*")
    .eq("host_id", user.id)
    .eq("slug", decoded)
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
  const from = slot.valid_from ? new Date(slot.valid_from).getTime() : null;
  const until = slot.valid_until ? new Date(slot.valid_until).getTime() : null;
  const withinWindow = (iso: string) => {
    const t = new Date(iso).getTime();
    if (from !== null && t < from) return false;
    if (until !== null && t > until) return false;
    return true;
  };

  if (slot.mode === "auto") {
    // When valid_until is set, extend the horizon to cover the full
    // validity period instead of being capped by max_advance_days.
    let effectiveMaxDays = slot.max_advance_days;
    if (until !== null) {
      const daysToEnd = Math.ceil((until - Date.now()) / 86_400_000);
      effectiveMaxDays = Math.max(effectiveMaxDays, Math.min(daysToEnd, 365));
    }
    const opts = await computeAutoAvailability(slot.host_id, {
      duration_min: slot.duration_min,
      slot_interval_min: slot.slot_interval_min,
      working_hours: slot.working_hours ?? {},
      min_notice_hours: slot.min_notice_hours,
      max_advance_days: effectiveMaxDays,
      buffer_min: slot.buffer_min,
    });
    return opts
      .filter((o: AutoSlotOption) => withinWindow(o.start_at))
      .map((o: AutoSlotOption) => ({
        availability_id: null,
        start_at: o.start_at,
        end_at: o.end_at,
        remaining: 1,
      }));
  }

  const avails = await getUpcomingAvailabilities(slot.id);
  return avails
    .filter((a) => a.booked_count < a.capacity)
    .filter((a) => withinWindow(a.start_at))
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

  // Validate or resolve target calendar.
  let calendarId = input.calendar_id ?? null;
  let calendarVisibility: string | null = null;
  if (calendarId) {
    const { data: cal } = await db
      .from("calendars")
      .select("user_id, visibility")
      .eq("id", calendarId)
      .single();
    if (!cal || cal.user_id !== userId) {
      return { error: "선택한 캘린더에 권한이 없어요." };
    }
    calendarVisibility = cal.visibility as string;
  } else {
    const { data: def } = await db
      .from("calendars")
      .select("id, visibility")
      .eq("user_id", userId)
      .eq("is_default", true)
      .maybeSingle();
    calendarId = def?.id ?? null;
    calendarVisibility = (def?.visibility as string) ?? null;
  }

  // Sellable slots (fixed price) need a publicly-visible calendar so the
  // public booking page is discoverable. Auction slots bypass this since
  // they live on the auction landing page.
  const pricing = input.pricing_model ?? "fixed";
  const priceGt0 = (input.price_cents ?? 0) > 0;
  if (pricing === "fixed" && priceGt0 && calendarVisibility !== "public") {
    return {
      error:
        "유료 슬롯은 공개(public) 캘린더에만 만들 수 있어요. 캘린더 공개 설정을 바꾸거나 다른 캘린더를 선택해주세요.",
    };
  }

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
      calendar_id: calendarId,
      valid_from: input.valid_from ?? null,
      valid_until: input.valid_until ?? null,
      auto_approve: input.auto_approve ?? true,
      payment_method: input.payment_method ?? "offline",
      image_urls: input.image_urls ?? [],
      show_on_feed: input.show_on_feed ?? true,
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
  return { success: true, slug: slot.slug as string, id: slot.id as string };
}

export async function updateSlot(id: string, patch: Partial<SlotInput>) {
  const userId = await requireUserId();
  const db = getAdminClient();
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  const fields: (keyof SlotInput)[] = [
    "title",
    "description",
    "duration_min",
    "price_cents",
    "capacity",
    "slot_type",
    "location_type",
    "location_detail",
    "active",
    "mode",
    "working_hours",
    "slot_interval_min",
    "min_notice_hours",
    "max_advance_days",
    "buffer_min",
    "calendar_id",
    "valid_from",
    "valid_until",
    "auto_approve",
    "payment_method",
    "image_urls",
    "show_on_feed",
  ];
  for (const f of fields) {
    if (patch[f] !== undefined) updateData[f] = patch[f];
  }
  const { error } = await db
    .from("time_slots")
    .update(updateData)
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
  /** Selected add-on menu ids (must belong to the slot). */
  selected_menu_ids?: string[];
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
      "id, host_id, duration_min, active, mode, pricing_model, title, location_detail, working_hours, slot_interval_min, min_notice_hours, max_advance_days, buffer_min, capacity, calendar_id, valid_from, valid_until, auto_approve",
    )
    .eq("id", args.slotId)
    .single();
  if (!slot || !slot.active) return { error: "예약할 수 없는 슬롯입니다." };
  if (slot.pricing_model === "auction") {
    return { error: "경매 슬롯은 입찰을 통해 거래됩니다." };
  }

  const windowFrom = slot.valid_from
    ? new Date(slot.valid_from as string).getTime()
    : null;
  const windowUntil = slot.valid_until
    ? new Date(slot.valid_until as string).getTime()
    : null;

  let startAt: Date;
  let availabilityId: string | null = null;

  if (slot.mode === "auto") {
    if (!args.startAt) return { error: "시간을 선택해주세요." };
    startAt = new Date(args.startAt);

    // Re-validate against current free/busy and working hours.
    let bookMaxDays = slot.max_advance_days as number;
    if (windowUntil !== null) {
      const d = Math.ceil((windowUntil - Date.now()) / 86_400_000);
      bookMaxDays = Math.max(bookMaxDays, Math.min(d, 365));
    }
    const options = await computeAutoAvailability(slot.host_id as string, {
      duration_min: slot.duration_min as number,
      slot_interval_min: slot.slot_interval_min as number,
      working_hours: (slot.working_hours ?? {}) as WorkingHours,
      min_notice_hours: slot.min_notice_hours as number,
      max_advance_days: bookMaxDays,
      buffer_min: slot.buffer_min as number,
    });
    const ok = options.some(
      (o) => new Date(o.start_at).getTime() === startAt.getTime(),
    );
    if (!ok) return { error: "이미 지나갔거나 잡을 수 없는 시간입니다." };
    const t = startAt.getTime();
    if (windowFrom !== null && t < windowFrom)
      return { error: "아직 예약 가능한 기간이 아니에요." };
    if (windowUntil !== null && t > windowUntil)
      return { error: "예약 가능한 기간이 끝났어요." };
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
    const t = startAt.getTime();
    if (windowFrom !== null && t < windowFrom)
      return { error: "아직 예약 가능한 기간이 아니에요." };
    if (windowUntil !== null && t > windowUntil)
      return { error: "예약 가능한 기간이 끝났어요." };
  }

  const endAt = new Date(startAt.getTime() + (slot.duration_min as number) * 60_000);

  // Sanitize selected menu ids to those actually attached to this slot.
  let validMenuIds: string[] = [];
  if (args.selected_menu_ids && args.selected_menu_ids.length > 0) {
    const { data: slotMenuRows } = await db
      .from("slot_menus")
      .select("menu_id")
      .eq("slot_id", slot.id);
    const attached = new Set(
      ((slotMenuRows ?? []) as { menu_id: string }[]).map((r) => r.menu_id),
    );
    validMenuIds = args.selected_menu_ids.filter((m) => attached.has(m));
  }

  const autoApprove = (slot.auto_approve as boolean | null) !== false;
  const initialStatus = autoApprove ? "confirmed" : "pending";

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
      selected_menu_ids: validMenuIds,
      status: initialStatus,
    })
    .select("id")
    .single();
  if (bookErr || !booking) return { error: "예약에 실패했습니다." };

  // Notify host (always) and guest (only if auto-confirmed — otherwise
  // they'll get a confirmation email later when the host approves).
  try {
    const { sendBookingReceivedToHost, sendBookingConfirmedToGuest } =
      await import("@/lib/email");
    const { createNotification } = await import("@/lib/notifications");
    const { data: host } = await db
      .from("users")
      .select("email, display_name, username")
      .eq("id", slot.host_id)
      .single();
    const guestEmail = args.guest_email ?? (await getEmailForUser(guestId));
    const guestLabel = args.guest_name ?? host?.display_name ?? "Guest";
    if (host?.email) {
      await sendBookingReceivedToHost(host.email as string, {
        slotTitle: slot.title as string,
        when: startAt.toISOString(),
        guestLabel,
        guestEmail: guestEmail ?? null,
        message: args.message ?? null,
        autoApprove,
        manageUrl: `/${host.username}/bookings`,
      });
    }
    // In-app notification for the host.
    await createNotification({
      userId: slot.host_id as string,
      type: "booking_received",
      title: autoApprove
        ? `새 예약: ${slot.title}`
        : `예약 요청: ${slot.title}`,
      body: `${guestLabel} · ${startAt.toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}`,
      link: `/${host?.username}/bookings`,
      actorId: guestId,
    });
    if (autoApprove && guestEmail) {
      await sendBookingConfirmedToGuest(guestEmail, {
        slotTitle: slot.title as string,
        when: startAt.toISOString(),
        hostLabel: (host?.display_name || host?.username || "Host") as string,
        location: (slot.location_detail as string | null) ?? null,
      });
    }
    // If the guest is a registered user, notify them too on auto-confirm.
    if (autoApprove && guestId) {
      await createNotification({
        userId: guestId,
        type: "booking_confirmed",
        title: `예약 확정: ${slot.title}`,
        body: startAt.toLocaleString("ko-KR", {
          timeZone: "Asia/Seoul",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        link: `/bookings`,
        actorId: slot.host_id as string,
      });
    }
  } catch (err) {
    console.error("booking emails", err);
  }

  if (availabilityId) {
    await db
      .from("slot_availabilities")
      .update({ booked_count: ((slot.capacity as number) ?? 1) })
      .eq("id", availabilityId);
  }

  // Best-effort: mirror to the slot's calendar.
  // - Google-backed calendar → create a Google event on that calendar.
  // - Native calendar → insert a native event row.
  try {
    const slotCalendarId = (slot.calendar_id as string | null) ?? null;
    let targetGoogleCalId: string | null = null;
    let nativeCalendarId: string | null = null;
    if (slotCalendarId) {
      const { data: cal } = await db
        .from("calendars")
        .select("source, google_calendar_id")
        .eq("id", slotCalendarId)
        .single();
      if (cal?.source === "google" && cal.google_calendar_id) {
        targetGoogleCalId = cal.google_calendar_id as string;
      } else if (cal?.source === "native") {
        nativeCalendarId = slotCalendarId;
      }
    } else {
      // Fall back to primary Google calendar for legacy slots
      targetGoogleCalId = "primary";
    }

    const guestEmail =
      args.guest_email ?? (await getEmailForUser(guestId));
    const guestLabel = args.guest_name ?? (guestId ? "Guest" : "Guest");

    if (targetGoogleCalId) {
      const calendar = await getAuthenticatedCalendar(slot.host_id as string);
      if (calendar) {
        const ev = await calendar.events.insert({
          calendarId: targetGoogleCalId,
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
    } else if (nativeCalendarId) {
      await db.from("events").insert({
        user_id: slot.host_id,
        calendar_id: nativeCalendarId,
        title: `[Orbit42] ${slot.title} — ${guestLabel}`,
        description:
          (args.message ? `${args.message}\n\n` : "") +
          `Booked via orbit42 · slot: ${slot.title}`,
        start_at: startAt.toISOString(),
        end_at: endAt.toISOString(),
        all_day: false,
      });
    }
  } catch (err) {
    console.error("Calendar mirror for booking failed:", err);
  }

  revalidatePath("/", "layout");
  return { success: true };
}

async function getEmailForUser(userId: string | null): Promise<string | null> {
  if (!userId) return null;
  const db = getAdminClient();
  const { data } = await db
    .from("users")
    .select("email")
    .eq("id", userId)
    .maybeSingle();
  return (data?.email as string | null) ?? null;
}

export type BookingRow = {
  id: string;
  scheduled_at: string;
  scheduled_end_at: string;
  status: string;
  message: string | null;
  guest_name: string | null;
  guest_email: string | null;
  selected_menu_ids: string[];
  guest: { username: string; display_name: string | null } | null;
  slot: { title: string; slug: string };
  selected_menus?: {
    id: string;
    name: string;
    price_cents: number;
  }[];
};

export type GuestBookingRow = {
  id: string;
  scheduled_at: string;
  scheduled_end_at: string;
  status: string;
  message: string | null;
  host: { username: string; display_name: string | null } | null;
  slot: { title: string; slug: string; location_detail: string | null };
};

export async function listMyGuestBookings(): Promise<GuestBookingRow[]> {
  const userId = await requireUserId();
  const db = getAdminClient();
  const { data } = await db
    .from("bookings")
    .select(
      "id, scheduled_at, scheduled_end_at, status, message, host:users!bookings_host_id_fkey(username, display_name), slot:time_slots!bookings_slot_id_fkey(title, slug, location_detail)",
    )
    .eq("guest_id", userId)
    .order("scheduled_at", { ascending: true });
  return ((data ?? []) as unknown) as GuestBookingRow[];
}

export async function listMyHostBookings(): Promise<BookingRow[]> {
  const userId = await requireUserId();
  const db = getAdminClient();
  const { data } = await db
    .from("bookings")
    .select(
      "id, scheduled_at, scheduled_end_at, status, message, guest_name, guest_email, selected_menu_ids, guest:users!bookings_guest_id_fkey(username, display_name), slot:time_slots!bookings_slot_id_fkey(title, slug)",
    )
    .eq("host_id", userId)
    .order("scheduled_at", { ascending: true });
  const rows = ((data ?? []) as unknown) as BookingRow[];

  // Hydrate selected menu names in one query.
  const allMenuIds = new Set<string>();
  for (const r of rows) {
    for (const id of r.selected_menu_ids ?? []) allMenuIds.add(id);
  }
  if (allMenuIds.size > 0) {
    const { data: menuRows } = await db
      .from("menus")
      .select("id, name, price_cents")
      .in("id", Array.from(allMenuIds));
    const byId = new Map(
      ((menuRows ?? []) as { id: string; name: string; price_cents: number }[]).map(
        (m) => [m.id, m],
      ),
    );
    for (const r of rows) {
      r.selected_menus = (r.selected_menu_ids ?? [])
        .map((id) => byId.get(id))
        .filter(Boolean) as BookingRow["selected_menus"];
    }
  }
  return rows;
}

export async function updateBookingStatus(
  id: string,
  status: "confirmed" | "canceled" | "completed",
) {
  const userId = await requireUserId();
  const db = getAdminClient();

  const { data: booking } = await db
    .from("bookings")
    .select(
      "guest_id, guest_email, guest_name, scheduled_at, host_id, slot:time_slots!bookings_slot_id_fkey(title, location_detail)",
    )
    .eq("id", id)
    .eq("host_id", userId)
    .single();

  const { error } = await db
    .from("bookings")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("host_id", userId);
  if (error) return { error: "변경 실패" };

  // Notify the guest via Resend whenever a decision is made.
  if (booking && status !== "completed") {
    const slotInfo = booking.slot as unknown as {
      title: string;
      location_detail: string | null;
    } | null;
    const slotTitle = slotInfo?.title ?? "예약";
    const guestEmail =
      (booking.guest_email as string | null) ??
      (await getEmailForUser(booking.guest_id as string | null));
    if (guestEmail) {
      try {
        const { data: host } = await db
          .from("users")
          .select("display_name, username")
          .eq("id", userId)
          .single();
        if (status === "confirmed") {
          const { sendBookingConfirmedToGuest } = await import("@/lib/email");
          await sendBookingConfirmedToGuest(guestEmail, {
            slotTitle,
            when: booking.scheduled_at as string,
            hostLabel: (host?.display_name || host?.username || "Host") as string,
            location: slotInfo?.location_detail ?? null,
          });
        } else if (status === "canceled") {
          const { sendBookingCanceledToGuest } = await import("@/lib/email");
          await sendBookingCanceledToGuest(guestEmail, {
            slotTitle,
            when: booking.scheduled_at as string,
            hostLabel: (host?.display_name || host?.username || "Host") as string,
          });
        }
      } catch (err) {
        console.error("booking status email", err);
      }
    }
    // Guest in-app notification (if a registered user).
    if (booking.guest_id) {
      try {
        const { createNotification } = await import("@/lib/notifications");
        await createNotification({
          userId: booking.guest_id as string,
          type: status === "confirmed" ? "booking_confirmed" : "booking_canceled",
          title:
            status === "confirmed"
              ? `예약 확정: ${slotTitle}`
              : `예약 취소: ${slotTitle}`,
          body: new Date(booking.scheduled_at as string).toLocaleString(
            "ko-KR",
            {
              timeZone: "Asia/Seoul",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            },
          ),
          link: `/bookings`,
          actorId: booking.host_id as string,
        });
      } catch (err) {
        console.error("booking status notification", err);
      }
    }
  }

  revalidatePath("/", "layout");
  return { success: true };
}

/** Guest cancels their own booking. Emails the host. */
export async function cancelMyBooking(bookingId: string) {
  const userId = await requireUserId();
  const db = getAdminClient();
  const { data: booking } = await db
    .from("bookings")
    .select(
      "id, guest_id, host_id, scheduled_at, status, slot:time_slots!bookings_slot_id_fkey(title, location_detail)",
    )
    .eq("id", bookingId)
    .eq("guest_id", userId)
    .maybeSingle();
  if (!booking) return { error: "예약을 찾을 수 없어요." };
  if (booking.status === "canceled" || booking.status === "completed") {
    return { error: "이미 종료된 예약이에요." };
  }
  const { error } = await db
    .from("bookings")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("id", bookingId)
    .eq("guest_id", userId);
  if (error) return { error: "취소에 실패했어요." };

  // Notify host.
  try {
    const slotInfo = booking.slot as unknown as {
      title: string;
      location_detail: string | null;
    } | null;
    const { data: host } = await db
      .from("users")
      .select("email, display_name, username")
      .eq("id", booking.host_id)
      .single();
    const { data: guest } = await db
      .from("users")
      .select("email, display_name, username")
      .eq("id", userId)
      .single();
    if (host?.email) {
      const { sendBookingReceivedToHost } = await import("@/lib/email");
      await sendBookingReceivedToHost(host.email as string, {
        slotTitle: slotInfo?.title ?? "예약",
        when: booking.scheduled_at as string,
        guestLabel: (guest?.display_name || guest?.username || "게스트") as string,
        guestEmail: (guest?.email as string | null) ?? null,
        message: "게스트가 예약을 취소했어요.",
        autoApprove: true,
        manageUrl: `/${host.username}/bookings`,
      });
    }
  } catch (err) {
    console.error("cancelMyBooking email", err);
  }

  revalidatePath("/", "layout");
  return { success: true };
}
