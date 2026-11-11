// 일반 서버 모듈 — 서버 액션 아님(보안-6). 클라이언트용은 *-actions.ts
import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/db";
import { deleteExtraGoogleAccount } from "@/lib/google";

export async function disconnectExtraAccount(accountId: string) {
  const userId = await requireUserId();
  await deleteExtraGoogleAccount(accountId, userId);
  revalidatePath("/", "layout");
  return { success: true };
}
