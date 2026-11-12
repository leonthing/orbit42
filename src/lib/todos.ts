// 일반 서버 모듈 — 서버 액션 아님(보안-6). 앱은 /api/v1/todos·follow-ups, 웹 체크는 todos-actions.ts.
/**
 * 할 일 + 후속 일정 연결 (1.9.0, 설계: 업무기록/설계_1.9.0_후속할일.md).
 * - 일정 식별자는 앱·별점·알림과 같은 모양(toEventKey: 네이티브 uuid[_회차], 구글 gcal_<id>)으로만 저장한다.
 *   일정 제목·시각은 저장하지 않고 볼 때마다 읽어 온다(처리방침 11절).
 * - 원래 일정이 지워지면 연결만 끊고 할 일은 남긴다(삭제 경로 + 읽을 때 못 찾으면 정리).
 * - 한도: 아직 안 한 할 일 1000개, 하루 새로 300개, 한 번에 30줄.
 * - 시행일(11/20) 전에는 v190Open() 이 false 라 모두 거절한다.
 */
import { getAdminClient } from "@/lib/supabase";
import { V190_CLOSED_MESSAGE, v190Open } from "@/lib/dm-flags";
import { toEventKey, normalizeEventKey } from "@/lib/event-key";

export const TODO_TITLE_MAX = 200;
export const TODO_OPEN_LIMIT = 1000;
export const TODO_DAILY_LIMIT = 300;
export const TODO_BATCH_LIMIT = 30;

type Err = { error: string; code?: string };
const closed = (): Err => ({ error: V190_CLOSED_MESSAGE, code: "closed" });
const db = () => getAdminClient();

export type TodoRow = {
  id: string;
  user_id: string;
  title: string;
  due_date: string | null;
  done_at: string | null;
  source_event_key: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type EventInfo = { key: string; title: string; start: string; allDay: boolean; calendarId: string | null; status: "done" | "upcoming" | "past" };

export type Todo = {
  id: string;
  title: string;
  dueDate: string | null;
  done: boolean;
  doneAt: string | null;
  sortOrder: number;
  sourceEventKey: string | null;
  /** 원래 일정 제목(목록에 작게) — 못 찾으면 null 이고 연결은 정리된다 */
  sourceTitle: string | null;
  /** 원래 일정 시작(누르면 그 일정 상세로) */
  sourceStart: string | null;
  createdAt: string;
};

// ── 순수 함수 ────────────────────────────────────────────

export function kstToday(now = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}

/** 메모 줄 중 "-", "•", "*", "·" 로 시작하는 줄 → 할 일 후보 (앱과 같은 규칙, 테스트용) */
export function bulletLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => /^[-•*·]\s*\S/.test(l))
    .map((l) => l.replace(/^[-•*·]\s*/, "").trim())
    .filter(Boolean);
}

export function cleanTitle(t: unknown): string | null {
  if (typeof t !== "string") return null;
  const s = t.replace(/\s+/g, " ").trim();
  if (!s) return null;
  return s.slice(0, TODO_TITLE_MAX);
}

export function cleanDate(d: unknown): string | null | undefined {
  if (d === null) return null;
  if (typeof d !== "string") return undefined;
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : undefined;
}

/** 목록 묶음: 기한 지남 / 오늘 / 예정 / 기한 없음 / 완료 */
export function groupOf(t: Pick<Todo, "done" | "dueDate">, today: string): "overdue" | "today" | "upcoming" | "someday" | "done" {
  if (t.done) return "done";
  if (!t.dueDate) return "someday";
  if (t.dueDate < today) return "overdue";
  if (t.dueDate === today) return "today";
  return "upcoming";
}

// ── 일정 읽기(제목은 저장하지 않음) ─────────────────────────

