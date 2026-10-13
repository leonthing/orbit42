"use server";

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/db";
import { getSession } from "@/lib/auth";
import {
  issuePersonalAccessToken,
  listPersonalAccessTokens,
  revokePersonalAccessToken,
} from "@/lib/pat";

/** 연동 토큰 발급 — 토큰 값은 이 응답에서 한 번만 보여 주고 서버에는 남기지 않는다. */
export async function issueIntegrationToken(name: string) {
  const userId = await requireUserId();
  const session = await getSession();
  if (!session) return { error: "로그인이 필요해요." };
  const trimmed = name.trim().slice(0, 60);
  if (!trimmed) return { error: "이름을 입력해 주세요." };
  const active = (await listPersonalAccessTokens(userId)).filter((t) => !t.revoked_at);
  if (active.length >= 5) return { error: "토큰은 5개까지 쓸 수 있어요. 안 쓰는 토큰을 폐기해 주세요." };
  try {
    const { token } = await issuePersonalAccessToken(userId, session.username, trimmed);
    revalidatePath("/", "layout");
    return { token };
  } catch {
    return { error: "발급에 실패했어요." };
  }
}

export async function revokeIntegrationToken(id: string) {
  const userId = await requireUserId();
  try {
    await revokePersonalAccessToken(userId, id);
    revalidatePath("/", "layout");
    return { success: true as const };
  } catch {
    return { error: "폐기에 실패했어요." };
  }
}
