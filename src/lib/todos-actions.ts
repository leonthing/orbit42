"use server";

// 클라이언트가 부르는 서버 액션은 여기서만(보안-6·7): 세션으로 본인을 정하고, 바꾸는 칸은 정해 둔 것만(done·title·dueDate).
import { getSession } from "@/lib/auth";
import { userIdOf } from "@/lib/dm";
import { createTodos, deleteTodo, updateTodo, type Todo } from "@/lib/todos";

export async function toggleTodo(id: string, done: boolean): Promise<{ ok: true } | { error: string }> {
  if (typeof id !== "string" || typeof done !== "boolean") return { error: "잘못된 요청이에요." };
  const session = await getSession();
  if (!session) return { error: "로그인이 필요해요." };
  const me = await userIdOf(session.username);
  if (!me) return { error: "로그인이 필요해요." };
  const r = await updateTodo(me, id, { done });
  return "error" in r ? { error: r.error } : { ok: true };
}

async function me(): Promise<string | null> {
  const session = await getSession();
  if (!session) return null;
  return userIdOf(session.username);
}

/** 웹 할 일 만들기(묶음 B) — 한 번에 하나, 일정 연결 없이. 검사·한도는 createTodos 가 앱과 똑같이 한다. */
export async function addTodo(title: string, dueDate: string | null): Promise<{ todo: Todo } | { error: string }> {
  if (typeof title !== "string" || (dueDate !== null && typeof dueDate !== "string")) return { error: "잘못된 요청이에요." };
  const id = await me();
  if (!id) return { error: "로그인이 필요해요." };
  const r = await createTodos(id, { items: [{ title, dueDate }] });
  if ("error" in r) return { error: r.error };
  if (r.todos.length === 0) return { error: "할 일을 만들지 못했어요." };
  return { todo: r.todos[0] };
}

/** 웹 할 일 고치기 — 제목·기한만 */
export async function editTodo(todoId: string, title: string, dueDate: string | null): Promise<{ todo: Todo } | { error: string }> {
  if (typeof todoId !== "string" || typeof title !== "string" || (dueDate !== null && typeof dueDate !== "string")) return { error: "잘못된 요청이에요." };
  const id = await me();
  if (!id) return { error: "로그인이 필요해요." };
  const r = await updateTodo(id, todoId, { title, dueDate });
  return "error" in r ? { error: r.error } : { todo: r.todo };
}

export async function removeTodo(todoId: string): Promise<{ ok: true } | { error: string }> {
  if (typeof todoId !== "string") return { error: "잘못된 요청이에요." };
  const id = await me();
  if (!id) return { error: "로그인이 필요해요." };
  const r = await deleteTodo(id, todoId);
  return "error" in r ? { error: r.error } : { ok: true };
}