/** 이 사람이 볼 수 있는 일정들의 제목·시각. 못 찾은 키는 결과에 없다. */
export async function eventInfos(userId: string, keys: string[], now = new Date()): Promise<Map<string, EventInfo>> {
  const out = new Map<string, EventInfo>();
  const uniq = Array.from(new Set(keys.map(toEventKey).filter(Boolean)));
  if (uniq.length === 0) return out;
  const { seriesIdOf, parseOccurrenceId } = await import("@/lib/recurrence");
  const local = uniq.filter((k) => !k.startsWith("gcal_"));
  if (local.length > 0) {
    const ids = Array.from(new Set(local.map(seriesIdOf)));
    const { data: evs } = await db().from("events").select("id, user_id, title, start_at, all_day, calendar_id").in("id", ids);
    const byId = new Map((evs ?? []).map((e) => [e.id as string, e]));
    // 내 일정이거나 내가 편집할 수 있는 캘린더의 일정만
    const others = (evs ?? []).filter((e) => e.user_id !== userId).map((e) => e.calendar_id as string).filter(Boolean);
    const shared = new Set<string>();
    if (others.length) {
      const { data: m } = await db().from("calendar_members").select("calendar_id").eq("user_id", userId).in("calendar_id", others);
      for (const r of m ?? []) shared.add(r.calendar_id as string);
    }
    for (const key of local) {
      const e = byId.get(seriesIdOf(key));
      if (!e) continue;
      if (e.user_id !== userId && !shared.has(e.calendar_id as string)) continue;
      const occ = parseOccurrenceId(key);
      const start = occ ? occ.originalStart.toISOString() : (e.start_at as string);
      out.set(key, { key, title: e.title as string, start, allDay: !!e.all_day, calendarId: (e.calendar_id as string | null) ?? null, status: "upcoming" });
    }
  }
  const google = uniq.filter((k) => k.startsWith("gcal_"));
  if (google.length > 0) {
    const { getGoogleEventsByIds } = await import("@/lib/calendar-events");
    const found = await getGoogleEventsByIds(userId, google);
    for (const [k, v] of Array.from(found.entries())) {
      out.set(k, { key: k, title: v.title, start: v.start_at, allDay: v.all_day, calendarId: v.calendar_id, status: "upcoming" });
    }
  }
  if (out.size > 0) {
    const { completedKeysFor } = await import("@/lib/event-completions-query");
    const done = await completedKeysFor(userId, Array.from(out.keys()).map(normalizeEventKey));
    for (const info of Array.from(out.values())) {
      if (done.has(normalizeEventKey(info.key))) info.status = "done";
      else if (info.start && new Date(info.start).getTime() < now.getTime()) info.status = "past";
    }
  }
  return out;
}

/** 원래·후속 일정이 지워졌을 때: 연결 줄을 지우고 할 일의 원래 일정 칸을 비운다(할 일은 남김) */
export async function forgetEventLinks(userId: string, rawKey: string) {
  const key = toEventKey(rawKey);
  if (!key) return;
  try {
    await db().from("event_follow_ups").delete().eq("user_id", userId).or(`source_key.eq.${key},target_key.eq.${key}`);
    await db().from("todos").update({ source_event_key: null }).eq("user_id", userId).eq("source_event_key", key);
  } catch (err) {
    console.error("[todos] forget links", err);
  }
}

/** 반복 일정 전체를 지울 때: 그 시리즈의 모든 회차 키 정리 */
export async function forgetSeriesLinks(userId: string, seriesId: string) {
  try {
    await db().from("event_follow_ups").delete().eq("user_id", userId).or(`source_key.like.${seriesId}*,target_key.like.${seriesId}*`);
    await db().from("todos").update({ source_event_key: null }).eq("user_id", userId).like("source_event_key", `${seriesId}%`);
  } catch (err) {
    console.error("[todos] forget series", err);
  }
}

// ── 할 일 ────────────────────────────────────────────────

function toTodo(r: TodoRow, info: Map<string, EventInfo>): Todo {
  return {
    id: r.id,
    title: r.title,
    dueDate: r.due_date,
    done: !!r.done_at,
    doneAt: r.done_at,
    sortOrder: r.sort_order,
    sourceEventKey: r.source_event_key,
    sourceTitle: r.source_event_key ? info.get(r.source_event_key)?.title ?? null : null,
    sourceStart: r.source_event_key ? info.get(r.source_event_key)?.start ?? null : null,
    createdAt: r.created_at,
  };
}

