import { apiSession } from "@/lib/api-auth";
import { toggleEventCompletion, setEventStatus } from "@/lib/event-completions";
import { normalizeEventKey } from "@/lib/event-key";

export const dynamic = "force-dynamic";

// PUT { completed: boolean } — 일정 완료 체크 (투두). 웹과 동일한
// event_completions 키를 공유하므로 양쪽 어디서 체크해도 동기화된다.
// PUT { status: "done" | "archived" | "none" } — 완료·보관 지정/해제 (1.4.1+).
// completed:false 는 완료만 지우고 보관은 남긴다 (옛 앱 호환).
export async function PUT(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  let body: { completed?: boolean; status?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }
  if (body.status !== undefined) {
    if (body.status !== "done" && body.status !== "archived" && body.status !== "none") {
      return Response.json({ error: "status 는 done·archived·none 중 하나예요." }, { status: 400 });
    }
    const result = await setEventStatus(normalizeEventKey(params.id), body.status);
    if (result && "error" in result && result.error) {
      return Response.json({ error: result.error }, { status: 400 });
    }
    return Response.json({
      ok: true,
      completed: body.status === "done",
      status: body.status === "none" ? null : body.status,
    });
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
