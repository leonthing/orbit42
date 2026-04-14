"use server";

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/db";
import { deleteExtraGoogleAccount } from "@/lib/google";

export async function disconnectExtraAccount(accountId: string) {
  const userId = await requireUserId();
  await deleteExtraGoogleAccount(accountId, userId);
  revalidatePath("/", "layout");
  return { success: true };
}