/** 원래 일정을 읽고, 못 찾은 연결은 그 자리에서 정리한다(구글에서 직접 지운 경우) */
async function withSources(userId: string, rows: TodoRow[], now: Date): Promise<Todo[]> {
  const keys = Array.from(new Set(rows.map((r) => r.source_event_key).filter(Boolean) as string[]));
  const info = await eventInfos(userId, keys, now);
  const missing = keys.filter((k) => !info.has(k));
  // 구글 연결이 끊긴 경우에도 못 찾는다 — 그때 연결을 지우면 다시 연결해도 돌아오지 않으니, 구글 연결이 있을 때만 정리
  if (missing.length) {
    const hasGoogle = missing.some((k) => k.startsWith("gcal_")) ? await googleConnected(userId) : false;
    for (const k of missing) {
      if (k.startsWith("gcal_") && !hasGoogle) continue;
      await forgetEventLinks(userId, k);
    }
  }
  return rows.map((r) => toTodo(r, info));
}

async function googleConnected(userId: string): Promise<boolean> {
  const { count } = await db().from("calendars").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("source", "google");
  return (count ?? 0) > 0;
}

export type TodoList = { overdue: Todo[]; today: Todo[]; upcoming: Todo[]; someday: Todo[]; done: Todo[]; today_date: string };

/** 전체 목록 (완료는 최근 30일) */
export async function listTodos(userId: string, now = new Date()): Promise<TodoList | Err> {
  if (!v190Open(now)) return closed();
  const since = new Date(now.getTime() - 30 * 24 * 3600_000).toISOString();
  const [{ data: open }, { data: done }] = await Promise.all([
    db().from("todos").select("*").eq("user_id", userId).is("done_at", null).order("sort_order").order("created_at").limit(TODO_OPEN_LIMIT),
    db().from("todos").select("*").eq("user_id", userId).gte("done_at", since).order("done_at", { ascending: false }).limit(200),
  ]);
  const todos = await withSources(userId, [...((open ?? []) as TodoRow[]), ...((done ?? []) as TodoRow[])], now);
  const today = kstToday(now);
  const out: TodoList = { overdue: [], today: [], upcoming: [], someday: [], done: [], today_date: today };
  for (const t of todos) out[groupOf(t, today)].push(t);
  out.upcoming.sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? "") || a.sortOrder - b.sortOrder);
  out.overdue.sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? "") || a.sortOrder - b.sortOrder);
  return out;
}

/** 하루 보기: 그날 기한 + (오늘이면) 기한 지난 미완료. 그날 체크한 것도 줄 그은 채 남긴다. */
export async function dayTodos(userId: string, date: string, now = new Date()): Promise<{ todos: Todo[]; overdue: number } | Err> {
  if (!v190Open(now)) return closed();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "날짜가 올바르지 않아요." };
  const today = kstToday(now);
  const { data: due } = await db().from("todos").select("*").eq("user_id", userId).eq("due_date", date).order("sort_order").limit(300);
  let rows = (due ?? []) as TodoRow[];
  let overdue = 0;
  if (date === today) {
    const { data: late } = await db().from("todos").select("*").eq("user_id", userId).is("done_at", null).lt("due_date", today).order("due_date").limit(300);
    overdue = (late ?? []).length;
    rows = [...((late ?? []) as TodoRow[]), ...rows];
  }
  return { todos: await withSources(userId, rows, now), overdue };
}

/** 이 사람이 볼 수 있는 일정인지 (sourceEventKey·followUpOf 확인) */
async function ownsEvent(userId: string, key: string): Promise<boolean> {
  return (await eventInfos(userId, [key])).has(toEventKey(key));
}

