import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { getAdminClient } from "@/lib/supabase";

/**
 * 구글 토큰 저장소 — DB 에 토큰을 평문으로 두지 않는다(PO 11/16, 백로그 5번).
 *
 * 토큰 칸(users.google_access_token·google_refresh_token, google_accounts.access_token·refresh_token,
 * card_google_tokens.access_token·refresh_token)은 이 파일만 읽고 쓴다. 다른 곳은 아래 함수를 부른다.
 *
 * 저장 형식: "v1:<iv>.<tag>.<암호문>"(base64url, AES-256-GCM). 키 = env GOOGLE_TOKEN_KEY(32바이트 base64).
 * 추가 인증 데이터(AAD) = "표:칸:user_id" — 다른 사람·다른 칸으로 옮겨 붙인 값은 풀리지 않는다.
 * 키 바꾸기: 새 키를 GOOGLE_TOKEN_KEY_V2 로 두고 GOOGLE_TOKEN_KEY_VERSION=v2 → 새로 쓰는 값만 v2,
 * 옛 v1 값은 GOOGLE_TOKEN_KEY 로 계속 풀린다(convertAllGoogleTokens 로 일괄 재암호화).
 *
 * 전환기: 읽을 때 평문·암호문 둘 다 받는다. 쓸 때는 키가 있으면 암호문만.
 * 키가 없으면(로컬·운영 env 추가 전) 예전처럼 평문으로 쓴다 — 키 없는 서버도 그대로 돈다.
 */

type Table = "users" | "google_accounts" | "card_google_tokens";
type Field = "access" | "refresh";

const PREFIX = /^(v\d+):([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]*)$/;

export class GoogleTokenDecryptError extends Error {}

function keyFor(version: string): Buffer | null {
  const raw = version === "v1" ? process.env.GOOGLE_TOKEN_KEY : process.env[`GOOGLE_TOKEN_KEY_${version.toUpperCase()}`];
  if (!raw) return null;
  const key = Buffer.from(raw.trim(), "base64");
  if (key.length !== 32) throw new Error(`GOOGLE_TOKEN_KEY(${version}) 는 32바이트 base64 여야 해요`);
  return key;
}

function writeVersion(): string {
  return (process.env.GOOGLE_TOKEN_KEY_VERSION || "v1").trim();
}

/** 암호화 키가 있어 새로 쓰는 값이 암호문이 되는지 */
export function googleTokenEncryptionOn(): boolean {
  return keyFor(writeVersion()) !== null;
}

export function isSealed(value: string | null | undefined): boolean {
  return typeof value === "string" && PREFIX.test(value);
}

function aad(table: Table, field: Field, userId: string) {
  return Buffer.from(`orbit42:${table}:${field}:${userId}`, "utf8");
}

