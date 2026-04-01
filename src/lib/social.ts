import { getAdminClient } from "@/lib/supabase";
import crypto from "crypto";

// ─── X (Twitter) OAuth 2.0 PKCE ───

const X_AUTH_URL = "https://twitter.com/i/oauth2/authorize";
const X_TOKEN_URL = "https://api.twitter.com/2/oauth2/token";
const X_TWEET_URL = "https://api.twitter.com/2/tweets";

export function getXAuthUrl(state: string) {
  const clientId = process.env.X_CLIENT_ID!;
  const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL}/api/x/callback`;

  // Generate PKCE verifier and challenge
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "tweet.read tweet.write users.read offline.access",
    state: `${state}:${verifier}`,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });

  return { url: `${X_AUTH_URL}?${params}`, verifier };
}

export async function exchangeXCode(code: string, verifier: string) {
  const clientId = process.env.X_CLIENT_ID!;
  const clientSecret = process.env.X_CLIENT_SECRET!;
  const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL}/api/x/callback`;

  const res = await fetch(X_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code_verifier: verifier,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`X token exchange failed: ${err}`);
  }

  return res.json();
}

export async function refreshXToken(refreshToken: string) {
  const clientId = process.env.X_CLIENT_ID!;
  const clientSecret = process.env.X_CLIENT_SECRET!;

  const res = await fetch(X_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) return null;
  return res.json();
}

export async function postToX(userId: string, text: string): Promise<{ success: boolean; error?: string; tweetId?: string }> {
  const db = getAdminClient();
  const { data: user } = await db
    .from("users")
    .select("x_access_token, x_refresh_token, x_token_expiry")
    .eq("id", userId)
    .single();

  if (!user?.x_access_token) {
    return { success: false, error: "X 계정이 연결되어 있지 않습니다." };
  }

  let accessToken = user.x_access_token;

  // Refresh if expired
  if (user.x_token_expiry && new Date(user.x_token_expiry) < new Date()) {
    if (!user.x_refresh_token) return { success: false, error: "X 토큰이 만료되었습니다. 다시 연결해주세요." };
    const refreshed = await refreshXToken(user.x_refresh_token);
    if (!refreshed) return { success: false, error: "X 토큰 갱신에 실패했습니다. 다시 연결해주세요." };

    accessToken = refreshed.access_token;
    await db.from("users").update({
      x_access_token: refreshed.access_token,
      x_refresh_token: refreshed.refresh_token || user.x_refresh_token,
      x_token_expiry: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
    }).eq("id", userId);
  }

  const res = await fetch(X_TWEET_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) {
    const err = await res.text();
    return { success: false, error: `포스팅 실패: ${err}` };
  }

  const data = await res.json();
  return { success: true, tweetId: data.data?.id };
}

export async function saveXTokens(
  userId: string,
  tokens: { access_token: string; refresh_token?: string; expires_in?: number },
  xUsername?: string
) {
  const db = getAdminClient();
  await db.from("users").update({
    x_access_token: tokens.access_token,
    x_refresh_token: tokens.refresh_token || undefined,
    x_token_expiry: tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : undefined,
    x_username: xUsername || undefined,
    updated_at: new Date().toISOString(),
  }).eq("id", userId);
}

// ─── Facebook OAuth ───

const FB_AUTH_URL = "https://www.facebook.com/v21.0/dialog/oauth";
const FB_TOKEN_URL = "https://graph.facebook.com/v21.0/oauth/access_token";
const FB_GRAPH_URL = "https://graph.facebook.com/v21.0";

export function getFacebookAuthUrl(state: string) {
  const clientId = process.env.FACEBOOK_APP_ID!;
  const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL}/api/facebook/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "pages_manage_posts,pages_read_engagement",
    state,
    response_type: "code",
  });

  return `${FB_AUTH_URL}?${params}`;
}

export async function exchangeFacebookCode(code: string) {
  const clientId = process.env.FACEBOOK_APP_ID!;
  const clientSecret = process.env.FACEBOOK_APP_SECRET!;
  const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL}/api/facebook/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code,
  });

  const res = await fetch(`${FB_TOKEN_URL}?${params}`);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Facebook token exchange failed: ${err}`);
  }

  return res.json();
}

export async function getFacebookPages(userAccessToken: string) {
  const res = await fetch(`${FB_GRAPH_URL}/me/accounts?access_token=${userAccessToken}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.data as { id: string; name: string; access_token: string }[];
}

