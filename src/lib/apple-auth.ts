/**
 * Sign in with Apple — server-side identity token verification.
 *
 * The iOS app sends the raw identity token (a JWT signed by Apple). We verify
 * it against Apple's published JWKS with Web Crypto only, so no JWT library
 * is needed. Checks: RS256 signature, issuer, audience (our bundle id), expiry.
 */

const APPLE_ISSUER = "https://appleid.apple.com";
const APPLE_JWKS_URL = "https://appleid.apple.com/auth/keys";
// Audience of native-app tokens is the app's bundle identifier.
const APPLE_BUNDLE_ID = process.env.APPLE_BUNDLE_ID || "org.orbit42.app";

type AppleJwk = {
  kty: string;
  kid: string;
  n: string;
  e: string;
};

type AppleIdentity = {
  sub: string;
  email: string | null;
  emailVerified: boolean;
};

// Apple rotates keys rarely; cache the JWKS for an hour to avoid a fetch per
// login. On a kid miss we refetch once in case a rotation just happened.
let jwksCache: { keys: AppleJwk[]; fetchedAt: number } | null = null;

async function getAppleKeys(forceRefresh = false): Promise<AppleJwk[]> {
  const fresh =
    jwksCache && Date.now() - jwksCache.fetchedAt < 60 * 60_000;
  if (jwksCache && fresh && !forceRefresh) return jwksCache.keys;
  const res = await fetch(APPLE_JWKS_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`Apple JWKS fetch failed: ${res.status}`);
  const body = (await res.json()) as { keys: AppleJwk[] };
  jwksCache = { keys: body.keys ?? [], fetchedAt: Date.now() };
  return jwksCache.keys;
}

function b64urlToBytes(str: string): Uint8Array<ArrayBuffer> {
  const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
  const bin = atob(str.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const bytes = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function decodeSegment<T>(segment: string): T {
  return JSON.parse(new TextDecoder().decode(b64urlToBytes(segment))) as T;
}

/**
 * Verify an Apple identity token. Returns the stable subject id + email
 * claims, or null if the token is invalid for any reason.
 */
export async function verifyAppleIdentityToken(
  identityToken: string,
): Promise<AppleIdentity | null> {
  try {
    const parts = identityToken.split(".");
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, sigB64] = parts;

    const header = decodeSegment<{ alg: string; kid: string }>(headerB64);
    if (header.alg !== "RS256" || !header.kid) return null;

    let jwk = (await getAppleKeys()).find((k) => k.kid === header.kid);
    if (!jwk) {
      jwk = (await getAppleKeys(true)).find((k) => k.kid === header.kid);
    }
    if (!jwk) return null;

    const key = await crypto.subtle.importKey(
      "jwk",
      { kty: jwk.kty, n: jwk.n, e: jwk.e },
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const ok = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      b64urlToBytes(sigB64),
      new TextEncoder().encode(`${headerB64}.${payloadB64}`),
    );
    if (!ok) return null;

    const payload = decodeSegment<{
      iss?: string;
      aud?: string | string[];
      exp?: number;
      sub?: string;
      email?: string;
      email_verified?: boolean | string;
    }>(payloadB64);

    // TEMP: 실기기 이메일 누락 디버깅 — 클레임 구성 확인용 (해결 후 제거)
    console.log("[apple-debug] claims:", JSON.stringify({
      keys: Object.keys(payload),
      hasEmail: payload.email != null,
      emailVerified: payload.email_verified,
      aud: payload.aud,
    }));

    if (payload.iss !== APPLE_ISSUER) return null;
    const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!aud.includes(APPLE_BUNDLE_ID)) return null;
    if (typeof payload.exp !== "number" || payload.exp < Date.now() / 1000) {
      return null;
    }
    if (!payload.sub) return null;

    return {
      sub: payload.sub,
      email: payload.email?.trim().toLowerCase() || null,
      emailVerified:
        payload.email_verified === true || payload.email_verified === "true",
    };
  } catch (err) {
    console.error("verifyAppleIdentityToken", err);
    return null;
  }
}
