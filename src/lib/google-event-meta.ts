/**
 * 구글 일정의 Orbit42 부가정보 — 이동시간·지도 좌표·기념일 기준일.
 * Orbit42 쪽(event_annotations)에만 둔다. 구글 캘린더에는 쓰지 않는다(설명·메모·extendedProperties 포함, Leo 11/10).
 * Orbit42 일정은 events 칸(travel_min·location_lat·location_lng·is_anniversary)을 그대로 쓴다.
 *
 * 예전에는 구글 extendedProperties.private 에 orbit42TravelMin·orbit42Lat·orbit42Lng·orbit42Anniversary 를 썼다.
 * - 읽기: google_meta_at 이 있는 Orbit42 기록이 우선. 없으면 구글에 남은 예전 값을 읽기만 한다.
 * - Orbit42 가 그 일정을 다음에 고칠 때(applyGoogleEdit): 예전 값을 Orbit42 로 옮겨 담고 구글의 orbit42* 를 지운다
 *   (이 정리 쓰기만 예외). 한꺼번에 지우는 일괄 작업은 하지 않는다.
 * 반복 회차 키(gcal_<master>_<날짜>)에 기록이 없으면 시리즈 키(gcal_<master>)를 본다 — 기념일은 시리즈 키에만 둔다.
 */
import type { calendar_v3 } from "googleapis";
import { getAdminClient } from "@/lib/supabase";
import { toEventKey } from "@/lib/event-key";

export const TRAVEL_MAX_MIN = 480;

export type GoogleMeta = {
  travelMin: number | null;
  lat: number | null;
  lng: number | null;
  /** 기념일 기준일(YYYY-MM-DD) — 시리즈에만 */
  anniversaryStart: string | null;
};

const EMPTY: GoogleMeta = { travelMin: null, lat: null, lng: null, anniversaryStart: null };
const LEGACY_KEYS = ["orbit42TravelMin", "orbit42Lat", "orbit42Lng", "orbit42Anniversary"];

export function normalizeTravel(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.round(n), TRAVEL_MAX_MIN) : null;
}

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** 구글 일정에 남은 예전 orbit42* 값 */
export function legacyMeta(item: { extendedProperties?: calendar_v3.Schema$Event["extendedProperties"] } | null | undefined): GoogleMeta {
  const p = item?.extendedProperties?.private ?? {};
  const lat = num(p.orbit42Lat);
  const lng = num(p.orbit42Lng);
  return {
    travelMin: normalizeTravel(p.orbit42TravelMin),
    lat: lat != null && lng != null ? lat : null,
    lng: lat != null && lng != null ? lng : null,
    anniversaryStart: /^\d{4}-\d{2}-\d{2}$/.test(p.orbit42Anniversary ?? "") ? (p.orbit42Anniversary as string) : null,
  };
}

/** 구글 일정의 extendedProperties.private 에 있는 orbit42* 키 → 지우기용 patch(null). 없으면 null */
export function legacyClearPatch(item: { extendedProperties?: calendar_v3.Schema$Event["extendedProperties"] } | null | undefined): Record<string, null> | null {
  const p = item?.extendedProperties?.private ?? {};
  const keys = Object.keys(p).filter((k) => k.startsWith("orbit42") || LEGACY_KEYS.includes(k));
  if (keys.length === 0) return null;
  return Object.fromEntries(keys.map((k) => [k, null]));
}

/** 구글 일정 키 → 시리즈 키 (회차가 아니면 null) */
export function googleMasterKey(key: string): string | null {
  const m = /^(gcal_[^_]+)_\d{8}(T\d{6}Z)?$/.exec(key);
  return m ? m[1] : null;
}

function rowToMeta(r: Record<string, unknown>): GoogleMeta {
  return {
    travelMin: normalizeTravel(r.travel_min),
    lat: num(r.location_lat),
    lng: num(r.location_lng),
    anniversaryStart: (r.anniversary_start as string | null) ?? null,
  };
}

/** 구글 일정 키들의 Orbit42 기록(google_meta_at 있는 것만) — 회차의 시리즈 키도 함께 읽는다 */
export async function getGoogleMeta(userId: string, eventIds: string[]): Promise<Map<string, GoogleMeta>> {
  const out = new Map<string, GoogleMeta>();
  const keys = new Set<string>();
  for (const id of eventIds) {
    const k = toEventKey(id);
    if (!k.startsWith("gcal_")) continue;
    keys.add(k);
    const master = googleMasterKey(k);
    if (master) keys.add(master);
  }
  if (keys.size === 0) return out;
  const db = getAdminClient();
  const list = Array.from(keys);
  for (let i = 0; i < list.length; i += 300) {
    const { data, error } = await db
      .from("event_annotations")
      .select("event_key, travel_min, location_lat, location_lng, anniversary_start")
      .eq("user_id", userId)
      .in("event_key", list.slice(i, i + 300))
      .not("google_meta_at", "is", null);
    if (error) {
      console.error("getGoogleMeta", error);
      return out;
    }
    for (const r of data ?? []) out.set(r.event_key as string, rowToMeta(r));
  }
  return out;
}

/** 일정 하나의 부가정보 — 자기 기록 → 시리즈 기록 → 구글에 남은 예전 값 */
export function resolveGoogleMeta(records: Map<string, GoogleMeta>, eventId: string, legacy: GoogleMeta | null): GoogleMeta {
  const k = toEventKey(eventId);
  const own = records.get(k);
  if (own) return own;
  const master = googleMasterKey(k);
  const m = master ? records.get(master) : undefined;
  if (m) return m;
  return legacy ?? EMPTY;
}