export async function createTodos(
  userId: string,
  input: { items: Array<{ title?: unknown; dueDate?: unknown }>; sourceEventKey?: unknown },
  now = new Date(),
): Promise<{ todos: Todo[] } | Err> {
  if (!v190Open(now)) return closed();
  const items = Array.isArray(input.items) ? input.items : [];
  if (items.length === 0) return { error: "할 일을 적어 주세요." };
  if (items.length > TODO_BATCH_LIMIT) return { error: `한 번에 ${TODO_BATCH_LIMIT}개까지 만들 수 있어요.` };
  const rows: Array<{ title: string; due_date: string | null }> = [];
  for (const it of items) {
    const title = cleanTitle(it.title);
    if (!title) continue;
    const d = cleanDate(it.dueDate);
    rows.push({ title, due_date: d ?? null });
  }
  if (rows.length === 0) return { error: "할 일을 적어 주세요." };

  let source: string | null = null;
  if (typeof input.sourceEventKey === "string" && input.sourceEventKey) {
    source = toEventKey(input.sourceEventKey);
    if (!(await ownsEvent(userId, source))) return { error: "원래 일정을 찾을 수 없어요.", code: "not_found" };
  }

  const [{ count: openCount }, { count: todayCount }] = await Promise.all([
    db().from("todos").select("id", { count: "exact", head: true }).eq("user_id", userId).is("done_at", null),
    db().from("todos").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", new Date(`${kstToday(now)}T00:00:00+09:00`).toISOString()),
  ]);
  if ((openCount ?? 0) + rows.length > TODO_OPEN_LIMIT) return { error: `아직 안 한 할 일은 ${TODO_OPEN_LIMIT}개까지예요. 끝낸 것을 체크하거나 지워 주세요.`, code: "limit" };
  if ((todayCount ?? 0) + rows.length > TODO_DAILY_LIMIT) return { error: "오늘은 할 일을 더 만들 수 없어요.", code: "limit" };

  // 같은 일정·같은 제목은 다시 만들지 않는다(메모 바꾸기를 두 번 눌러도)
  let skip = new Set<string>();
  if (source) {
    const { data: existing } = await db().from("todos").select("title").eq("user_id", userId).eq("source_event_key", source);
    skip = new Set((existing ?? []).map((r) => r.title as string));
  }
  const base = Date.now() / 1000;
  const insert = rows
    .filter((r) => !skip.has(r.title))
    .map((r, i) => ({ user_id: userId, title: r.title, due_date: r.due_date, source_event_key: source, sort_order: base + i }));
  if (insert.length === 0) return { todos: [] };
  const { data, error } = await db().from("todos").insert(insert).select("*");
  if (error) {
    console.error("[todos] create", error.message);
    return { error: "할 일을 만들지 못했어요. 잠시 후 다시 시도해 주세요." };
  }
  const info = source ? await eventInfos(userId, [source], now) : new Map();
  return { todos: ((data ?? []) as TodoRow[]).map((r) => toTodo(r, info)) };
}

/** 본인 것만. 바꿀 수 있는 칸: title, dueDate, done, sortOrder */
export async function updateTodo(userId: string, id: string, patch: { title?: unknown; dueDate?: unknown; done?: unknown; sortOrder?: unknown }, now = new Date()): Promise<{ todo: Todo } | Err> {
  if (!v190Open(now)) return closed();
  const row: Record<string, unknown> = { updated_at: now.toISOString() };
  if ("title" in patch) {
    const t = cleanTitle(patch.title);
    if (!t) return { error: "할 일을 적어 주세요." };
    row.title = t;
  }
  if ("dueDate" in patch) {
    const d = cleanDate(patch.dueDate);
    if (d === undefined) return { error: "날짜가 올바르지 않아요." };
    row.due_date = d;
  }
  if ("done" in patch) row.done_at = patch.done === true ? now.toISOString() : null;
  if ("sortOrder" in patch) {
    if (typeof patch.sortOrder !== "number" || !Number.isFinite(patch.sortOrder)) return { error: "순서가 올바르지 않아요." };
    row.sort_order = patch.sortOrder;
  }
  const { data, error } = await db().from("todos").update(row).eq("id", id).eq("user_id", userId).select("*").maybeSingle();
  if (error || !data) return { error: "할 일을 찾을 수 없어요.", code: "not_found" };
  const r = data as TodoRow;
  const info = r.source_event_key ? await eventInfos(userId, [r.source_event_key], now) : new Map();
  return { todo: toTodo(r, info) };
}

export async function deleteTodo(userId: string, id: string, now = new Date()): Promise<{ ok: true } | Err> {
  if (!v190Open(now)) return closed();
  const { count } = await db().from("todos").delete({ count: "exact" }).eq("id", id).eq("user_id", userId);
  if (!count) return { error: "할 일을 찾을 수 없어요.", code: "not_found" };
  return { ok: true };
}

