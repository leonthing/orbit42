import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase";
import { cardsOpenFor } from "@/lib/cards-access";
import { getCardAuthUrl } from "@/lib/cards-google";
import { cardStateToken } from "@/lib/cards-route";

export const dynamic = "force-dynamic";

/** 웹: 명함용 구글 권한 묻기(허용 계정만). 콜백은 쿠키 세션과 state 토큰이 같은 사람인지 둘 다 본다 */
export async function GET(request: Request) {
  const s = await getSession();
  if (!s) return NextResponse.redirect(new URL("/login", request.url));
  const { data } = await getAdminClient().from("users").select("id").eq("username", s.username).single();
  if (!data || !cardsOpenFor(data.id as string)) return new NextResponse("Not found", { status: 404 });
  return NextResponse.redirect(getCardAuthUrl(`cards:${await cardStateToken(s.username)}:web`));
}
