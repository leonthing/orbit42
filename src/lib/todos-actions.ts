"use server";

// 클라이언트가 부르는 서버 액션은 여기서만(보안-6·7): 세션으로 본인을 정하고, 바꾸는 칸은 정해 둔 것만(done·title·dueDate).
import { getSession } from "@/lib/auth";
import { userIdOf } from "@/lib/dm";
import { createTodos, dayTodos, deleteTodo, followUpsOf, linkFollowUp, updateTodo, type FollowUps, type Todo } from "@/lib/todos";

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

// ── 캘린더와 엮인 할 일(웹 묶음 1b, iOS 와 같은 흐름) — 모두 세션 본인 것만 ──

const isStr = (v: unknown, max = 2000): v is string => typeof v === "string" && v.length > 0 && v.length <= max;

/** 하루 보기 할 일 띠 — 그날 기한 + (오늘이면) 기한 지난 미완료 수 */
export async function dayTodosFor(date: string): Promise<{ todos: Todo[]; overdue: number } | { error: string }> {
  if (!isStr(date, 10) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "잘못된 요청이에요." };
  const id = await me();
  if (!id) return { error: "로그인이 필요해요." };
  const r = await dayTodos(id, date);
  return "error" in r ? { error: r.error } : r;
}

/** 일정 상세 '후속' — 원래 일정·후속 일정·묶인 할 일 */
export async function followUpsFor(eventId: string): Promise<FollowUps | { error: string }> {
  if (!isStr(eventId, 1200)) return { error: "잘못된 요청이에요." };
  const id = await me();
  if (!id) return { error: "로그인이 필요해요." };
  const r = await followUpsOf(id, eventId);
  return "error" in r ? { error: r.error } : r;
}

/** 일정에 묶인 할 일 만들기 — 후속 [할 일]·완료 뒤 묻기·메모 '-' 줄 */
export async function addEventTodos(eventId: string, titles: string[], dueDate: string | null = null): Promise<{ todos: Todo[] } | { error: string }> {
  if (!isStr(eventId, 1200) || !Array.isArray(titles) || titles.length === 0 || titles.length > 30 || !titles.every((t) => typeof t === "string")) {
    return { error: "잘못된 요청이에요." };
  }
  if (dueDate !== null && (typeof dueDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate))) return { error: "잘못된 요청이에요." };
  const id = await me();
  if (!id) return { error: "로그인이 필요해요." };
  const r = await createTodos(id, { items: titles.map((title) => ({ title, dueDate })), sourceEventKey: eventId });
  return "error" in r ? { error: r.error } : r;
}

/** 후속 일정 연결 — 두 일정 모두 본인 것이어야 한다(lib 이 확인) */
export async function linkFollowUpEvent(sourceId: string, targetId: string): Promise<{ ok: true } | { error: string }> {
  if (!isStr(sourceId, 1200) || !isStr(targetId, 1200)) return { error: "잘못된 요청이에요." };
  const id = await me();
  if (!id) return { error: "로그인이 필요해요." };
  const r = await linkFollowUp(id, sourceId, targetId);
  return "error" in r ? { error: r.error } : { ok: true };
}
