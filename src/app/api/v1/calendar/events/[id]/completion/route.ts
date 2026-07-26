import { apiSession } from "@/lib/api-auth";
import { toggleEventCompletion } from "@/lib/event-completions";
import { normalizeEventKey } from "@/lib/event-key";

export const dynamic = "force-dynamic";

// PUT { completed: boolean } — 일정 완료 체크 (투두). 웹과 동일한
// event_completions 키를 공유하므로 양쪽 어디서 체크해도 동기화된다.
export async function PUT(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  let body: { completed?: boolean };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }
  if (typeof body.completed !== "boolean") {
    return Response.json({ error: "completed 값이 필요해요." }, { status: 400 });
  }

  const result = await toggleEventCompletion(
    normalizeEventKey(params.id),
    body.completed,
  );
  if (result && "error" in result && result.error) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  return Response.json({ ok: true, completed: body.completed });
}
