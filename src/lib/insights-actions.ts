// 일반 서버 모듈 — 서버 액션 아님(보안-6). 클라이언트용은 *-actions.ts
import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/db";
import { saveWorkHours, type WorkHours } from "@/lib/insights";

export async function updateWorkHours(hours: WorkHours) {
  const userId = await requireUserId();
  const sanitized = await saveWorkHours(userId, hours);
  revalidatePath("/", "layout");
  return { success: true, hours: sanitized };
}