/** 평문 → 저장값. 키가 없으면 평문 그대로(전환기), 이미 암호문이면 그대로. */
export function sealToken(value: string, table: Table, field: Field, userId: string): string {
  if (isSealed(value)) return value;
  const version = writeVersion();
  const key = keyFor(version);
  if (!key) return value;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(aad(table, field, userId));
  const ct = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${version}:${iv.toString("base64url")}.${tag.toString("base64url")}.${ct.toString("base64url")}`;
}

/** 저장값 → 평문. 평문 행은 그대로 돌려준다. 키가 없거나 변조됐으면 GoogleTokenDecryptError. */
export function openToken(stored: string, table: Table, field: Field, userId: string): string {
  const m = PREFIX.exec(stored);
  if (!m) return stored; // 예전 평문 행
  const [, version, ivB, tagB, ctB] = m;
  const key = keyFor(version);
  if (!key) throw new GoogleTokenDecryptError(`no key for ${version}`);
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB, "base64url"));
    decipher.setAAD(aad(table, field, userId));
    decipher.setAuthTag(Buffer.from(tagB, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(ctB, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    throw new GoogleTokenDecryptError("google token decrypt failed");
  }
}

function seal(v: string | null | undefined, table: Table, field: Field, userId: string) {
  return v ? sealToken(v, table, field, userId) : v;
}

/** 읽기: 풀 수 없으면 '연결 없음'(null) 으로 — 토큰 값은 로그에 남기지 않는다 */
function open(v: string | null | undefined, table: Table, field: Field, userId: string): string | null {
  if (!v) return null;
  try {
    return openToken(v, table, field, userId);
  } catch (e) {
    console.error("google token unreadable", { table, field, reason: (e as Error).message });
    return null;
  }
}

type TokenSet = { access_token?: string | null; refresh_token?: string | null; expiry_date?: number | null };

// ───────── 기본 구글 계정(users.google_*) ─────────

export type PrimaryGoogleTokens = {
  google_access_token: string | null;
  google_refresh_token: string | null;
  google_token_expiry: string | null;
};

export async function readPrimaryGoogleTokens(userId: string): Promise<PrimaryGoogleTokens | null> {
  // abortSignal 을 붙이면 Next 서버 컴포넌트의 요청 메모이제이션에서 빠진다 —
  // 같은 렌더 안에서 갱신 후 다시 읽을 때 처음(만료된) 값을 돌려받아 refresh 가
  // 300초 동안 반복되던 문제(버그-5)
  const { data } = await getAdminClient()
    .from("users")
    .select("google_access_token, google_refresh_token, google_token_expiry")
    .eq("id", userId)
    .abortSignal(new AbortController().signal)
    .single();
  if (!data) return null;
  return {
    google_access_token: open(data.google_access_token, "users", "access", userId),
    google_refresh_token: open(data.google_refresh_token, "users", "refresh", userId),
    google_token_expiry: data.google_token_expiry ?? null,
  };
}

/** 저장 — access_token 이 undefined 면 그 칸은 그대로, refresh 는 값이 있을 때만 바꾼다(예전 동작 그대로) */
export async function writePrimaryGoogleTokens(userId: string, tokens: TokenSet) {
  await getAdminClient()
    .from("users")
    .update({
      google_access_token: tokens.access_token === undefined ? undefined : seal(tokens.access_token, "users", "access", userId),
      google_refresh_token: tokens.refresh_token ? sealToken(tokens.refresh_token, "users", "refresh", userId) : undefined,
      google_token_expiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : undefined,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
}

export async function clearPrimaryGoogleTokens(userId: string) {
  await getAdminClient()
    .from("users")
    .update({ google_access_token: null, google_refresh_token: null, google_token_expiry: null, updated_at: new Date().toISOString() })
    .eq("id", userId);
}

/** 연결 여부만(값은 풀지 않는다) */
export async function primaryGoogleConnected(userId: string): Promise<boolean> {
  const { data } = await getAdminClient().from("users").select("google_refresh_token").eq("id", userId).maybeSingle();
  return !!data?.google_refresh_token;
}

/** 지표용: 기본 구글 계정이 연결된 회원 id 전부 */
export async function usersWithPrimaryGoogle(): Promise<Set<string>> {
  const out = new Set<string>();
  const db = getAdminClient();
  for (let from = 0; ; from += 1000) {
    const { data } = await db.from("users").select("id").not("google_refresh_token", "is", null).range(from, from + 999);
    for (const r of data ?? []) out.add(r.id as string);
    if (!data || data.length < 1000) break;
  }
  return out;
}

// ───────── 추가 구글 계정(google_accounts) ─────────

export type ExtraGoogleAccount = {
  id: string;
  user_id: string;
  email: string | null;
  access_token: string | null;
  refresh_token: string;
  token_expiry: string | null;
};

export async function readExtraGoogleAccounts(userId: string): Promise<ExtraGoogleAccount[]> {
  const { data } = await getAdminClient()
    .from("google_accounts")
    .select("id, user_id, email, access_token, refresh_token, token_expiry")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  const out: ExtraGoogleAccount[] = [];
  for (const r of (data ?? []) as ExtraGoogleAccount[]) {
    const refresh = open(r.refresh_token, "google_accounts", "refresh", r.user_id);
    // 풀 수 없는 행은 연결 없는 것으로 친다(목록·동기화에서 빠짐). 행은 지우지 않는다.
    if (!refresh) continue;
    out.push({ ...r, refresh_token: refresh, access_token: open(r.access_token, "google_accounts", "access", r.user_id) });
  }
  return out;
}

export async function insertExtraGoogleAccount(userId: string, tokens: TokenSet, email: string | null): Promise<string | null> {
  if (!tokens.refresh_token) return null;
  const { data } = await getAdminClient()
    .from("google_accounts")
    .insert({
      user_id: userId,
      email,
      access_token: seal(tokens.access_token ?? null, "google_accounts", "access", userId),
      refresh_token: sealToken(tokens.refresh_token, "google_accounts", "refresh", userId),
      token_expiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
    })
    .select("id")
    .single();
  return data?.id ?? null;
}

/** 갱신 뒤 — access_token·만료만 바꾼다 */
export async function writeExtraGoogleAccess(account: { id: string; user_id: string }, tokens: TokenSet) {
  await getAdminClient()
    .from("google_accounts")
    .update({
      access_token: seal(tokens.access_token ?? null, "google_accounts", "access", account.user_id),
      token_expiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", account.id);
}

/** 회수용 refresh 토큰(내 계정의 그 행만) */
export async function readExtraGoogleRefresh(accountId: string, userId: string): Promise<string | null> {
  const { data } = await getAdminClient()
    .from("google_accounts")
    .select("refresh_token")
    .eq("id", accountId)
    .eq("user_id", userId)
    .maybeSingle();
  return open((data as { refresh_token: string | null } | null)?.refresh_token, "google_accounts", "refresh", userId);
}

// ───────── 명함(card_google_tokens) ─────────

export type CardTokenRow = {
  access_token: string | null;
  refresh_token: string | null;
  token_expiry: string | null;
  drive_folder_id: string | null;
  card_group_resource: string | null;
};

export async function readCardGoogleTokens(userId: string): Promise<CardTokenRow | null> {
  const { data } = await getAdminClient()
    .from("card_google_tokens")
    .select("access_token, refresh_token, token_expiry, drive_folder_id, card_group_resource")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return null;
  return {
    ...(data as CardTokenRow),
    access_token: open(data.access_token, "card_google_tokens", "access", userId),
    refresh_token: open(data.refresh_token, "card_google_tokens", "refresh", userId),
  };
}

export async function readCardGoogleRefresh(userId: string): Promise<string | null> {
  const { data } = await getAdminClient().from("card_google_tokens").select("refresh_token").eq("user_id", userId).maybeSingle();
  return open(data?.refresh_token, "card_google_tokens", "refresh", userId);
}

/** 연결 직후 저장(행 전체). extra 는 토큰이 아닌 칸(email·scope·폴더 등) */
export async function upsertCardGoogleTokens(
  userId: string,
  tokens: TokenSet & { refresh_token: string },
  extra: Record<string, unknown>,
) {
  const { error } = await getAdminClient()
    .from("card_google_tokens")
    .upsert(
      {
        ...extra,
        user_id: userId,
        access_token: seal(tokens.access_token ?? null, "card_google_tokens", "access", userId),
        refresh_token: sealToken(tokens.refresh_token, "card_google_tokens", "refresh", userId),
        token_expiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
      },
      { onConflict: "user_id" },
    );
  return { error };
}

/** googleapis 'tokens' 이벤트(자동 갱신) 뒤 */
export async function writeCardGoogleTokens(userId: string, t: TokenSet) {
  return getAdminClient()
    .from("card_google_tokens")
    .update({
      access_token: t.access_token === undefined ? undefined : seal(t.access_token, "card_google_tokens", "access", userId),
      token_expiry: t.expiry_date ? new Date(t.expiry_date).toISOString() : undefined,
      ...(t.refresh_token ? { refresh_token: sealToken(t.refresh_token, "card_google_tokens", "refresh", userId) } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
}

// ───────── 일괄 변환(scripts/google-tokens-convert.ts) ─────────

type Mode = "seal" | "open";
type Plan = { table: Table; key: "id" | "user_id"; owner: "id" | "user_id"; cols: { col: string; field: Field }[] };

const PLANS: Plan[] = [
  { table: "users", key: "id", owner: "id", cols: [{ col: "google_access_token", field: "access" }, { col: "google_refresh_token", field: "refresh" }] },
  { table: "google_accounts", key: "id", owner: "user_id", cols: [{ col: "access_token", field: "access" }, { col: "refresh_token", field: "refresh" }] },
  { table: "card_google_tokens", key: "user_id", owner: "user_id", cols: [{ col: "access_token", field: "access" }, { col: "refresh_token", field: "refresh" }] },
];

export type ConvertReport = Record<Table, { rows: number; plain: number; sealed: number; sealedOtherVersion: number; changed: number; skipped: number; failed: number }>;

/**
 * mode "seal": 평문(또는 다른 키 버전) 값을 지금 키로 암호화. mode "open": 암호문을 평문으로(롤백).
 * apply=false 면 세기만 한다. 바꿀 때는 '읽은 값 그대로일 때만' 바꿔서(동시 갱신과 겹치면 건너뜀) 새 토큰을 덮어쓰지 않는다.
 */
export async function convertAllGoogleTokens(mode: Mode, apply: boolean): Promise<ConvertReport> {
  if (mode === "seal" && !googleTokenEncryptionOn()) throw new Error("GOOGLE_TOKEN_KEY 가 없어요");
  const db = getAdminClient();
  const current = writeVersion();
  const report = {} as ConvertReport;
  for (const p of PLANS) {
    const r = { rows: 0, plain: 0, sealed: 0, sealedOtherVersion: 0, changed: 0, skipped: 0, failed: 0 };
    report[p.table] = r;
    const select = Array.from(new Set([p.key, p.owner, ...p.cols.map((c) => c.col)])).join(", ");
    const rows: Record<string, string | null>[] = [];
    for (let from = 0; ; from += 1000) {
      let q = db.from(p.table).select(select);
      if (p.table === "users") q = q.or("google_access_token.not.is.null,google_refresh_token.not.is.null");
      const { data, error } = await q.order(p.key).range(from, from + 999);
      if (error) throw error;
      rows.push(...((data ?? []) as unknown as Record<string, string | null>[]));
      if (!data || data.length < 1000) break;
    }
    for (const row of rows) {
      r.rows++;
      const owner = row[p.owner] as string;
      const patch: Record<string, string> = {};
      for (const c of p.cols) {
        const v = row[c.col];
        if (!v) continue;
        const sealed = isSealed(v);
        if (sealed) {
          r.sealed++;
          if (!v.startsWith(current + ":")) r.sealedOtherVersion++;
        } else r.plain++;
        try {
          if (mode === "seal" && (!sealed || !v.startsWith(current + ":"))) {
            const plain = openToken(v, p.table, c.field, owner);
            patch[c.col] = sealToken(plain, p.table, c.field, owner);
            // 되돌려 풀어 보고 같을 때만 쓴다
            if (openToken(patch[c.col], p.table, c.field, owner) !== plain) throw new Error("roundtrip");
          } else if (mode === "open" && sealed) {
            patch[c.col] = openToken(v, p.table, c.field, owner);
          }
        } catch {
          r.failed++;
          delete patch[c.col];
        }
      }
      if (Object.keys(patch).length === 0) continue;
      if (!apply) { r.changed++; continue; }
      let q = db.from(p.table).update(patch).eq(p.key, row[p.key] as string);
      for (const col of Object.keys(patch)) q = q.eq(col, row[col] as string);
      const { data, error } = await q.select(p.key);
      if (error) { r.failed++; continue; }
      if (!data || data.length === 0) r.skipped++; // 그 사이 갱신됨 — 다음 쓰기에서 암호문이 된다
      else r.changed++;
    }
  }
  return report;
}
