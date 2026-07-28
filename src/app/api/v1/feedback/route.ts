import { apiSession } from "@/lib/api-auth";
import { submitFeedback } from "@/lib/feedback";

export const dynamic = "force-dynamic";

const CATEGORY_LABEL: Record<string, string> = {
  bug: "버그",
  idea: "제안",
  etc: "기타",
};

// POST { category: "bug"|"idea"|"etc", message, appVersion? }
// 앱 내 피드백 — 웹과 같은 feedback 파이프라인(저장·운영자 메일·어드민)을 쓴다.
// 출처·분류·앱 버전은 어드민에서 구분되도록 path 필드에 담는다.
export async function POST(request: Request) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  let body: { category?: string; message?: string; appVersion?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }
  const message = (body.message ?? "").trim();
  if (!message) {
    return Response.json({ error: "내용을 입력해 주세요." }, { status: 400 });
  }
  const label = CATEGORY_LABEL[body.category ?? ""] ?? "기타";
  const version = body.appVersion ? ` v${String(body.appVersion).slice(0, 30)}` : "";

  const result = await submitFeedback({
    body: message,
    path: `iOS 앱 · ${label}${version}`,
  });
  if ("error" in result && result.error) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  return Response.json({ ok: true });
}
