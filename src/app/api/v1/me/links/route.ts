import { apiSession } from "@/lib/api-auth";
import { getAdminClient } from "@/lib/supabase";
import { displayCustomLinks, parseCustomLinks } from "@/lib/custom-links";

export const dynamic = "force-dynamic";

// 공개 링크 페이지 직접 링크 (개선-46) — GET: 내 링크, PUT { links: [{title,url}] }: 통째로 바꾼다(순서 그대로)
export async function GET(request: Request) {
  const session = await apiSession(request);
  if (!session) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  const { data } = await getAdminClient().from("users").select("custom_links").eq("username", session.username).maybeSingle();
  return Response.json({ links: displayCustomLinks(data?.custom_links) });
}

export async function PUT(request: Request) {
  const session = await apiSession(request);
  if (!session) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  let body: { links?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }
  const parsed = parseCustomLinks(body.links);
  if ("error" in parsed) return Response.json({ error: parsed.error }, { status: 400 });
  const { error } = await getAdminClient()
    .from("users")
    .update({ custom_links: parsed.links, updated_at: new Date().toISOString() })
    .eq("username", session.username);
  if (error) {
    console.error("[me/links] save", error.message);
    return Response.json({ error: "저장하지 못했어요. 잠시 후 다시 시도해 주세요." }, { status: 500 });
  }
  const { revalidatePath } = await import("next/cache");
  revalidatePath(`/${session.username}`);
  return Response.json({ links: parsed.links });
}
