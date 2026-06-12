"use server";

import { revalidatePath } from "next/cache";
import { getAdminClient } from "@/lib/supabase";
import { requireUserId } from "@/lib/db";

export type HostReview = {
  id: string;
  rating: number;
  body: string | null;
  created_at: string;
  slot_title: string | null;
  reviewer: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

export type HostRating = {
  average: number;
  count: number;
};

/** Guest leaves a review on their own finished booking. */
export async function addBookingReview(
  bookingId: string,
  rating: number,
  body: string,
) {
  const userId = await requireUserId();
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { error: "별점은 1~5점이에요." };
  }
  const db = getAdminClient();

  const { data: booking } = await db
    .from("bookings")
    .select("id, guest_id, host_id, slot_id, status, scheduled_end_at")
    .eq("id", bookingId)
    .eq("guest_id", userId)
    .maybeSingle();
  if (!booking) return { error: "예약을 찾을 수 없어요." };
  const ended =
    booking.status === "completed" ||
    (booking.status === "confirmed" &&
      new Date(booking.scheduled_end_at as string) < new Date());
  if (!ended) return { error: "끝난 예약에만 후기를 남길 수 있어요." };

  const { error } = await db.from("booking_reviews").insert({
    booking_id: bookingId,
    reviewer_id: userId,
    host_id: booking.host_id,
    slot_id: booking.slot_id,
    rating,
    body: body.trim() ? body.trim().slice(0, 2000) : null,
  });
  if (error) {
    if ((error.code as string) === "23505") {
      return { error: "이미 후기를 남긴 예약이에요." };
    }
    console.error("addBookingReview", error);
    return { error: "후기 등록에 실패했어요." };
  }

  // Tell the host.
  try {
    const [{ data: reviewer }, { data: host }] = await Promise.all([
      db
        .from("users")
        .select("username, display_name")
        .eq("id", userId)
        .single(),
      db
        .from("users")
        .select("username")
        .eq("id", booking.host_id)
        .single(),
    ]);
    const label =
      (reviewer?.display_name as string | null) ||
      (reviewer?.username as string) ||
      "게스트";
    const { createNotification } = await import("@/lib/notifications");
    await createNotification({
      userId: booking.host_id as string,
      type: "review_received",
      title: `${label}님이 후기를 남겼어요 (★${rating})`,
      body: body.trim() ? body.trim().slice(0, 120) : null,
      link: host?.username ? `/${host.username}` : null,
      actorId: userId,
    });
  } catch (err) {
    console.error("addBookingReview notify", err);
  }

  revalidatePath("/", "layout");
  return { ok: true as const };
}

/** Booking ids the current user has already reviewed (for the inbox UI). */
export async function listMyReviewedBookingIds(): Promise<string[]> {
  const userId = await requireUserId().catch(() => null);
  if (!userId) return [];
  const db = getAdminClient();
  const { data } = await db
    .from("booking_reviews")
    .select("booking_id")
    .eq("reviewer_id", userId);
  return (data ?? []).map((r) => r.booking_id as string);
}

export async function getHostRating(hostId: string): Promise<HostRating | null> {
  const db = getAdminClient();
  const { data } = await db
    .from("booking_reviews")
    .select("rating")
    .eq("host_id", hostId);
  if (!data || data.length === 0) return null;
  const sum = data.reduce((acc, r) => acc + (r.rating as number), 0);
  return {
    average: Math.round((sum / data.length) * 10) / 10,
    count: data.length,
  };
}

export async function listHostReviews(
  hostId: string,
  limit = 5,
): Promise<HostReview[]> {
  const db = getAdminClient();
  const { data } = await db
    .from("booking_reviews")
    .select(
      "id, rating, body, created_at, slot:time_slots(title), reviewer:users!booking_reviews_reviewer_id_fkey(username, display_name, avatar_url)",
    )
    .eq("host_id", hostId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return ((data ?? []) as unknown as Array<{
    id: string;
    rating: number;
    body: string | null;
    created_at: string;
    slot: { title: string } | null;
    reviewer: {
      username: string;
      display_name: string | null;
      avatar_url: string | null;
    } | null;
  }>).map((r) => ({
    id: r.id,
    rating: r.rating,
    body: r.body,
    created_at: r.created_at,
    slot_title: r.slot?.title ?? null,
    reviewer: r.reviewer,
  }));
}
