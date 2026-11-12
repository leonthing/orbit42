import { createTodos, dayTodos, listTodos } from "@/lib/todos";
import { noStore, todoError, todoMe } from "@/lib/todo-route";

export const dynamic = "force-dynamic";

/**
 * 할 일 (1.9.0)
 * GET ?view=day&date=YYYY-MM-DD → { todos, overdue } (오늘이면 기한 지난 미완료 포함)
 * GET (view=list) → { overdue, today, upcoming, someday, done(최근 30일), today_date }
 * POST { items: [{ title, dueDate? }], sourceEventKey? } → { todos } (최대 30개, 같은 일정·같은 제목은 건너뜀)
 */
export async function GET(request: Request) {
  const a = await todoMe(request);
  if ("res" in a) return a.res;
  const url = new URL(request.url);
  const r = url.searchParams.get("view") === "day" ? await dayTodos(a.me, url.searchParams.get("date") ?? "") : await listTodos(a.me);
  if ("error" in r) return todoError(r);
  return Response.json(r, noStore);
}

export async function POST(request: Request) {
  const a = await todoMe(request);
  if ("res" in a) return a.res;
  const body = (await request.json().catch(() => ({}))) as { items?: unknown; sourceEventKey?: unknown };
  const r = await createTodos(a.me, { items: Array.isArray(body.items) ? body.items : [], sourceEventKey: body.sourceEventKey });
  if ("error" in r) return todoError(r);
  return Response.json(r);
}
