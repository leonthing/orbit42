/**
 * Signed session tokens (HMAC-SHA256), Edge-safe.
 *
 * The session cookie was previously a plaintext `JSON.stringify({username})`,
 * which any client could forge to impersonate any account. We now sign the
 * payload with an HMAC so a cookie is only trusted if its signature matches a
 * server-held secret.
 *
 * Uses the Web Crypto API only (no Node `crypto`) so this same module works in
 * both the Edge middleware and the Node server-action runtime.
 *
 * Key material: a dedicated `SESSION_SECRET` if set, otherwise the
 * service-role key that already exists in every environment (so the fix works
 * immediately without a new deploy-time env var). Set `SESSION_SECRET` in
 * production to rotate independently of the Supabase key.
 */

const encoder = new TextEncoder();

function b64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(str: string): Uint8Array<ArrayBuffer> {
  const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
  const bin = atob(str.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const bytes = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function secretMaterial(): string {
  const s = process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s) {
    throw new Error(
      "Missing SESSION_SECRET (or SUPABASE_SERVICE_ROLE_KEY) for session signing",
    );
  }
  return s;
}

async function hmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secretMaterial()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export type SessionData = { username: string };

/** Produce a signed `<payload>.<sig>` token for the given session data. */
export async function signSession(data: SessionData): Promise<string> {
  const payload = b64urlEncode(encoder.encode(JSON.stringify(data)));
  const sig = await crypto.subtle.sign(
    "HMAC",
    await hmacKey(),
    encoder.encode(payload),
  );
  return `${payload}.${b64urlEncode(new Uint8Array(sig))}`;
}

/**
 * Verify a token and return its session data, or null if missing/tampered.
 * `crypto.subtle.verify` compares in constant time, so there is no signature
 * timing oracle.
 */
export async function verifySession(
  token: string | undefined | null,
): Promise<SessionData | null> {
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  try {
    const ok = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(),
      b64urlDecode(sig),
      encoder.encode(payload),
    );
    if (!ok) return null;
    const data = JSON.parse(
      new TextDecoder().decode(b64urlDecode(payload)),
    ) as unknown;
    if (
      data &&
      typeof data === "object" &&
      typeof (data as SessionData).username === "string"
    ) {
      return { username: (data as SessionData).username };
    }
    return null;
  } catch {
    return null;
  }
}