export async function postToFacebook(userId: string, message: string, link?: string): Promise<{ success: boolean; error?: string; postId?: string }> {
  const db = getAdminClient();
  const { data: user } = await db
    .from("users")
    .select("fb_page_id, fb_page_token")
    .eq("id", userId)
    .single();

  if (!user?.fb_page_token || !user?.fb_page_id) {
    return { success: false, error: "Facebook 페이지가 연결되어 있지 않습니다." };
  }

  const body: Record<string, string> = { message, access_token: user.fb_page_token };
  if (link) body.link = link;

  const res = await fetch(`${FB_GRAPH_URL}/${user.fb_page_id}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    return { success: false, error: `포스팅 실패: ${err}` };
  }

  const data = await res.json();
  return { success: true, postId: data.id };
}

export async function saveFacebookTokens(
  userId: string,
  pageId: string,
  pageToken: string,
  userName?: string
) {
  const db = getAdminClient();
  await db.from("users").update({
    fb_page_id: pageId,
    fb_page_token: pageToken,
    fb_user_name: userName || undefined,
    updated_at: new Date().toISOString(),
  }).eq("id", userId);
}

// ─── LinkedIn OAuth 2.0 ───

const LI_AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization";
const LI_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const LI_API_URL = "https://api.linkedin.com/v2";


export function getLinkedInAuthUrl(state: string) {
  const clientId = process.env.LINKEDIN_CLIENT_ID!;
  const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL}/api/linkedin/callback`;

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "openid profile w_member_social",
    state,
  });

  return `${LI_AUTH_URL}?${params}`;
}

export async function exchangeLinkedInCode(code: string) {
  const clientId = process.env.LINKEDIN_CLIENT_ID!;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET!;
  const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL}/api/linkedin/callback`;

  const res = await fetch(LI_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LinkedIn token exchange failed: ${err}`);
  }

  return res.json();
}

export async function getLinkedInProfile(accessToken: string) {
  const res = await fetch(`${LI_API_URL}/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  return res.json() as Promise<{ sub: string; name: string }>;
}

export async function postToLinkedIn(
  userId: string,
  text: string,
  articleUrl?: string
): Promise<{ success: boolean; error?: string; postId?: string }> {
  const db = getAdminClient();
  const { data: user } = await db
    .from("users")
    .select("linkedin_access_token, linkedin_sub, linkedin_token_expiry")
    .eq("id", userId)
    .single();

  if (!user?.linkedin_access_token || !user?.linkedin_sub) {
    return { success: false, error: "LinkedIn 계정이 연결되어 있지 않습니다." };
  }

  const accessToken = user.linkedin_access_token;
  const authorUrn = `urn:li:person:${user.linkedin_sub}`;

  const body: Record<string, unknown> = {
    author: authorUrn,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text },
        shareMediaCategory: articleUrl ? "ARTICLE" : "NONE",
        ...(articleUrl
          ? {
              media: [
                {
                  status: "READY",
                  originalUrl: articleUrl,
                },
              ],
            }
          : {}),
      },
    },
    visibility: {
      "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
    },
  };

  const res = await fetch(`${LI_API_URL}/ugcPosts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    return { success: false, error: `포스팅 실패: ${err}` };
  }

  const postId = res.headers.get("x-restli-id") || "";
  return { success: true, postId };
}

export async function saveLinkedInTokens(
  userId: string,
  tokens: { access_token: string; refresh_token?: string; expires_in?: number },
  profile?: { sub: string; name: string }
) {
  const db = getAdminClient();
  await db.from("users").update({
    linkedin_access_token: tokens.access_token,
    linkedin_refresh_token: tokens.refresh_token || undefined,
    linkedin_token_expiry: tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : undefined,
    linkedin_sub: profile?.sub || undefined,
    linkedin_name: profile?.name || undefined,
    updated_at: new Date().toISOString(),
  }).eq("id", userId);
}

// ─── Social connection status ───

export async function getSocialStatus(userId: string) {
  const db = getAdminClient();
  const { data } = await db
    .from("users")
    .select("x_access_token, x_username, fb_page_id, fb_user_name, linkedin_access_token, linkedin_name")
    .eq("id", userId)
    .single();

  return {
    x: { connected: !!data?.x_access_token, username: data?.x_username || null },
    facebook: { connected: !!data?.fb_page_id, name: data?.fb_user_name || null },
    linkedin: { connected: !!data?.linkedin_access_token, name: data?.linkedin_name || null },
  };
}
