"use server";

import { revalidatePath } from "next/cache";
import { getAdminClient } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import { getUserId, requireUserId } from "@/lib/db";

export type SlotType = "1on1" | "companion" | "group";
export type LocationType = "online" | "in_person" | "phone";

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
  /** ISO datetime strings for initial availability windows */
  availability_starts?: string[];
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
  availabilityId: string;
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

  const { data: avail } = await db
    .from("slot_availabilities")
    .select("id, slot_id, start_at, capacity, booked_count")
    .eq("id", args.availabilityId)
    .single();
  if (!avail) return { error: "시간을 찾을 수 없습니다." };
  if ((avail.booked_count as number) >= (avail.capacity as number)) {
    return { error: "이미 마감된 시간입니다." };
  }

  const { data: slot } = await db
    .from("time_slots")
    .select("id, host_id, duration_min, active")
    .eq("id", avail.slot_id)
    .single();
  if (!slot || !slot.active) return { error: "예약할 수 없는 슬롯입니다." };

  const startAt = new Date(avail.start_at as string);
  const endAt = new Date(startAt.getTime() + (slot.duration_min as number) * 60_000);

  const { error: bookErr } = await db.from("bookings").insert({
    slot_id: slot.id,
    availability_id: avail.id,
    host_id: slot.host_id,
    guest_id: guestId,
    guest_name: args.guest_name ?? null,
    guest_email: args.guest_email ?? null,
    message: args.message ?? null,
    scheduled_at: startAt.toISOString(),
    scheduled_end_at: endAt.toISOString(),
  });
  if (bookErr) return { error: "예약에 실패했습니다." };

  await db
    .from("slot_availabilities")
    .update({ booked_count: (avail.booked_count as number) + 1 })
    .eq("id", avail.id);

  revalidatePath("/", "layout");
  return { success: true };
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
  const { error } = await db
    .from("bookings")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("host_id", userId);
  if (error) return { error: "변경 실패" };
  revalidatePath("/", "layout");
  return { success: true };
}
