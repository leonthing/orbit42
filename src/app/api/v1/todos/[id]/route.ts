import { deleteTodo, updateTodo } from "@/lib/todos";
import { todoError, todoMe } from "@/lib/todo-route";

export const dynamic = "force-dynamic";

/** PATCH { title?, dueDate?(null=기한 없음), done?, sortOrder? } → { todo } — 본인 것만(남의 id 는 404). DELETE → { ok } */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const a = await todoMe(request);
  if ("res" in a) return a.res;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: { title?: unknown; dueDate?: unknown; done?: unknown; sortOrder?: unknown } = {};
  for (const k of ["title", "dueDate", "done", "sortOrder"] as const) if (k in body) patch[k] = body[k];
  const r = await updateTodo(a.me, params.id, patch);
  if ("error" in r) return todoError(r);
  return Response.json(r);
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const a = await todoMe(request);
  if ("res" in a) return a.res;
  const r = await deleteTodo(a.me, params.id);
  if ("error" in r) return todoError(r);
  return Response.json(r);
}
