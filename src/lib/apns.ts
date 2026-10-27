import { createSign, createPrivateKey } from "node:crypto";
import http2 from "node:http2";
import { getAdminClient } from "@/lib/supabase";

/**
 * APNs 앱 푸시 (1.8.0) — 대화 종류와 무관한 공용 발송 함수.
 * - 키는 env APNS_KEY_P8(.p8 내용)·APNS_KEY_ID·APPLE_TEAM_ID(없으면 앱 팀 K635G7H22M). 키가 없으면 외부 요청 없이 바로 건너뛴다.
 * - 토큰 JWT(ES256)는 서버에서 만들어 50분 동안 다시 쓴다.
 * - Node 내장 http2로 보낸다(production 기기: api.push.apple.com, sandbox 기기: api.sandbox.push.apple.com).
 * - 410 또는 BadDeviceToken·Unregistered면 그 기기 토큰을 지운다.
 * - 알림 문구는 호출하는 쪽이 정한다. 예약 대화는 "새 메시지가 있어요"만(보낸 사람·내용 없음, CEO 10/27).
 */
export const APNS_TOPIC = "org.orbit42.app";
const DEFAULT_TEAM_ID = "K635G7H22M";
const JWT_REUSE_MS = 50 * 60_000;

export type PushEnv = "production" | "sandbox";
export type PushDevice = { token: string; env: PushEnv };
export type PushMessage = {
  body: string;
  /** 같은 id의 알림은 잠금화면에서 하나로 겹친다 (예: booking_id) */
  collapseId?: string;
  /** 앱이 알림을 눌렀을 때 읽는 값 */
  data?: Record<string, string>;
};

export function apnsConfigured(): boolean {
  return !!(process.env.APNS_KEY_P8 && process.env.APNS_KEY_ID);
}

let cachedJwt: { token: string; at: number } | null = null;

function b64url(buf: Buffer | string) {
  return Buffer.from(buf).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function providerToken(now = Date.now()): string {
  if (cachedJwt && now - cachedJwt.at < JWT_REUSE_MS) return cachedJwt.token;
  const keyId = process.env.APNS_KEY_ID!;
  const teamId = process.env.APPLE_TEAM_ID || DEFAULT_TEAM_ID;
  // env에 줄바꿈이 \n 글자로 들어온 경우도 받는다
  const pem = process.env.APNS_KEY_P8!.replace(/\\n/g, "\n");
  const header = b64url(JSON.stringify({ alg: "ES256", kid: keyId }));
  const claims = b64url(JSON.stringify({ iss: teamId, iat: Math.floor(now / 1000) }));
  const signer = createSign("SHA256");
  signer.update(`${header}.${claims}`);
  const sig = signer.sign({ key: createPrivateKey(pem), dsaEncoding: "ieee-p1363" });
  const token = `${header}.${claims}.${b64url(sig)}`;
  cachedJwt = { token, at: now };
  return token;
}

export function apnsPayload(msg: PushMessage) {
  return { aps: { alert: { body: msg.body }, sound: "default" }, ...(msg.data ?? {}) };
}

type SendResult = { token: string; status: number; reason?: string };

function sendOne(client: http2.ClientHttp2Session, jwt: string, device: PushDevice, msg: PushMessage): Promise<SendResult> {
  return new Promise((resolve) => {
    const headers: http2.OutgoingHttpHeaders = {
      ":method": "POST",
      ":path": `/3/device/${device.token}`,
      authorization: `bearer ${jwt}`,
      "apns-topic": APNS_TOPIC,
      "apns-push-type": "alert",
      "apns-priority": "10",
    };
    if (msg.collapseId) headers["apns-collapse-id"] = msg.collapseId.slice(0, 64);
    const req = client.request(headers);
    let status = 0;
    let body = "";
    req.setEncoding("utf8");
    req.on("response", (h) => (status = Number(h[":status"] ?? 0)));
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      let reason: string | undefined;
      try {
        reason = body ? (JSON.parse(body).reason as string) : undefined;
      } catch {}
      resolve({ token: device.token, status, reason });
    });
    req.on("error", (err) => resolve({ token: device.token, status: 0, reason: String(err) }));
    req.setTimeout(10_000, () => {
      req.close();
      resolve({ token: device.token, status: 0, reason: "timeout" });
    });
    req.end(JSON.stringify(apnsPayload(msg)));
  });
}

/** 토큰을 지워야 하는 응답인지 (앱 삭제·잘못된 토큰) */
export function isDeadToken(r: { status: number; reason?: string }) {
  return r.status === 410 || r.reason === "BadDeviceToken" || r.reason === "Unregistered" || r.reason === "DeviceTokenNotForTopic";
}

/**
 * 기기들에 알림을 보낸다. 키가 없으면 외부 요청 없이 "[push] skipped no-key" 한 줄만 남기고 0을 돌려준다.
 * 돌려주는 값: 전달 성공(200) 기기 수.
 */
export async function sendPush(devices: PushDevice[], msg: PushMessage): Promise<number> {
  if (!apnsConfigured()) {
    console.log("[push] skipped no-key");
    return 0;
  }
  if (devices.length === 0) return 0;
  let jwt: string;
  try {
    jwt = providerToken();
  } catch (err) {
    console.error("[push] key", err instanceof Error ? err.message : err);
    return 0;
  }
  const results: SendResult[] = [];
  for (const env of ["production", "sandbox"] as const) {
    const group = devices.filter((d) => d.env === env);
    if (group.length === 0) continue;
    const host = env === "production" ? "https://api.push.apple.com" : "https://api.sandbox.push.apple.com";
    const client = http2.connect(host);
    client.on("error", (err) => console.error("[push] connect", err.message));
    try {
      results.push(...(await Promise.all(group.map((d) => sendOne(client, jwt, d, msg)))));
    } finally {
      client.close();
    }
  }
  const dead = results.filter(isDeadToken).map((r) => r.token);
  if (dead.length) {
    await getAdminClient().from("push_devices").delete().in("token", dead);
  }
  for (const r of results) {
    if (r.status !== 200 && !isDeadToken(r)) console.error("[push] fail", r.status, r.reason);
  }
  return results.filter((r) => r.status === 200).length;
}

/** 이 사용자의 기기 목록 */
export async function devicesOf(userId: string): Promise<PushDevice[]> {
  const { data } = await getAdminClient().from("push_devices").select("token, env").eq("user_id", userId);
  return (data ?? []) as PushDevice[];
}
