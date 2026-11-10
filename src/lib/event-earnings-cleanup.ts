import { getAdminClient } from "@/lib/supabase";
import { parseOccurrenceId } from "@/lib/recurrence";

/**
 * 일정을 지울 때 그 일정의 수익 기록(event_earnings)과 구글 일정 부가정보 기록도 같이 지운다 — 지운 일정 금액이
 * 리포트 '번 돈'에 남지 않게 (1.8.0). 키는 클라이언트 원형 id(uuid · 회차 id · "gcal_<id>").
 * 실패해도 일정 삭제는 이미 끝났으니 던지지 않고 로그만 남긴다.
 */
export async function deleteEarningsForEvents(
  userId: string,
  target:
    | { keys: string[] }
    /** Orbit42 반복 일정 — 시리즈 키와 회차 키. from 이 있으면 그 원래 시작 이후 회차만 */
    | { seriesId: string; from?: Date; includeSeriesKey?: boolean }
    /** 구글 반복 — master 키와 "gcal_<master>_<날짜>" 회차 키 */
    | { googleMasterId: string },
) {
  const db = getAdminClient();
  // 구글 일정의 부가정보 기록(event_annotations 의 이동시간·좌표·기념일)도 같이 비운다 — Orbit42 일정은 행과 함께 사라진다
  try {
    const { clearGoogleMetaForKeys, clearGoogleMetaForSeries } = await import("@/lib/google-event-meta");
    if ("keys" in target) await clearGoogleMetaForKeys(userId, target.keys.filter((k) => k.startsWith("gcal_")));
    else if ("googleMasterId" in target) await clearGoogleMetaForSeries(userId, target.googleMasterId);
  } catch (err) {
    console.error("deleteEarningsForEvents travel", err);
  }
  try {
    let keys: string[];
    if ("keys" in target) {
      keys = target.keys;
    } else if ("seriesId" in target) {
      const { seriesId, from, includeSeriesKey = true } = target;
      const { data } = await db
        .from("event_earnings")
        .select("event_key")
        .eq("user_id", userId)
        .like("event_key", `${seriesId}%`);
      keys = (data ?? [])
        .map((r) => String(r.event_key))
        .filter((k) => {
          if (k === seriesId) return includeSeriesKey;
          const occ = parseOccurrenceId(k);
          if (!occ || occ.seriesId !== seriesId) return false;
          return !from || occ.originalStart.getTime() >= from.getTime();
        });
    } else {
      const master = `gcal_${target.googleMasterId}`;
      const { data } = await db
        .from("event_earnings")
        .select("event_key")
        .eq("user_id", userId)
        .like("event_key", `${master}%`);
      keys = (data ?? [])
        .map((r) => String(r.event_key))
        .filter((k) => k === master || /^_\d{8}(T\d{6}Z)?$/.test(k.slice(master.length)));
    }
    if (keys.length === 0) return;
    const { error } = await db
      .from("event_earnings")
      .delete()
      .eq("user_id", userId)
      .in("event_key", keys);
    if (error) console.error("deleteEarningsForEvents", error);
  } catch (err) {
    console.error("deleteEarningsForEvents", err);
  }
}
