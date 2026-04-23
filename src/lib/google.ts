import { google } from "googleapis";
import { getAdminClient } from "@/lib/supabase";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/contacts.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
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

/**
 * OAuth URL for the landing-page "Continue with Google" flow.
 * Reuses the primary /api/google/callback redirect URI (already
 * registered in Google Cloud) so no console changes are needed.
 */
export function getSignInUrl(state?: string) {
  const client = getOAuth2Client();
  return client.generateAuthUrl({
    access_type: "online",
    scope: [
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
    ],
    prompt: "select_account",
    state,
  });
}

/** Fetch { email, name } for the sign-in flow. */
export async function fetchGoogleProfile(tokens: {
  access_token?: string | null;
}): Promise<{ email: string | null; name: string | null }> {
  try {
    const client = getOAuth2Client();
    client.setCredentials({
      access_token: tokens.access_token ?? undefined,
    });
    const oauth2 = google.oauth2({ version: "v2", auth: client });
    const res = await oauth2.userinfo.get();
    return {
      email: (res.data.email as string | null) ?? null,
      name: (res.data.name as string | null) ?? null,
    };
  } catch {
    return { email: null, name: null };
  }
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

  await syncGoogleCalendarsToDb(userId).catch((err) =>
    console.error("syncGoogleCalendarsToDb", err),
  );
}

/**
 * Upsert a `calendars` row for each Google calendar the user owns so
 * they show up in the Settings / picker alongside native ones. Skips
 * calendars already linked.
 */
export async function syncGoogleCalendarsToDb(userId: string) {
  const calendar = await getAuthenticatedCalendar(userId);
  if (!calendar) return;
  let items: Array<{
    id?: string | null;
    summary?: string | null;
    backgroundColor?: string | null;
    accessRole?: string | null;
    primary?: boolean | null;
  }> = [];
  try {
    const res = await calendar.calendarList.list();
    items = (res.data.items ?? []) as typeof items;
  } catch {
    return;
  }
  // Only import the user's PRIMARY Google calendar. Secondary ones
  // (project-specific, subscribed team/holiday feeds etc.) should be
  // opted into manually so random shared calendars don't leak in.
  const owned = items.filter((i) => !!i.id && i.primary === true);
  if (owned.length === 0) return;

  const db = getAdminClient();
  const { data: existingRows } = await db
    .from("calendars")
    .select("google_calendar_id")
    .eq("user_id", userId)
    .eq("source", "google");
  const existing = new Set(
    ((existingRows ?? []) as { google_calendar_id: string | null }[])
      .map((r) => r.google_calendar_id)
      .filter(Boolean) as string[],
  );
  const rows = owned
    .filter((i) => !existing.has(i.id as string))
    .map((i) => ({
      user_id: userId,
      name: i.summary || "Google calendar",
      purpose: "personal" as const,
      color: i.backgroundColor || "#4285f4",
      visibility: "private" as const,
      source: "google" as const,
      google_calendar_id: i.id as string,
    }));
  if (rows.length === 0) return;
  await db.from("calendars").insert(rows);
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

// ---------- Multi-account support ----------

export type ExtraGoogleAccount = {
  id: string;
  user_id: string;
  email: string | null;
  access_token: string | null;
  refresh_token: string;
  token_expiry: string | null;
};

export async function listExtraGoogleAccounts(userId: string): Promise<ExtraGoogleAccount[]> {
  const db = getAdminClient();
  const { data } = await db
    .from("google_accounts")
    .select("id, user_id, email, access_token, refresh_token, token_expiry")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  return (data ?? []) as ExtraGoogleAccount[];
}

export async function saveExtraGoogleAccount(
  userId: string,
  tokens: { access_token?: string | null; refresh_token?: string | null; expiry_date?: number | null },
  email: string | null,
) {
  if (!tokens.refresh_token) return null;
  const db = getAdminClient();
  const { data } = await db
    .from("google_accounts")
    .insert({
      user_id: userId,
      email,
      access_token: tokens.access_token ?? null,
      refresh_token: tokens.refresh_token,
      token_expiry: tokens.expiry_date
        ? new Date(tokens.expiry_date).toISOString()
        : null,
    })
    .select("id")
    .single();
  return data?.id ?? null;
}

export async function deleteExtraGoogleAccount(accountId: string, userId: string) {
  const db = getAdminClient();
  await db.from("google_accounts").delete().eq("id", accountId).eq("user_id", userId);
}

async function clientForExtraAccount(account: ExtraGoogleAccount) {
  const client = getOAuth2Client();
  client.setCredentials({
    access_token: account.access_token ?? undefined,
    refresh_token: account.refresh_token,
  });
  if (account.token_expiry && new Date(account.token_expiry) < new Date()) {
    try {
      const { credentials } = await client.refreshAccessToken();
      const db = getAdminClient();
      await db
        .from("google_accounts")
        .update({
          access_token: credentials.access_token ?? null,
          token_expiry: credentials.expiry_date
            ? new Date(credentials.expiry_date).toISOString()
            : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", account.id);
      client.setCredentials(credentials);
    } catch {
      return null;
    }
  }
  return client;
}

export async function getCalendarForExtraAccount(account: ExtraGoogleAccount) {
  const client = await clientForExtraAccount(account);
  if (!client) return null;
  return google.calendar({ version: "v3", auth: client });
}

/** Fetch the logged-in email for a freshly issued token set. */
export async function fetchGoogleEmail(tokens: {
  access_token?: string | null;
  refresh_token?: string | null;
}): Promise<string | null> {
  try {
    const client = getOAuth2Client();
    client.setCredentials({
      access_token: tokens.access_token ?? undefined,
      refresh_token: tokens.refresh_token ?? undefined,
    });
    const oauth2 = google.oauth2({ version: "v2", auth: client });
    const res = await oauth2.userinfo.get();
    return (res.data.email as string | null) ?? null;
  } catch {
    return null;
  }
}

