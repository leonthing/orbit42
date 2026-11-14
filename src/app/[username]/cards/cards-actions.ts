"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase";
import { cardsOpenFor } from "@/lib/cards-access";
import { disconnectCards, clearRevokedCalendarTokens } from "@/lib/cards-google";

/** 명함 연결 해제(허용 계정 본인만). revokeAll=true 는 구글 권한까지 회수 — 캘린더 연결도 끊긴다 */
export async function disconnectCardsAction(revokeAll: boolean) {
  const s = await getSession();
  if (!s) return { error: "로그인이 필요해요." };
  const { data } = await getAdminClient().from("users").select("id").eq("username", s.username).single();
  if (!data || !cardsOpenFor(data.id as string)) return { error: "Not found" };
  await disconnectCards(data.id as string, revokeAll === true);
  if (revokeAll === true) await clearRevokedCalendarTokens(data.id as string);
  revalidatePath(`/${s.username}/cards`);
  return { ok: true as const };
}
