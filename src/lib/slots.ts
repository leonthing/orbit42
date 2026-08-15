"use server";

import { revalidatePath } from "next/cache";
import { getAdminClient } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import { getUserId, requireUserId } from "@/lib/db";
import { clientKey, rateLimit } from "@/lib/rate-limit";
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
  /** Candidate meeting locations the guest can pick from. When
   * singular the UI hides the picker and uses this location
   * automatically for travel-buffer matching. */
  locations: string[];
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
  locations?: string[];
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

function normalizeLocationList(list: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const v = (raw ?? "").trim();
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

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
): Promise<{
  slot: TimeSlot;
  host: { username: string; display_name: string | null; avatar_url: string | null };
} | null> {
  const db = getAdminClient();
  const { data: user } = await db
    .from("users")
    .select("id, username, display_name, avatar_url")
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
    host: {
      username: user.username as string,
      display_name: user.display_name as string | null,
      avatar_url: (user.avatar_url as string | null) ?? null,
    },
  };
}

export type BookableOption = {
  /** For manual slots: availability row id. For auto: null. */
  availability_id: string | null;
  start_at: string;
  end_at: string;
  remaining: number;
};

export async function getBookableOptions(
  slot: TimeSlot,
  /** When the slot offers multiple locations, the guest's pick drives
   * which times are bookable. Defaults to the slot's first location. */
  pickedLocation?: string | null,
): Promise<BookableOption[]> {
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
    const resolvedLocation =
      pickedLocation ??
      (slot.locations && slot.locations.length > 0
        ? slot.locations[0]
        : slot.location_detail ?? null);
    const opts = await computeAutoAvailability(slot.host_id, {
      duration_min: slot.duration_min,
      slot_interval_min: slot.slot_interval_min,
      working_hours: slot.working_hours ?? {},
      min_notice_hours: slot.min_notice_hours,
      max_advance_days: effectiveMaxDays,
      buffer_min: slot.buffer_min,
      slot_title: slot.title ?? null,
      slot_location: resolvedLocation,
      slot_id: slot.id,
      capacity: slot.capacity ?? 1,
    });
    return opts
      .filter((o: AutoSlotOption) => withinWindow(o.start_at))
      .map((o: AutoSlotOption) => ({
        availability_id: null,
        start_at: o.start_at,
        end_at: o.end_at,
        remaining: o.remaining,
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
      location_detail:
        input.location_detail ??
        (input.locations && input.locations.length > 0
          ? input.locations[0]
          : null),
      locations: normalizeLocationList(
        input.locations ?? (input.location_detail ? [input.location_detail] : []),
      ),
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

  // 팔로워에게 새 슬롯 알림 — 예약을 트리거하는 핵심 신호 (실패해도 생성은 유효).
  try {
    await notifyFollowersOfNewSlot(
      userId,
      slot.title as string,
      slot.slug as string,
    );
  } catch (err) {
    console.error("notifyFollowersOfNewSlot", err);
  }

  revalidatePath("/", "layout");
  return { success: true, slug: slot.slug as string, id: slot.id as string };
}

/** 새 타임슬롯을 열면 팔로워(최대 200명)에게 인앱 알림을 보낸다. */
async function notifyFollowersOfNewSlot(
  hostId: string,
  slotTitle: string,
  slug: string,
) {
  const db = getAdminClient();
  const { data: host } = await db
    .from("users")
    .select("username, display_name")
    .eq("id", hostId)
    .single();
  if (!host) return;
  const { data: followers } = await db
    .from("follows")
    .select("follower_id")
    .eq("following_id", hostId)
    .limit(200);
  if (!followers || followers.length === 0) return;

  const label = (host.display_name as string | null) || (host.username as string);
  const { createNotification } = await import("@/lib/notifications");
  await Promise.all(
    followers.map((f) =>
      createNotification({
        userId: f.follower_id as string,
        type: "new_slot",
        title: `${label}님이 '${slotTitle}' 타임슬롯을 열었어요`,
        body: "지금 예약할 수 있어요",
        link: `/${host.username}/s/${slug}`,
        actorId: hostId,
      }),
    ),
  );
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
  if (patch.locations !== undefined) {
    const normalized = normalizeLocationList(patch.locations);
    updateData.locations = normalized;
    // Keep location_detail in sync (first element) for legacy display.
    if (patch.location_detail === undefined) {
      updateData.location_detail = normalized[0] ?? null;
    }
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

/** Duplicate an existing slot (no availabilities copied, title gets "사본"). */
export async function cloneSlot(id: string) {
  const userId = await requireUserId();
  const db = getAdminClient();
  const { data: src } = await db
    .from("time_slots")
    .select("*")
    .eq("id", id)
    .eq("host_id", userId)
    .single();
  if (!src) return { error: "슬롯을 찾을 수 없어요." };

  const newTitle = `${src.title} (사본)`;
  const slug = slugify(newTitle) + "-" + Math.random().toString(36).slice(2, 6);
  const { data: created, error } = await db
    .from("time_slots")
    .insert({
      host_id: userId,
      slug,
      title: newTitle,
      description: src.description,
      duration_min: src.duration_min,
      price_cents: src.price_cents,
      capacity: src.capacity,
      slot_type: src.slot_type,
      location_type: src.location_type,
      location_detail: src.location_detail,
      locations: normalizeLocationList(src.locations ?? []),
      active: false, // clone starts inactive so user can review before publishing
      mode: src.mode,
      working_hours: src.working_hours ?? {},
      slot_interval_min: src.slot_interval_min,
      min_notice_hours: src.min_notice_hours,
      max_advance_days: src.max_advance_days,
      buffer_min: src.buffer_min,
      pricing_model: "fixed", // auction clones aren't meaningful
      reserve_price_cents: null,
      auction_ends_at: null,
      calendar_id: src.calendar_id,
      valid_from: src.valid_from,
      valid_until: src.valid_until,
      auto_approve: src.auto_approve,
      payment_method: src.payment_method,
      image_urls: src.image_urls ?? [],
      show_on_feed: src.show_on_feed,
    })
    .select("id")
    .single();
  if (error || !created) return { error: "복제에 실패했어요." };
  revalidatePath("/", "layout");
  return { ok: true as const, id: created.id as string };
}

/**
 * Single-click template: creates one ready-to-tweak slot from a named
 * preset. Skips if a slot with the same title already exists so users
 * don't accidentally duplicate.
 */
export async function createSlotFromPreset(
  key: "meeting" | "meal" | "coffee",
): Promise<
  { ok: true; slug: string; id: string } | { skipped: true } | { error: string }
> {
  const userId = await requireUserId();
  const db = getAdminClient();

  // Pick a default calendar (prefer user's flagged default, else any).
  const { data: cal } = await db
    .from("calendars")
    .select("id")
    .eq("user_id", userId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const calendarId = (cal?.id as string | undefined) ?? null;

  const preset = buildSlotPreset(key, calendarId);
  if (!preset) return { error: "알 수 없는 템플릿입니다." };

  const { data: existing } = await db
    .from("time_slots")
    .select("id")
    .eq("host_id", userId)
    .eq("title", preset.title)
    .limit(1)
    .maybeSingle();
  if (existing) return { skipped: true };

  const res = await createSlot(preset);
  if (!("success" in res) || !res.success) {
    return { error: ("error" in res && res.error) || "생성 실패" };
  }
  revalidatePath("/", "layout");
  return { ok: true, slug: res.slug, id: res.id };
}

function buildSlotPreset(
  key: "meeting" | "meal" | "coffee",
  calendarId: string | null,
): SlotInput & { title: string } | null {
  const base = {
    price_cents: 0,
    capacity: 1,
    calendar_id: calendarId,
    payment_method: "offline" as const,
    show_on_feed: true,
    active: true,
    mode: "auto" as const,
  };
  if (key === "meeting") {
    return {
      ...base,
      title: "업무 미팅",
      description: "1:1 업무 논의 · 60분. 평일 낮에 받는 공식 미팅 슬롯.",
      duration_min: 60,
      slot_type: "1on1",
      location_type: "in_person",
      working_hours: {
        mon: [{ start: "10:00", end: "18:00" }],
        tue: [{ start: "10:00", end: "18:00" }],
        wed: [{ start: "10:00", end: "18:00" }],
        thu: [{ start: "10:00", end: "18:00" }],
        fri: [{ start: "10:00", end: "18:00" }],
      },
      slot_interval_min: 30,
      min_notice_hours: 24,
      max_advance_days: 90,
      buffer_min: 15,
      auto_approve: false,
    };
  }
  if (key === "meal") {
    return {
      ...base,
      title: "식사",
      description: "같이 밥 먹으며 나누는 이야기 · 90분. 점심/저녁.",
      duration_min: 90,
      slot_type: "companion",
      location_type: "in_person",
      working_hours: {
        mon: [{ start: "12:00", end: "14:00" }, { start: "18:00", end: "21:00" }],
        tue: [{ start: "12:00", end: "14:00" }, { start: "18:00", end: "21:00" }],
        wed: [{ start: "12:00", end: "14:00" }, { start: "18:00", end: "21:00" }],
        thu: [{ start: "12:00", end: "14:00" }, { start: "18:00", end: "21:00" }],
        fri: [{ start: "12:00", end: "14:00" }, { start: "18:00", end: "21:00" }],
        sat: [{ start: "12:00", end: "14:00" }],
        sun: [{ start: "12:00", end: "14:00" }],
      },
      slot_interval_min: 30,
      min_notice_hours: 12,
      max_advance_days: 30,
      buffer_min: 30,
      auto_approve: false,
    };
  }
  if (key === "coffee") {
    return {
      ...base,
      title: "커피챗",
      description: "가볍게 1시간 대화 · 주말에 편하게.",
      duration_min: 60,
      slot_type: "1on1",
      location_type: "in_person",
      working_hours: {
        sat: [{ start: "10:00", end: "18:00" }],
        sun: [{ start: "10:00", end: "18:00" }],
      },
      slot_interval_min: 60,
      min_notice_hours: 1,
      max_advance_days: 14,
      buffer_min: 10,
      auto_approve: true,
    };
  }
  return null;
}

/** Client helper: re-compute bookable options for the current guest's
 * chosen location. Lets the booking form filter times per location
 * without a full page reload. */
export async function refreshBookableOptions(
  slotId: string,
  pickedLocation: string | null,
): Promise<BookableOption[]> {
  const db = getAdminClient();
  const { data: slot } = await db
    .from("time_slots")
    .select("*")
    .eq("id", slotId)
    .single();
  if (!slot) return [];
  return getBookableOptions(slot as TimeSlot, pickedLocation);
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
  /** Guest's chosen location when the slot offers multiple. */
  selected_location?: string | null;
}) {
  const session = await getSession();
  const guestId = await getUserId();

  if (!session && !(args.guest_name && args.guest_email)) {
    return { error: "로그인하거나 이름/이메일을 입력해주세요." };
  }

  // Throttle the (session-less) guest booking path so it can't be scripted to
  // flood a host's inbox / outbound email. Keyed by identity when we have one,
  // else by the guest email, plus the caller IP (handled inside clientKey).
  const rl = rateLimit(
    clientKey("book", session?.username ?? args.guest_email ?? ""),
    8,
    5 * 60_000,
  );
  if (!rl.ok) {
    return { error: `예약 요청이 너무 많아요. ${rl.retryAfter}초 후 다시 시도해주세요.` };
  }

  const db = getAdminClient();

  const { data: slot } = await db
    .from("time_slots")
    .select(
      "id, host_id, duration_min, active, mode, pricing_model, title, location_detail, locations, working_hours, slot_interval_min, min_notice_hours, max_advance_days, buffer_min, capacity, calendar_id, valid_from, valid_until, auto_approve",
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
    const locList = ((slot.locations as string[] | null) ?? []).filter(
      (s) => !!s,
    );
    const pickedLoc =
      (args.selected_location ?? "").trim() ||
      locList[0] ||
      (slot.location_detail as string | null) ||
      null;
    if (locList.length > 1 && args.selected_location) {
      if (!locList.some((l) => l.toLowerCase() === pickedLoc?.toLowerCase())) {
        return { error: "이 슬롯에 허용된 위치가 아니에요." };
      }
    }
    const options = await computeAutoAvailability(slot.host_id as string, {
      duration_min: slot.duration_min as number,
      slot_interval_min: slot.slot_interval_min as number,
      working_hours: (slot.working_hours ?? {}) as WorkingHours,
      min_notice_hours: slot.min_notice_hours as number,
      max_advance_days: bookMaxDays,
      buffer_min: slot.buffer_min as number,
      slot_title: (slot.title as string | null) ?? null,
      slot_location: pickedLoc,
      slot_id: slot.id as string,
      capacity: (slot.capacity as number | null) ?? 1,
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
  const bookingLocation =
    (args.selected_location ?? "").trim() ||
    ((slot.locations as string[] | null)?.[0] ?? null) ||
    (slot.location_detail as string | null);
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
      selected_location: bookingLocation,
    })
    .select("id")
    .single();
  if (bookErr || !booking) return { error: "예약에 실패했습니다." };

  // Notify host (always) and guest (only if auto-confirmed — otherwise
  // they'll get a confirmation email later when the host approves).
  // Each side-effect is wrapped independently so one failure (e.g. a
  // Resend outage) doesn't drop the others.
  const { data: host } = await db
    .from("users")
    .select("email, display_name, username")
    .eq("id", slot.host_id)
    .single();
  const guestEmail = args.guest_email ?? (await getEmailForUser(guestId));
  const guestLabel = args.guest_name ?? host?.display_name ?? "Guest";
  const whenLabel = startAt.toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  // In-app host notification — the bell/sidebar reads this.
  try {
    const { createNotification } = await import("@/lib/notifications");
    await createNotification({
      userId: slot.host_id as string,
      type: "booking_received",
      title: autoApprove
        ? `새 예약: ${slot.title}`
        : `예약 요청: ${slot.title}`,
      body: `${guestLabel} · ${whenLabel}`,
      link: `/${host?.username}/bookings`,
      actorId: guestId,
    });
  } catch (err) {
    console.error("host booking_received notification", err);
  }

  // Email to host.
  try {
    const { emailAllowed } = await import("@/lib/notification-prefs");
    if (host?.email && (await emailAllowed(slot.host_id as string, "booking_received"))) {
      const { sendBookingReceivedToHost } = await import("@/lib/email");
      await sendBookingReceivedToHost(host.email as string, {
        slotTitle: slot.title as string,
        when: startAt.toISOString(),
        guestLabel,
        guestEmail: guestEmail ?? null,
        message: args.message ?? null,
        autoApprove,
        manageUrl: `/${host?.username}/bookings`,
      });
    }
  } catch (err) {
    console.error("host booking_received email", err);
  }

  // Email to guest (only if auto-confirmed).
  if (autoApprove) {
    try {
      const { emailAllowed } = await import("@/lib/notification-prefs");
      if (guestEmail && (await emailAllowed(guestId, "booking_confirmed"))) {
        const { sendBookingConfirmedToGuest } = await import("@/lib/email");
        await sendBookingConfirmedToGuest(guestEmail, {
          slotTitle: slot.title as string,
          when: startAt.toISOString(),
          hostLabel: (host?.display_name || host?.username || "Host") as string,
          location:
            (bookingLocation as string | null) ??
            ((slot.location_detail as string | null) ?? null),
        });
      }
    } catch (err) {
      console.error("guest booking_confirmed email", err);
    }

    // Guest is a registered user — ping their bell too.
    if (guestId) {
      try {
        const { createNotification } = await import("@/lib/notifications");
        await createNotification({
          userId: guestId,
          type: "booking_confirmed",
          title: `예약 확정: ${slot.title}`,
          body: whenLabel,
          link: `/bookings`,
          actorId: slot.host_id as string,
        });
      } catch (err) {
        console.error("guest booking_confirmed notification", err);
      }
    }
  }

  if (availabilityId) {
    await db
      .from("slot_availabilities")
      .update({ booked_count: ((slot.capacity as number) ?? 1) })
      .eq("id", availabilityId);
  }

  // Best-effort: mirror the booking to calendars so BOTH sides can see it.
  // - Host → the slot's calendar (Google or native), falling back to the
  //   host's default native calendar so it's always visible in-app.
  // - Guest (registered users only) → their default native calendar.
  // Pending bookings are marked `tentative` (rendered dashed) until the host
  // confirms; `booking_id` links the event so we can flip/remove it later.
  try {
    const tentative = initialStatus === "pending";

    // Host's event shows who's coming; the guest's event shows who they're
    // meeting. Resolve a human label for the guest (registered or anonymous).
    let guestDisplay = args.guest_name ?? null;
    if (!guestDisplay && guestId) {
      const { data: g } = await db
        .from("users")
        .select("display_name, username")
        .eq("id", guestId)
        .maybeSingle();
      guestDisplay = (g?.display_name as string | null) || (g?.username as string | null) || null;
    }
    const guestLabel = guestDisplay ?? "게스트";
    const hostLabel = (host?.display_name || host?.username || "호스트") as string;
    const baseDescription =
      (args.message ? `${args.message}\n\n` : "") +
      `Booked via orbit42 · slot: ${slot.title}`;
    const hostEventTitle = `[Orbit42] ${slot.title} — ${guestLabel}`;
    const guestEventTitle = `[Orbit42] ${slot.title} — ${hostLabel}`;
    const startIso = startAt.toISOString();
    const endIso = endAt.toISOString();

    // ── Host side ──────────────────────────────────────────────────────
    // Prefer the host's real Google calendar when connected so bookings land
    // where they actually schedule. The slot's Google calendar wins if set;
    // otherwise the primary. A native calendar is used only as a fallback
    // when Google isn't linked.
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
    }

    const guestEmail = args.guest_email ?? (await getEmailForUser(guestId));
    const hostCalendar = await getAuthenticatedCalendar(slot.host_id as string);
    // No explicit Google target but the host has Google linked → use primary,
    // and skip the native mirror so the booking isn't duplicated in-app.
    if (!targetGoogleCalId && hostCalendar) {
      targetGoogleCalId = "primary";
      nativeCalendarId = null;
    }

    let hostMirrored = false;

    if (targetGoogleCalId && hostCalendar) {
      const ev = await hostCalendar.events.insert({
        calendarId: targetGoogleCalId,
        sendUpdates: guestEmail ? "all" : "none",
        requestBody: {
          summary: hostEventTitle,
          description: baseDescription,
          status: tentative ? "tentative" : "confirmed",
          start: { dateTime: startIso, timeZone: "Asia/Seoul" },
          end: { dateTime: endIso, timeZone: "Asia/Seoul" },
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
      hostMirrored = true;
    } else if (nativeCalendarId) {
      await db.from("events").insert({
        user_id: slot.host_id,
        calendar_id: nativeCalendarId,
        booking_id: booking.id,
        title: hostEventTitle,
        description: baseDescription,
        start_at: startIso,
        end_at: endIso,
        all_day: false,
        tentative,
      });
      hostMirrored = true;
    }

    // Guaranteed in-app fallback for the host when nothing landed above.
    if (!hostMirrored) {
      const fallbackCalId = await defaultNativeCalendarId(slot.host_id as string);
      if (fallbackCalId) {
        await db.from("events").insert({
          user_id: slot.host_id,
          calendar_id: fallbackCalId,
          booking_id: booking.id,
          title: hostEventTitle,
          description: baseDescription,
          start_at: startIso,
          end_at: endIso,
          all_day: false,
          tentative,
        });
      }
    }

    // ── Guest side (registered users) ──────────────────────────────────
    // Mirror into the guest's own orbit42 calendar so a booking they made
    // shows up for them too — tentative/dashed until the host confirms.
    if (guestId) {
      const guestCalId = await defaultNativeCalendarId(guestId);
      if (guestCalId) {
        await db.from("events").insert({
          user_id: guestId,
          calendar_id: guestCalId,
          booking_id: booking.id,
          title: guestEventTitle,
          description: baseDescription,
          start_at: startIso,
          end_at: endIso,
          all_day: false,
          tentative,
        });
      }
    }
  } catch (err) {
    console.error("Calendar mirror for booking failed:", err);
  }

  revalidatePath("/", "layout");
  return { success: true };
}

/**
 * Best-effort removal of the Google Calendar event mirrored for a
 * booking. Called when a booking is canceled from either side so the
 * host's calendar doesn't keep a ghost meeting.
 */
async function removeBookingCalendarEvent(bookingId: string) {
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

/**
 * Resolve a user's default native calendar id, creating one if somehow
 * missing. Used to guarantee a booking lands in both the host's and the
 * guest's orbit42 calendar even when Google isn't connected.
 */
async function defaultNativeCalendarId(userId: string): Promise<string | null> {
  const db = getAdminClient();
  const { data: existing } = await db
    .from("calendars")
    .select("id")
    .eq("user_id", userId)
    .eq("source", "native")
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (existing?.id) return existing.id as string;

  const { data: created } = await db
    .from("calendars")
    .insert({
      user_id: userId,
      name: "내 캘린더",
      purpose: "personal",
      color: "#dc2626",
      visibility: "private",
      source: "native",
      is_default: true,
    })
    .select("id")
    .maybeSingle();
  return (created?.id as string | null) ?? null;
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
  reschedule_by: string | null;
  reschedule_start_at: string | null;
  reschedule_end_at: string | null;
  reschedule_note: string | null;
  /** 대기 중인 제안을 내가 보낸 것인지 — 목록을 부른 사람 기준으로 서버가 채운다. */
  reschedule_by_me?: boolean;
  guest: { username: string; display_name: string | null } | null;
  slot: { title: string; slug: string; location_detail: string | null };
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
  selected_menu_ids: string[];
  reschedule_by: string | null;
  reschedule_start_at: string | null;
  reschedule_end_at: string | null;
  reschedule_note: string | null;
  /** 대기 중인 제안을 내가 보낸 것인지 — 목록을 부른 사람 기준으로 서버가 채운다. */
  reschedule_by_me?: boolean;
  host: { username: string; display_name: string | null } | null;
  slot: {
    id: string;
    title: string;
    slug: string;
    location_detail: string | null;
  };
  selected_menus?: {
    id: string;
    name: string;
    price_cents: number;
  }[];
};

/** 예약 행들의 selected_menu_ids 를 한 번의 조회로 메뉴 정보로 채운다. */
async function hydrateSelectedMenus(
  rows: { selected_menu_ids?: string[]; selected_menus?: unknown }[],
) {
  const allMenuIds = new Set<string>();
  for (const r of rows) {
    for (const id of r.selected_menu_ids ?? []) allMenuIds.add(id);
  }
  if (allMenuIds.size === 0) return;
  const db = getAdminClient();
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
      .filter(Boolean);
  }
}

export async function listMyGuestBookings(): Promise<GuestBookingRow[]> {
  const userId = await requireUserId();
  const db = getAdminClient();
  const { data } = await db
    .from("bookings")
    .select(
      "id, scheduled_at, scheduled_end_at, status, message, selected_menu_ids, reschedule_by, reschedule_start_at, reschedule_end_at, reschedule_note, host:users!bookings_host_id_fkey(username, display_name), slot:time_slots!bookings_slot_id_fkey(id, title, slug, location_detail)",
    )
    .eq("guest_id", userId)
    .eq("hidden_by_guest", false)
    .order("scheduled_at", { ascending: true });
  const rows = ((data ?? []) as unknown) as GuestBookingRow[];
  await hydrateSelectedMenus(rows);
  for (const r of rows) r.reschedule_by_me = r.reschedule_by === userId;
  return rows;
}

export async function listMyHostBookings(): Promise<BookingRow[]> {
  const userId = await requireUserId();
  const db = getAdminClient();
  const { data } = await db
    .from("bookings")
    .select(
      "id, scheduled_at, scheduled_end_at, status, message, guest_name, guest_email, selected_menu_ids, reschedule_by, reschedule_start_at, reschedule_end_at, reschedule_note, guest:users!bookings_guest_id_fkey(username, display_name), slot:time_slots!bookings_slot_id_fkey(title, slug, location_detail)",
    )
    .eq("host_id", userId)
    .eq("hidden_by_host", false)
    .order("scheduled_at", { ascending: true });
  const rows = ((data ?? []) as unknown) as BookingRow[];
  await hydrateSelectedMenus(rows);
  for (const r of rows) r.reschedule_by_me = r.reschedule_by === userId;
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
      "guest_id, guest_email, guest_name, scheduled_at, host_id, google_event_id, slot:time_slots!bookings_slot_id_fkey(title, location_detail, calendar_id)",
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

  // Keep the mirrored calendar events (host + guest) in sync with the decision:
  // - canceled → remove the Google event and delete the native mirrors.
  // - confirmed → flip the native mirrors from tentative (dashed) to solid.
  if (status === "canceled") {
    await removeBookingCalendarEvent(id);
    await db.from("events").delete().eq("booking_id", id);
  } else if (status === "confirmed") {
    await db
      .from("events")
      .update({ tentative: false, updated_at: new Date().toISOString() })
      .eq("booking_id", id);
    // Flip the host's Google event from tentative → confirmed too.
    const gid = booking?.google_event_id as string | null | undefined;
    if (gid) {
      try {
        const slotInfo2 = booking!.slot as unknown as {
          calendar_id: string | null;
        } | null;
        let calendarId = "primary";
        if (slotInfo2?.calendar_id) {
          const { data: cal } = await db
            .from("calendars")
            .select("source, google_calendar_id")
            .eq("id", slotInfo2.calendar_id)
            .single();
          if (cal?.source === "google" && cal.google_calendar_id) {
            calendarId = cal.google_calendar_id as string;
          }
        }
        const calendar = await getAuthenticatedCalendar(booking!.host_id as string);
        if (calendar) {
          await calendar.events.patch({
            calendarId,
            eventId: gid,
            requestBody: { status: "confirmed" },
          });
        }
      } catch (err) {
        console.error("confirm google status patch", err);
      }
    }
  }

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
    const { emailAllowed } = await import("@/lib/notification-prefs");
    const guestWantsEmail = await emailAllowed(
      booking.guest_id as string | null,
      status === "confirmed" ? "booking_confirmed" : "booking_canceled",
    );
    if (guestEmail && guestWantsEmail) {
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

/**
 * Guest moves their booking to a new time without losing the thread.
 * Auto slots take a startAt ISO string; manual slots an availabilityId.
 * Approval semantics follow the slot: auto-approve keeps it confirmed,
 * otherwise it goes back to pending for the host.
 */
/**
 * 예약을 새 시각으로 실제로 옮긴다 — 가용 슬롯 점유, 미러된 구글 이벤트,
 * 양쪽 네이티브 캘린더 이벤트를 함께 이동시킨다.
 *
 * 누가 옮길 자격이 있는지는 호출하는 쪽이 이미 검증했다고 본다
 * (게스트 직접 변경 / 호스트 제안의 게스트 수락 양쪽이 공유한다).
 * 대기 중이던 변경 제안은 어느 경로로 옮기든 무효가 되므로 함께 비운다.
 */
async function moveBookingTo(args: {
  booking: {
    id: string;
    host_id: string;
    availability_id: string | null;
    google_event_id: string | null;
  };
  slot: { capacity?: number; calendar_id?: string | null };
  newStart: Date;
  newEnd: Date;
  newAvailabilityId: string | null;
  newStatus: string;
}): Promise<{ error?: string }> {
  const { booking, slot, newStart, newEnd, newAvailabilityId, newStatus } = args;
  const db = getAdminClient();

  const { error } = await db
    .from("bookings")
    .update({
      scheduled_at: newStart.toISOString(),
      scheduled_end_at: newEnd.toISOString(),
      availability_id: newAvailabilityId,
      status: newStatus,
      reminder_sent_at: null,
      reschedule_by: null,
      reschedule_start_at: null,
      reschedule_end_at: null,
      reschedule_note: null,
      reschedule_created_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", booking.id);
  if (error) {
    console.error("moveBookingTo update", error);
    return { error: "변경에 실패했어요." };
  }

  // Move availability occupancy (manual mode mirrors bookSlot's
  // fill-to-capacity convention: one booking per availability row).
  if (booking.availability_id) {
    await db
      .from("slot_availabilities")
      .update({ booked_count: 0 })
      .eq("id", booking.availability_id);
  }
  if (newAvailabilityId) {
    await db
      .from("slot_availabilities")
      .update({ booked_count: slot.capacity ?? 1 })
      .eq("id", newAvailabilityId);
  }

  // Move the mirrored Google event instead of leaving the old time.
  if (booking.google_event_id) {
    try {
      let calendarId = "primary";
      if (slot.calendar_id) {
        const { data: cal } = await db
          .from("calendars")
          .select("source, google_calendar_id")
          .eq("id", slot.calendar_id)
          .single();
        if (cal?.source === "google" && cal.google_calendar_id) {
          calendarId = cal.google_calendar_id as string;
        }
        // native/unknown → event lives on the host's primary calendar
      }
      if (calendarId) {
        const calendar = await getAuthenticatedCalendar(booking.host_id);
        if (calendar) {
          await calendar.events.patch({
            calendarId,
            eventId: booking.google_event_id,
            sendUpdates: "all",
            requestBody: {
              start: { dateTime: newStart.toISOString(), timeZone: "Asia/Seoul" },
              end: { dateTime: newEnd.toISOString(), timeZone: "Asia/Seoul" },
            },
          });
        }
      }
    } catch (err) {
      console.error("moveBookingTo calendar patch", err);
    }
  }

  // Move the native mirrors (host + guest) to the new time and reset their
  // tentative state to match the new approval status.
  await db
    .from("events")
    .update({
      start_at: newStart.toISOString(),
      end_at: newEnd.toISOString(),
      tentative: newStatus === "pending",
      updated_at: new Date().toISOString(),
    })
    .eq("booking_id", booking.id);

  return {};
}

export async function rescheduleMyBooking(
  bookingId: string,
  pick: { startAt?: string; availabilityId?: string },
) {
  const userId = await requireUserId();
  const db = getAdminClient();

  const { data: booking } = await db
    .from("bookings")
    .select(
      "id, guest_id, host_id, slot_id, availability_id, scheduled_at, status, google_event_id",
    )
    .eq("id", bookingId)
    .eq("guest_id", userId)
    .maybeSingle();
  if (!booking) return { error: "예약을 찾을 수 없어요." };
  if (booking.status === "canceled" || booking.status === "completed") {
    return { error: "이미 종료된 예약이에요." };
  }

  const { data: slot } = await db
    .from("time_slots")
    .select("*")
    .eq("id", booking.slot_id)
    .single();
  if (!slot) return { error: "슬롯을 찾을 수 없어요." };

  let newStart: Date;
  let newAvailabilityId: string | null = null;
  if (slot.mode === "auto") {
    if (!pick.startAt) return { error: "시간을 선택해주세요." };
    newStart = new Date(pick.startAt);
    const options = await getBookableOptions(slot as TimeSlot, null);
    const ok = options.some(
      (o) => new Date(o.start_at).getTime() === newStart.getTime(),
    );
    if (!ok) return { error: "이미 지나갔거나 잡을 수 없는 시간입니다." };
  } else {
    if (!pick.availabilityId) return { error: "시간을 선택해주세요." };
    const { data: avail } = await db
      .from("slot_availabilities")
      .select("id, slot_id, start_at, capacity, booked_count")
      .eq("id", pick.availabilityId)
      .single();
    if (!avail || avail.slot_id !== booking.slot_id) {
      return { error: "시간을 찾을 수 없습니다." };
    }
    if ((avail.booked_count as number) >= (avail.capacity as number)) {
      return { error: "이미 마감된 시간입니다." };
    }
    newStart = new Date(avail.start_at as string);
    newAvailabilityId = avail.id as string;
  }

  const newEnd = new Date(
    newStart.getTime() + (slot.duration_min as number) * 60_000,
  );
  const autoApprove = (slot.auto_approve as boolean | null) ?? true;
  const newStatus = autoApprove ? "confirmed" : "pending";

  const moved = await moveBookingTo({
    booking,
    slot,
    newStart,
    newEnd,
    newAvailabilityId,
    newStatus,
  });
  if (moved.error) return { error: moved.error };

  // Tell the host.
  try {
    const [{ data: host }, { data: guest }] = await Promise.all([
      db
        .from("users")
        .select("email, username, display_name")
        .eq("id", booking.host_id)
        .single(),
      db
        .from("users")
        .select("email, username, display_name")
        .eq("id", userId)
        .single(),
    ]);
    const guestLabel = (guest?.display_name ||
      guest?.username ||
      "게스트") as string;
    const whenLabel = newStart.toLocaleString("ko-KR", {
      timeZone: "Asia/Seoul",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    const { createNotification } = await import("@/lib/notifications");
    await createNotification({
      userId: booking.host_id as string,
      type: newStatus === "pending" ? "booking_request" : "booking_received",
      title: `예약 시간 변경: ${slot.title}`,
      body: `${guestLabel} · ${whenLabel}`,
      link: `/${host?.username}/bookings`,
      actorId: userId,
    });
    const { emailAllowed } = await import("@/lib/notification-prefs");
    if (
      host?.email &&
      (await emailAllowed(booking.host_id as string, "booking_received"))
    ) {
      const { sendBookingReceivedToHost } = await import("@/lib/email");
      await sendBookingReceivedToHost(host.email as string, {
        slotTitle: slot.title as string,
        when: newStart.toISOString(),
        guestLabel,
        guestEmail: (guest?.email as string | null) ?? null,
        message: "게스트가 예약 시간을 변경했어요.",
        autoApprove,
        manageUrl: `/${host?.username}/bookings`,
      });
    }
  } catch (err) {
    console.error("rescheduleMyBooking notify", err);
  }

  revalidatePath("/", "layout");
  return { success: true as const, status: newStatus };
}

/** 변경 제안 배너에 쓰는 사람 표시명. */
function personLabel(
  user: { display_name?: string | null; username?: string | null } | null,
  fallback: string,
) {
  return (user?.display_name || user?.username || fallback) as string;
}

/**
 * 호스트가 예약 시간 변경을 제안한다.
 *
 * 게스트 쪽 변경(`rescheduleMyBooking`)과 달리 상대 수락이 필요하다 —
 * 호스트는 게스트가 그 시간에 올 수 있는지 알 수 없기 때문이다. 그래서
 * 여기서는 예약을 옮기지 않고 제안만 얹어두고, 게스트가 수락할 때
 * `respondToReschedule` 이 실제로 옮긴다.
 *
 * 예외: 비회원 게스트(guest_id 없음)는 앱에서 수락할 방법이 없으므로
 * 바로 옮기고 메일로 알린다 — 수락을 기다리다 영영 안 오는 걸 막는다.
 */
export async function proposeRescheduleAsHost(
  bookingId: string,
  startAt: string,
  note?: string | null,
): Promise<
  { success: true; applied: boolean } | { error: string }
> {
  const userId = await requireUserId();
  const db = getAdminClient();

  const { data: booking } = await db
    .from("bookings")
    .select(
      "id, guest_id, guest_email, guest_name, host_id, slot_id, availability_id, scheduled_at, status, google_event_id",
    )
    .eq("id", bookingId)
    .eq("host_id", userId)
    .maybeSingle();
  if (!booking) return { error: "예약을 찾을 수 없어요." };
  if (booking.status === "canceled" || booking.status === "completed") {
    return { error: "이미 종료된 예약이에요." };
  }

  const newStart = new Date(startAt);
  if (Number.isNaN(newStart.getTime())) {
    return { error: "시간이 올바르지 않아요." };
  }
  if (newStart.getTime() <= Date.now()) {
    return { error: "지난 시간으로는 옮길 수 없어요." };
  }

  const { data: slot } = await db
    .from("time_slots")
    .select("*")
    .eq("id", booking.slot_id)
    .single();
  if (!slot) return { error: "슬롯을 찾을 수 없어요." };

  const newEnd = new Date(
    newStart.getTime() + (slot.duration_min as number) * 60_000,
  );
  const trimmedNote = note?.trim() ? note.trim().slice(0, 500) : null;

  const [{ data: host }, { data: guest }] = await Promise.all([
    db
      .from("users")
      .select("email, username, display_name")
      .eq("id", userId)
      .single(),
    booking.guest_id
      ? db
          .from("users")
          .select("email, username, display_name")
          .eq("id", booking.guest_id)
          .single()
      : Promise.resolve({ data: null }),
  ]);
  const hostLabel = personLabel(host, "호스트");

  // 비회원 게스트 — 수락받을 창구가 없으니 바로 옮긴다.
  if (!booking.guest_id) {
    const moved = await moveBookingTo({
      booking: booking as never,
      slot: slot as never,
      newStart,
      newEnd,
      newAvailabilityId: null,
      newStatus: booking.status as string,
    });
    if (moved.error) return { error: moved.error };
    if (booking.guest_email) {
      try {
        const { sendBookingRescheduleProposal } = await import("@/lib/email");
        await sendBookingRescheduleProposal(booking.guest_email as string, {
          slotTitle: slot.title as string,
          previousWhen: booking.scheduled_at as string,
          when: newStart.toISOString(),
          proposerLabel: hostLabel,
          note: trimmedNote,
          decided: true,
        });
      } catch (err) {
        console.error("proposeRescheduleAsHost mail", err);
      }
    }
    revalidatePath("/", "layout");
    return { success: true as const, applied: true };
  }

  const { error } = await db
    .from("bookings")
    .update({
      reschedule_by: userId,
      reschedule_start_at: newStart.toISOString(),
      reschedule_end_at: newEnd.toISOString(),
      reschedule_note: trimmedNote,
      reschedule_created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", bookingId)
    .eq("host_id", userId);
  if (error) {
    console.error("proposeRescheduleAsHost", error);
    return { error: "제안에 실패했어요." };
  }

  try {
    const whenLabel = newStart.toLocaleString("ko-KR", {
      timeZone: "Asia/Seoul",
      month: "long",
      day: "numeric",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
    const { createNotification } = await import("@/lib/notifications");
    await createNotification({
      userId: booking.guest_id as string,
      type: "booking_reschedule_proposed",
      title: `${hostLabel}님이 '${slot.title}' 시간 변경을 제안했어요`,
      body: `${whenLabel} · 수락하면 예약이 옮겨져요`,
      link: `/bookings`,
      actorId: userId,
    });
    const { emailAllowed } = await import("@/lib/notification-prefs");
    if (
      guest?.email &&
      (await emailAllowed(booking.guest_id as string, "booking_confirmed"))
    ) {
      const { sendBookingRescheduleProposal } = await import("@/lib/email");
      await sendBookingRescheduleProposal(guest.email as string, {
        slotTitle: slot.title as string,
        previousWhen: booking.scheduled_at as string,
        when: newStart.toISOString(),
        proposerLabel: hostLabel,
        note: trimmedNote,
        decided: false,
      });
    }
  } catch (err) {
    console.error("proposeRescheduleAsHost notify", err);
  }

  revalidatePath("/", "layout");
  return { success: true as const, applied: false };
}

/**
 * 받은 변경 제안에 응답한다 (제안자의 상대만 호출 가능).
 * 수락하면 그때 실제로 옮기고, 양쪽이 합의한 시간이므로 확정으로 둔다.
 */
export async function respondToReschedule(
  bookingId: string,
  action: "accept" | "decline",
): Promise<{ success: true } | { error: string }> {
  const userId = await requireUserId();
  const db = getAdminClient();

  const { data: booking } = await db
    .from("bookings")
    .select(
      "id, guest_id, host_id, slot_id, availability_id, scheduled_at, status, google_event_id, reschedule_by, reschedule_start_at, reschedule_end_at, reschedule_created_at",
    )
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking) return { error: "예약을 찾을 수 없어요." };
  if (!booking.reschedule_created_at) {
    return { error: "대기 중인 변경 제안이 없어요." };
  }
  // 제안한 사람 말고, 상대만 응답할 수 있다.
  const isParty = booking.guest_id === userId || booking.host_id === userId;
  if (!isParty || booking.reschedule_by === userId) {
    return { error: "응답할 수 있는 제안이 아니에요." };
  }

  const { data: slot } = await db
    .from("time_slots")
    .select("*")
    .eq("id", booking.slot_id)
    .single();
  if (!slot) return { error: "슬롯을 찾을 수 없어요." };

  const proposerId = booking.reschedule_by as string;
  const [{ data: proposer }, { data: responder }] = await Promise.all([
    db
      .from("users")
      .select("email, username, display_name")
      .eq("id", proposerId)
      .single(),
    db
      .from("users")
      .select("email, username, display_name")
      .eq("id", userId)
      .single(),
  ]);
  const responderLabel = personLabel(responder, "상대");

  if (action === "decline") {
    const { error } = await db
      .from("bookings")
      .update({
        reschedule_by: null,
        reschedule_start_at: null,
        reschedule_end_at: null,
        reschedule_note: null,
        reschedule_created_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", bookingId);
    if (error) return { error: "처리에 실패했어요." };

    try {
      const { createNotification } = await import("@/lib/notifications");
      await createNotification({
        userId: proposerId,
        type: "booking_reschedule_declined",
        title: `${responderLabel}님이 '${slot.title}' 시간 변경을 거절했어요`,
        body: "예약은 원래 시간 그대로예요",
        link: `/bookings`,
        actorId: userId,
      });
    } catch (err) {
      console.error("respondToReschedule decline notify", err);
    }
    revalidatePath("/", "layout");
    return { success: true as const };
  }

  const newStart = new Date(booking.reschedule_start_at as string);
  const newEnd = new Date(booking.reschedule_end_at as string);
  if (newStart.getTime() <= Date.now()) {
    return { error: "이미 지나간 시간이에요. 새로 제안해달라고 해주세요." };
  }

  const moved = await moveBookingTo({
    booking: booking as never,
    slot: slot as never,
    newStart,
    newEnd,
    // 호스트가 임의 시각을 제안한 것이라 특정 가용 슬롯 행에 묶이지 않는다
    // (기존 점유는 moveBookingTo 가 비워준다).
    newAvailabilityId: null,
    // 양쪽이 이 시간에 합의했으니 재승인 절차는 필요 없다.
    newStatus: "confirmed",
  });
  if (moved.error) return { error: moved.error };

  try {
    const whenLabel = newStart.toLocaleString("ko-KR", {
      timeZone: "Asia/Seoul",
      month: "long",
      day: "numeric",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
    const { createNotification } = await import("@/lib/notifications");
    await createNotification({
      userId: proposerId,
      type: "booking_reschedule_accepted",
      title: `${responderLabel}님이 '${slot.title}' 시간 변경을 수락했어요`,
      body: whenLabel,
      link: `/bookings`,
      actorId: userId,
    });
    const { emailAllowed } = await import("@/lib/notification-prefs");
    if (
      proposer?.email &&
      (await emailAllowed(proposerId, "booking_confirmed"))
    ) {
      const { sendBookingRescheduleProposal } = await import("@/lib/email");
      await sendBookingRescheduleProposal(proposer.email as string, {
        slotTitle: slot.title as string,
        previousWhen: booking.scheduled_at as string,
        when: newStart.toISOString(),
        proposerLabel: responderLabel,
        note: null,
        decided: true,
      });
    }
  } catch (err) {
    console.error("respondToReschedule accept notify", err);
  }

  revalidatePath("/", "layout");
  return { success: true as const };
}

/**
 * 내가 보낸 변경 제안을 거둬들인다 (제안한 사람만).
 *
 * 다른 시간으로 다시 제안해 덮어쓰는 것과 달리, 상대가 이미 "제안이 왔어요"
 * 알림을 받은 상태라 조용히 사라지면 헷갈린다. 그래서 상대에게도 알린다.
 */
export async function withdrawReschedule(
  bookingId: string,
): Promise<{ success: true } | { error: string }> {
  const userId = await requireUserId();
  const db = getAdminClient();

  const { data: booking } = await db
    .from("bookings")
    .select(
      "id, guest_id, host_id, slot_id, reschedule_by, reschedule_created_at",
    )
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking) return { error: "예약을 찾을 수 없어요." };
  if (!booking.reschedule_created_at) {
    return { error: "거둬들일 제안이 없어요." };
  }
  if (booking.reschedule_by !== userId) {
    return { error: "내가 보낸 제안만 취소할 수 있어요." };
  }

  const { error } = await db
    .from("bookings")
    .update({
      reschedule_by: null,
      reschedule_start_at: null,
      reschedule_end_at: null,
      reschedule_note: null,
      reschedule_created_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", bookingId)
    .eq("reschedule_by", userId);
  if (error) {
    console.error("withdrawReschedule", error);
    return { error: "처리에 실패했어요." };
  }

  // 상대(제안을 받았던 쪽)에게 알린다.
  const otherId =
    booking.guest_id === userId
      ? (booking.host_id as string)
      : (booking.guest_id as string | null);
  if (otherId) {
    try {
      const [{ data: slot }, { data: me }] = await Promise.all([
        db.from("time_slots").select("title").eq("id", booking.slot_id).single(),
        db
          .from("users")
          .select("username, display_name")
          .eq("id", userId)
          .single(),
      ]);
      const { createNotification } = await import("@/lib/notifications");
      await createNotification({
        userId: otherId,
        type: "booking_reschedule_withdrawn",
        title: `${personLabel(me, "상대")}님이 '${slot?.title ?? "예약"}' 시간 변경 제안을 취소했어요`,
        body: "예약은 원래 시간 그대로예요",
        link: `/bookings`,
        actorId: userId,
      });
    } catch (err) {
      console.error("withdrawReschedule notify", err);
    }
  }

  revalidatePath("/", "layout");
  return { success: true as const };
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

  await removeBookingCalendarEvent(bookingId);
  await db.from("events").delete().eq("booking_id", bookingId);

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
    const guestLabel = (guest?.display_name || guest?.username || "게스트") as string;
    try {
      const { createNotification } = await import("@/lib/notifications");
      await createNotification({
        userId: booking.host_id as string,
        type: "booking_canceled",
        title: `예약 취소: ${slotInfo?.title ?? "예약"}`,
        body: `${guestLabel}님이 예약을 취소했어요.`,
        link: `/${host?.username}/bookings`,
        actorId: userId,
      });
    } catch (err) {
      console.error("cancelMyBooking notification", err);
    }
    const { emailAllowed } = await import("@/lib/notification-prefs");
    if (host?.email && (await emailAllowed(booking.host_id as string, "booking_canceled"))) {
      const { sendBookingReceivedToHost } = await import("@/lib/email");
      await sendBookingReceivedToHost(host.email as string, {
        slotTitle: slotInfo?.title ?? "예약",
        when: booking.scheduled_at as string,
        guestLabel,
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
