"use server";

// 클라이언트가 부르는 서버 액션은 여기서만(보안-6·7): 세션으로 본인을 정하고, 바꾸는 칸은 done 하나.
import { getSession } from "@/lib/auth";
import { userIdOf } from "@/lib/dm";
import { updateTodo } from "@/lib/todos";

export async function toggleTodo(id: string, done: boolean): Promise<{ ok: true } | { error: string }> {
  if (typeof id !== "string" || typeof done !== "boolean") return { error: "잘못된 요청이에요." };
  const session = await getSession();
  if (!session) return { error: "로그인이 필요해요." };
  const me = await userIdOf(session.username);
  if (!me) return { error: "로그인이 필요해요." };
  const r = await updateTodo(me, id, { done });
  return "error" in r ? { error: r.error } : { ok: true };
}