// ── 후속 일정 연결 ───────────────────────────────────────

export type FollowUpItem =
  | { kind: "event"; key: string; title: string; start: string; allDay: boolean; status: EventInfo["status"] }
  | { kind: "todo"; id: string; title: string; dueDate: string | null; done: boolean };

export type FollowUps = {
  /** 이 일정이 누군가의 후속이면 그 원래 일정 */
  source: (EventInfo & { missing?: false }) | { key: string; missing: true } | null;
  followUps: FollowUpItem[];
};

export async function followUpsOf(userId: string, rawKey: string, now = new Date()): Promise<FollowUps | Err> {
  if (!v190Open(now)) return closed();
  const key = toEventKey(rawKey);
  const [{ data: targets }, { data: sources }, { data: todos }] = await Promise.all([
    db().from("event_follow_ups").select("target_key").eq("user_id", userId).eq("source_key", key).order("created_at"),
    db().from("event_follow_ups").select("source_key").eq("user_id", userId).eq("target_key", key).limit(1),
    db().from("todos").select("*").eq("user_id", userId).eq("source_event_key", key).order("sort_order"),
  ]);
  const targetKeys = (targets ?? []).map((t) => t.target_key as string);
  const sourceKey = (sources ?? [])[0]?.source_key as string | undefined;
  const info = await eventInfos(userId, [...targetKeys, ...(sourceKey ? [sourceKey] : [])], now);
  const google = await googleConnected(userId);
  const gone = (k: string) => !info.has(k) && (!k.startsWith("gcal_") || google);

  const items: FollowUpItem[] = [];
  for (const k of targetKeys) {
    const e = info.get(k);
    if (e) items.push({ kind: "event", key: k, title: e.title, start: e.start, allDay: e.allDay, status: e.status });
    else if (gone(k)) await db().from("event_follow_ups").delete().eq("user_id", userId).eq("source_key", key).eq("target_key", k);
  }
  for (const t of (todos ?? []) as TodoRow[]) items.push({ kind: "todo", id: t.id, title: t.title, dueDate: t.due_date, done: !!t.done_at });

  let source: FollowUps["source"] = null;
  if (sourceKey) {
    const e = info.get(sourceKey);
    if (e) source = e;
    else if (gone(sourceKey)) {
      await db().from("event_follow_ups").delete().eq("user_id", userId).eq("source_key", sourceKey).eq("target_key", key);
      source = { key: sourceKey, missing: true };
    }
  }
  return { source, followUps: items };
}

export async function linkFollowUp(userId: string, rawSource: string, rawTarget: string, now = new Date()): Promise<{ ok: true } | Err> {
  if (!v190Open(now)) return closed();
  const source = toEventKey(rawSource);
  const target = toEventKey(rawTarget);
  if (!source || !target || source === target) return { error: "연결할 일정이 올바르지 않아요." };
  const info = await eventInfos(userId, [source, target], now);
  if (!info.has(source) || !info.has(target)) return { error: "일정을 찾을 수 없어요.", code: "not_found" };
  const { error } = await db().from("event_follow_ups").upsert({ user_id: userId, source_key: source, target_key: target }, { onConflict: "user_id,source_key,target_key" });
  if (error) return { error: "연결하지 못했어요." };
  return { ok: true };
}

export async function unlinkFollowUp(userId: string, rawSource: string, rawTarget: string, now = new Date()): Promise<{ ok: true } | Err> {
  if (!v190Open(now)) return closed();
  await db().from("event_follow_ups").delete().eq("user_id", userId).eq("source_key", toEventKey(rawSource)).eq("target_key", toEventKey(rawTarget));
  return { ok: true };
}

/** 아침 요약 한 줄: 오늘 기한 + 기한 지난 미완료 수 */
export async function todoCountForMorning(userId: string, now = new Date()): Promise<number> {
  if (!v190Open(now)) return 0;
  const { count } = await db().from("todos").select("id", { count: "exact", head: true }).eq("user_id", userId).is("done_at", null).lte("due_date", kstToday(now));
  return count ?? 0;
}
