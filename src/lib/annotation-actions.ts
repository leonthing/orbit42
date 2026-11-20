"use server";

// 일정 만족도(♥1~5) — '나만 봐요' 데이터. 세션 본인 행만 읽고 쓴다(user_id 는 세션에서만), 바꾸는 칸은 rating 하나.
import { getSession } from "@/lib/auth";
import { userIdOf } from "@/lib/dm";
import { getAnnotations, upsertAnnotation } from "@/lib/event-annotations";
import { toEventKey } from "@/lib/event-key";

async function me(): Promise<string | null> {
  const session = await getSession();
  if (!session) return null;
  return userIdOf(session.username);
}

/** 보이는 일정들의 내 만족도 — { 일정 키: 1~5 } */
export async function myRatings(eventIds: string[]): Promise<Record<string, number>> {
  if (!Array.isArray(eventIds) || eventIds.length > 1000 || !eventIds.every((e) => typeof e === "string" && e.length <= 1200)) return {};
  const id = await me();
  if (!id || eventIds.length === 0) return {};
  const map = await getAnnotations(id, eventIds);
  const out: Record<string, number> = {};
  map.forEach((a, k) => {
    if (a.rating != null) out[k] = a.rating;
  });
  return out;
}

/** 만족도 주기·지우기(null) */
export async function setMyRating(eventId: string, rating: number | null): Promise<{ ok: true; rating: number | null } | { error: string }> {
  if (typeof eventId !== "string" || !eventId || eventId.length > 1200) return { error: "잘못된 요청이에요." };
  if (rating !== null && !(Number.isInteger(rating) && rating >= 1 && rating <= 5)) return { error: "만족도는 1~5예요." };
  const id = await me();
  if (!id) return { error: "로그인이 필요해요." };
  try {
    const a = await upsertAnnotation(id, toEventKey(eventId), { rating });
    return { ok: true, rating: a.rating };
  } catch {
    return { error: "저장하지 못했어요. 잠시 후 다시 시도해 주세요." };
  }
}
