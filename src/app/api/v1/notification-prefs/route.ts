import { apiSession } from "@/lib/api-auth";
import { getMyPrefs, setPref } from "@/lib/notification-prefs";
import { NOTIFICATION_TYPES, PUSH_TYPES } from "@/lib/notification-prefs-types";

export const dynamic = "force-dynamic";

async function listPrefs() {
  const prefs = await getMyPrefs();
  // 행이 없으면 기본 ON (getPrefFor 규칙과 동일).
  return NOTIFICATION_TYPES.map((t) => ({
    type: t.key,
    label: t.label,
    inApp: prefs[t.key]?.in_app ?? true,
    email: prefs[t.key]?.email ?? true,
    // 앱 푸시를 보내는 유형만 값이 있다(그 밖은 null — 앱은 스위치를 그리지 않는다)
    push: (PUSH_TYPES as readonly string[]).includes(t.key) ? (prefs[t.key]?.push ?? true) : null,
  }));
}

// GET — 13개 알림 타입 × (인앱, 이메일) 설정
export async function GET(request: Request) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  return Response.json({ prefs: await listPrefs() });
}

// PATCH { type, channel: "inApp"|"email"|"push", enabled }
export async function PATCH(request: Request) {
  const session = await apiSession(request);
  if (!session) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  let body: { type?: string; channel?: string; enabled?: boolean };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }
  if (!NOTIFICATION_TYPES.some((t) => t.key === body.type)) {
    return Response.json({ error: "알 수 없는 알림 유형이에요." }, { status: 400 });
  }
  if (body.channel === "push" && !(PUSH_TYPES as readonly string[]).includes(body.type as string)) {
    return Response.json({ error: "이 알림은 앱 푸시가 없어요." }, { status: 400 });
  }
  if (body.channel !== "inApp" && body.channel !== "email" && body.channel !== "push") {
    return Response.json({ error: "채널이 올바르지 않아요." }, { status: 400 });
  }
  if (typeof body.enabled !== "boolean") {
    return Response.json({ error: "enabled 값이 필요해요." }, { status: 400 });
  }

  const result = await setPref(
    body.type as string,
    body.channel === "inApp" ? "in_app" : body.channel === "push" ? "push" : "email",
    body.enabled,
  );
  if ("error" in result && result.error) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  return Response.json({ prefs: await listPrefs() });
}
