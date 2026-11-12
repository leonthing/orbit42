import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase";
import { WEB_DM_CLOSED_MESSAGE, WEB_DM_OPEN } from "@/lib/dm-flags";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { id: string } },
) {
  if (!WEB_DM_OPEN) {
    return NextResponse.json({ messages: [], error: WEB_DM_CLOSED_MESSAGE }, { status: 503 });
  }
  const session = await getSession();
  if (!session) return NextResponse.json({ messages: [] }, { status: 401 });

  const db = getAdminClient();
  const { data: me } = await db
    .from("users")
    .select("id")
    .eq("username", session.username)
    .single();
  if (!me) return NextResponse.json({ messages: [] }, { status: 401 });

  const { data: conv } = await db
    .from("conversations")
    .select("user_a, user_b")
    .eq("id", params.id)
    .single();
  if (!conv || (conv.user_a !== me.id && conv.user_b !== me.id)) {
    return NextResponse.json({ messages: [] }, { status: 403 });
  }

  const since = new URL(req.url).searchParams.get("since");
  let query = db
    .from("messages")
    .select("id, sender_id, body, created_at")
    .eq("conversation_id", params.id)
    .order("created_at", { ascending: true })
    .limit(100);
  if (since) query = query.gt("created_at", since);

  const { data } = await query;
  return NextResponse.json({ messages: data ?? [] });
}
