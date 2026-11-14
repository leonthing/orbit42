import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySession } from "@/lib/session";
import { getSession } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase";
import { exchangeCode } from "@/lib/google";
import { cardsOpenFor } from "@/lib/cards-access";
import { checkCardScopes, saveCardTokens } from "@/lib/cards-google";
import { logCardsError } from "@/lib/cards-log";

/**
 * 명함용 구글 권한 콜백. 사용자는 state 의 단일목적 토큰(purpose=cards-connect, 10분)으로 정한다.
 * 웹에서 시작했으면 쿠키 세션도 같은 사람이어야 한다(남의 계정에 연결 붙이기 방지).
 * 범위가 모자라면(동의 화면에서 체크 해제) 저장하지 않는다.
 * 회수(revoke)는 하지 않는다 — 같은 앱의 캘린더 권한까지 한 묶음으로 사라지므로.
 */
export async function handleCardsCallback(
  request: NextRequest,
  stateRaw: string,
  code: string | null,
  googleError: string | null,
) {
  const [, token = "", via = "web"] = stateRaw.split(":");
  const app = via === "app";
  const session = await verifySession(token);
  const username = session?.purpose === "cards-connect" ? session.username : null;

  const done = (result: string, reason?: string) => {
    if (app) return NextResponse.redirect(`orbit42://cards-${result}${reason ? `?reason=${reason}` : ""}`);
    const path = username ? `/${username}/cards` : "/login";
    const u = new URL(path, request.url);
    u.searchParams.set(result, reason ?? "1");
    return NextResponse.redirect(u);
  };

  if (!username) return done("error", "invalid_state");
  if (!app) {
    const web = await getSession();
    if (!web || web.username !== username) return NextResponse.redirect(new URL("/login", request.url));
  }
  // 동의 화면에서 취소했거나, Workspace 관리자 설정으로 막힌 경우(admin_policy_enforced 등)
  if (googleError || !code) return done("error", (googleError ?? "no_code").replace(/[^\w]/g, "").slice(0, 40));

  const { data: user } = await getAdminClient().from("users").select("id").eq("username", username).single();
  if (!user || !cardsOpenFor(user.id as string)) return done("error", "not_open");

  try {
    const tokens = await exchangeCode(code);
    const { ok, extra } = checkCardScopes(tokens.scope);
    if (extra.length) console.warn("cards connect: extra scopes", extra.join(" "));
    if (!ok) {
      // 명함 범위가 빠짐 — 저장하지 않음(회수는 안 함: 구글은 같은 앱 권한을 한 묶음으로 회수해 캘린더까지 끊긴다)
      return done("error", "missing_scopes");
    }
    if (!tokens.refresh_token) return done("error", "no_refresh");
    await saveCardTokens(user.id as string, tokens);
    return done("connected");
  } catch (e) {
    logCardsError("callback", e);
    return done("error", "exchange_failed");
  }
}