export type GoogleMetaPatch = Partial<GoogleMeta>;

export function metaPatchFrom(input: {
  travel_min?: number | null;
  location_lat?: number | null;
  location_lng?: number | null;
}): GoogleMetaPatch {
  const patch: GoogleMetaPatch = {};
  if (input.travel_min !== undefined) patch.travelMin = normalizeTravel(input.travel_min);
  if (input.location_lat !== undefined || input.location_lng !== undefined) {
    const ok = input.location_lat != null && input.location_lng != null;
    patch.lat = ok ? (input.location_lat as number) : null;
    patch.lng = ok ? (input.location_lng as number) : null;
  }
  return patch;
}

/**
 * Orbit42 기록을 쓴다 — 지금 보이는 값(자기·시리즈 기록, 없으면 legacy)에 patch 를 얹어 통째로 저장하고
 * google_meta_at 을 찍어 그 뒤로는 구글 예전 값을 보지 않게 한다.
 */
export async function setGoogleMeta(userId: string, eventId: string, patch: GoogleMetaPatch, legacy: GoogleMeta | null = null) {
  const key = toEventKey(eventId);
  const records = await getGoogleMeta(userId, [key]);
  const current = resolveGoogleMeta(records, key, legacy);
  const merged: GoogleMeta = { ...current, ...patch };
  const db = getAdminClient();
  const { error } = await db.from("event_annotations").upsert(
    {
      user_id: userId,
      event_key: key,
      travel_min: merged.travelMin,
      location_lat: merged.lat,
      location_lng: merged.lng,
      anniversary_start: merged.anniversaryStart,
      google_meta_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,event_key" },
  );
  if (error) {
    console.error("setGoogleMeta", error);
    throw new Error("일정 정보를 저장하지 못했어요.");
  }
}

function isEmptyPatch(p: GoogleMetaPatch) {
  return Object.keys(p).length === 0;
}

/**
 * Orbit42 에서 구글 일정 하나를 고칠 때의 공통 경로.
 * - 구글 일정을 한 번 읽어 예전 orbit42* 값을 본다
 * - 부가정보 patch 가 있거나 예전 값이 남아 있으면 Orbit42 기록으로 옮겨 담는다(구글에는 안 씀)
 * - 구글 쪽은 body(제목·시간 등)와 함께 예전 orbit42* 키를 지운다 — 보낼 것이 없으면 구글을 건드리지 않는다
 */
export async function applyGoogleEdit(args: {
  userId: string;
  client: calendar_v3.Calendar;
  gcalId: string;
  googleEventId: string;
  /** Orbit42 키 — 보통 gcal_<googleEventId> */
  eventKey?: string;
  body: calendar_v3.Schema$Event;
  meta: GoogleMetaPatch;
  sendUpdates?: "all";
}) {
  const { userId, client, gcalId, googleEventId, body, meta } = args;
  const key = args.eventKey ?? `gcal_${googleEventId}`;
  let item: calendar_v3.Schema$Event | null = null;
  try {
    item = (await client.events.get({ calendarId: gcalId, eventId: googleEventId })).data;
  } catch {
    item = null;
  }
  const legacy = legacyMeta(item);
  const clear = legacyClearPatch(item);
  if (!isEmptyPatch(meta) || clear) {
    await setGoogleMeta(userId, key, meta, clear ? legacy : null);
  }
  const requestBody: calendar_v3.Schema$Event = { ...body };
  if (clear) {
    requestBody.extendedProperties = { private: clear as unknown as Record<string, string> };
  }
  if (Object.keys(requestBody).length > 0) {
    await client.events.patch({
      calendarId: gcalId,
      eventId: googleEventId,
      requestBody,
      ...(args.sendUpdates ? { sendUpdates: args.sendUpdates } : {}),
    });
  }
}

/** 일정을 지울 때 — 그 키들의 부가정보 기록을 비운다(중요도·별점 등 다른 칸은 그대로) */
export async function clearGoogleMetaForKeys(userId: string, keys: string[]) {
  const list = Array.from(new Set(keys.map(toEventKey)));
  if (list.length === 0) return;
  const db = getAdminClient();
  for (let i = 0; i < list.length; i += 300) {
    const { error } = await db
      .from("event_annotations")
      .update({ travel_min: null, location_lat: null, location_lng: null, anniversary_start: null, google_meta_at: null })
      .eq("user_id", userId)
      .in("event_key", list.slice(i, i + 300))
      .not("google_meta_at", "is", null);
    if (error) console.error("clearGoogleMetaForKeys", error);
  }
}

/** 구글 시리즈 키와 회차 키들. withMaster=false 면 회차 키만 */
export async function googleSeriesMetaKeys(userId: string, googleMasterId: string, withMaster = true): Promise<string[]> {
  const master = `gcal_${googleMasterId}`;
  const db = getAdminClient();
  const { data } = await db
    .from("event_annotations")
    .select("event_key")
    .eq("user_id", userId)
    .like("event_key", `${master}%`)
    .not("google_meta_at", "is", null);
  return (data ?? [])
    .map((r) => String(r.event_key))
    .filter((k) => (withMaster && k === master) || /^_\d{8}(T\d{6}Z)?$/.test(k.slice(master.length)));
}

export async function clearGoogleMetaForSeries(userId: string, googleMasterId: string) {
  await clearGoogleMetaForKeys(userId, await googleSeriesMetaKeys(userId, googleMasterId));
}
