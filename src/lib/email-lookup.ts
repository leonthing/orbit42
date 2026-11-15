// 일반 서버 모듈 — 서버 액션 아님. 이메일로 회원·예약 찾기는 LIKE 없이 정확 일치로만(PO 11/16).
// DB 함수 user_id_by_email / guest_bookings_since: lower(email) = lower(btrim(값)), lower(email) 유일 인덱스를 탄다.
import { getAdminClient } from "@/lib/supabase";

/** 어떤 행과도 맞지 않는 id — '.eq("id", await idForEmail(x))' 처럼 기존 쿼리에 그대로 끼우려고 */
export const NO_USER_ID = "00000000-0000-0000-0000-000000000000";

/** 이메일과 정확히 같은(대소문자·앞뒤 공백 무시) 회원 id. 없으면 null. DB 오류는 그대로 던진다(조용히 '없음'으로 보지 않게) */
export async function userIdByEmail(email: string): Promise<string | null> {
  const e = (email ?? "").trim();
  if (!e) return null;
  const { data, error } = await getAdminClient().rpc("user_id_by_email", { p_email: e });
  if (error) throw new Error(`user_id_by_email: ${error.code ?? error.message}`);
  return (data as string | null) ?? null;
}

/** userIdByEmail 이 없으면 NO_USER_ID */
export async function idForEmail(email: string): Promise<string> {
  return (await userIdByEmail(email)) ?? NO_USER_ID;
}

/** 게스트 이메일(정확 일치)로 since 이후 예약 수 */
export async function guestBookingsSince(email: string, sinceIso: string): Promise<number> {
  const { data, error } = await getAdminClient().rpc("guest_bookings_since", { p_email: email.trim(), p_since: sinceIso });
  if (error) throw new Error(`guest_bookings_since: ${error.code ?? error.message}`);
  return Number(data ?? 0);
}
