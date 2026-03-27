import { google } from "googleapis";
import { getAdminClient } from "@/lib/supabase";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/contacts.readonly",
];

export function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || `${process.env.NEXT_PUBLIC_SITE_URL}/api/google/callback`
  );
}

export function getAuthUrl(state?: string) {
  const client = getOAuth2Client();
  return client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
    state,
  });
}

export async function exchangeCode(code: string) {
  const client = getOAuth2Client();
  const { tokens } = await client.getToken(code);
  return tokens;
}

export async function getGoogleTokens(userId: string) {
  const db = getAdminClient();
  const { data } = await db
    .from("users")
    .select("google_access_token, google_refresh_token, google_token_expiry")
    .eq("id", userId)
    .single();
  return data;
}

export async function saveGoogleTokens(
  userId: string,
  tokens: { access_token?: string | null; refresh_token?: string | null; expiry_date?: number | null }
) {
  const db = getAdminClient();
  await db
    .from("users")
    .update({
      google_access_token: tokens.access_token,
      google_refresh_token: tokens.refresh_token || undefined,
      google_token_expiry: tokens.expiry_date
        ? new Date(tokens.expiry_date).toISOString()
        : undefined,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
}

async function getAuthenticatedClient(userId: string) {
  const tokenData = await getGoogleTokens(userId);
  if (!tokenData?.google_refresh_token) return null;

  const client = getOAuth2Client();
  client.setCredentials({
    access_token: tokenData.google_access_token,
    refresh_token: tokenData.google_refresh_token,
  });

  if (tokenData.google_token_expiry && new Date(tokenData.google_token_expiry) < new Date()) {
    try {
      const { credentials } = await client.refreshAccessToken();
      await saveGoogleTokens(userId, credentials);
      client.setCredentials(credentials);
    } catch {
      // Token revoked or invalid — need re-auth
      return null;
    }
  }

  return client;
}

export async function getAuthenticatedCalendar(userId: string) {
  const client = await getAuthenticatedClient(userId);
  if (!client) return null;
  return google.calendar({ version: "v3", auth: client });
}

export async function getAuthenticatedPeopleApi(userId: string) {
  const client = await getAuthenticatedClient(userId);
  if (!client) return null;
  return google.people({ version: "v1", auth: client });
}
