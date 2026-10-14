/**
 * 반복 일정 (1.5.1) — Orbit42 일정(events.rrule)을 조회 기간 안의 회차로 펼친다.
 *
 * - 규칙은 RFC 5545 RRULE 문자열(구글과 같은 꼴)이지만, 앱이 만드는 범위만 다룬다:
 *   FREQ=DAILY|WEEKLY|MONTHLY|YEARLY, INTERVAL, COUNT, UNTIL, BYDAY(매주 요일 여러 개).
 * - 반복은 KST 벽시계 기준(매주 월 10:00 은 늘 10:00 KST). 종일 일정은 날짜만 본다.
 * - 회차 id 는 구글과 같은 꼴 `<events.id>_<원래 시작 UTC>`(시간 일정 `20261020T010000Z`,
 *   종일 `20261020`) — 완료·별점·중요도·알림이 지금 키 방식 그대로 회차마다 붙는다.
 * - 날짜가 없는 달(31일)·평년의 2월 29일은 건너뛴다(구글과 같음). 단 기념일(is_anniversary)의 2월 29일은
 *   평년에 2월 28일로 둔다(생일·기념일이 4년에 한 번만 보이면 안 되므로).
 */

const KST_OFFSET_MS = 9 * 3_600_000;
const DAY_MS = 86_400_000;
/** 펼치기 안전장치 — 한 시리즈에서 만들 수 있는 최대 회차 수 */
const MAX_OCCURRENCES = 5000;

export type Freq = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

export type RRule = {
  freq: Freq;
  interval: number;
  count?: number;
  until?: Date;
  /** 0=일 … 6=토 (WEEKLY 에서만) */
  byDay?: number[];
};

const DAY_CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

/** "RRULE:FREQ=WEEKLY;BYDAY=MO,WE;COUNT=10" → RRule. 모르는 규칙이면 null(펼치지 않음). */
export function parseRRule(raw: string | null | undefined): RRule | null {
  if (!raw) return null;
  const body = raw.trim().replace(/^RRULE:/i, "");
  const parts = new Map<string, string>();
  for (const p of body.split(";")) {
    const [k, v] = p.split("=");
    if (k && v) parts.set(k.toUpperCase(), v.toUpperCase());
  }
  const freq = parts.get("FREQ") as Freq | undefined;
  if (!freq || !["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].includes(freq)) return null;
  // 다루지 않는 규칙(BYMONTHDAY·BYSETPOS 등)이 있으면 잘못 펼치느니 펼치지 않는다
  for (const k of Array.from(parts.keys())) {
    if (!["FREQ", "INTERVAL", "COUNT", "UNTIL", "BYDAY", "WKST"].includes(k)) return null;
  }
  const interval = Math.max(1, Number(parts.get("INTERVAL") ?? 1) || 1);
  const rule: RRule = { freq, interval };
  const count = parts.get("COUNT");
  if (count) rule.count = Math.max(1, Number(count) || 1);
  const until = parts.get("UNTIL");
  if (until) {
    const d = parseRRuleDate(until);
    if (d) rule.until = d;
  }
  const byDay = parts.get("BYDAY");
  if (byDay) {
    if (freq !== "WEEKLY") return null;
    const days = byDay.split(",").map((c) => DAY_CODES.indexOf(c.trim()));
    if (days.some((d) => d < 0)) return null;
    rule.byDay = Array.from(new Set(days)).sort((a, b) => a - b);
  }
  return rule;
}

/** UNTIL 값: "20261231T145959Z" 또는 "20261231"(그날 끝까지) */
function parseRRuleDate(v: string): Date | null {
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z?)?$/);
  if (!m) return null;
  if (!m[4]) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 23, 59, 59));
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]));
}

/** 벽시계 성분 — 시간 일정은 KST, 종일은 날짜 그대로(UTC) */
type Wall = { y: number; m: number; d: number; h: number; mi: number; s: number };

function toWall(date: Date, allDay: boolean): Wall {
  const t = new Date(date.getTime() + (allDay ? 0 : KST_OFFSET_MS));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth(), d: t.getUTCDate(), h: t.getUTCHours(), mi: t.getUTCMinutes(), s: t.getUTCSeconds() };
}

function fromWall(w: Wall, allDay: boolean): Date | null {
  // 날짜가 없는 날(4월 31일·평년 2월 29일)이면 null
  const t = Date.UTC(w.y, w.m, w.d, w.h, w.mi, w.s);
  const check = new Date(t);
  if (check.getUTCMonth() !== ((w.m % 12) + 12) % 12 || check.getUTCDate() !== w.d) return null;
  return new Date(t - (allDay ? 0 : KST_OFFSET_MS));
}

/**
 * 시리즈의 회차 시작 시각들(원래 시작, UTC Date) — dtstart 부터 순서대로, `until`(포함)까지.
 * COUNT·UNTIL 과 안전장치 안에서 멈춘다.
 */
export function occurrenceStarts(
  dtstart: Date,
  rule: RRule,
  allDay: boolean,
  stopAt: Date,
  /** 기념일(is_anniversary) — 매년 2월 29일을 평년에 건너뛰지 않고 2월 28일에 둔다 */
  feb29ToFeb28 = false,
): Date[] {
  const out: Date[] = [];
  const base = toWall(dtstart, allDay);
  const limit = rule.until && rule.until < stopAt ? rule.until : stopAt;
  const push = (d: Date | null): boolean => {
    if (!d || d < dtstart) return true;
    if (d > limit) return false;
    if (rule.count !== undefined && out.length >= rule.count) return false;
    out.push(d);
    return out.length < MAX_OCCURRENCES;
  };

  if (rule.freq === "WEEKLY") {
    const days = rule.byDay ?? [new Date(Date.UTC(base.y, base.m, base.d)).getUTCDay()];
    // dtstart 가 든 주의 월요일(WKST=MO)부터 interval 주씩
    const baseDow = new Date(Date.UTC(base.y, base.m, base.d)).getUTCDay();
    const mondayOffset = (baseDow + 6) % 7;
    for (let week = 0; ; week += rule.interval) {
      let keep = true;
      // 월~일 순서로 (일요일은 그 주 끝)
      const ordered = [...days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
      for (const dow of ordered) {
        const dayOffset = week * 7 - mondayOffset + ((dow + 6) % 7);
        const w = { ...base, d: base.d + dayOffset };
        const norm = new Date(Date.UTC(w.y, w.m, w.d));
        const d = fromWall({ ...base, y: norm.getUTCFullYear(), m: norm.getUTCMonth(), d: norm.getUTCDate() }, allDay);
        if (!push(d)) { keep = false; break; }
      }
      if (!keep) break;
      if (week > MAX_OCCURRENCES * 7) break;
    }
    return out;
  }

  for (let i = 0; i < MAX_OCCURRENCES * 12; i++) {
    const n = i * rule.interval;
    let w: Wall;
    if (rule.freq === "DAILY") {
      const norm = new Date(Date.UTC(base.y, base.m, base.d + n));
      w = { ...base, y: norm.getUTCFullYear(), m: norm.getUTCMonth(), d: norm.getUTCDate() };
    } else if (rule.freq === "MONTHLY") {
      const y = base.y + Math.floor((base.m + n) / 12);
      w = { ...base, y, m: (base.m + n) % 12 };
    } else {
      w = { ...base, y: base.y + n };
      if (feb29ToFeb28 && base.m === 1 && base.d === 29 && fromWall(w, allDay) === null) w = { ...w, d: 28 };
    }
    const d = fromWall(w, allDay);
    if (d === null) continue; // 그 달·해에 없는 날 — 건너뛰고 세지도 않음
    if (!push(d)) break;
  }
  return out;
}

/** 저장할 recurrence_until — 마지막 회차의 시작(끝없으면 null). 기간 조회 거르기용. */
export function computeRecurrenceUntil(dtstart: Date, rruleRaw: string, allDay: boolean): Date | null {
  const rule = parseRRule(rruleRaw);
  if (!rule) return null;
  if (rule.count === undefined && !rule.until) return null;
  const far = new Date(dtstart.getTime() + 400 * 365 * DAY_MS);
  const starts = occurrenceStarts(dtstart, rule, allDay, far);
  return starts.length ? starts[starts.length - 1] : dtstart;
}

/** 회차 id 접미사 — 구글과 같은 꼴 */
export function occurrenceSuffix(originalStart: Date, allDay: boolean): string {
  const iso = originalStart.toISOString(); // 2026-10-20T01:00:00.000Z
  const date = iso.slice(0, 10).replace(/-/g, "");
  if (allDay) return date;
  return `${date}T${iso.slice(11, 19).replace(/:/g, "")}Z`;
}

export function occurrenceId(seriesId: string, originalStart: Date, allDay: boolean): string {
  return `${seriesId}_${occurrenceSuffix(originalStart, allDay)}`;
}

/** 회차 id → 시리즈 id 와 원래 시작. 회차 id 가 아니면 null. */
export function parseOccurrenceId(id: string): { seriesId: string; originalStart: Date } | null {
  const m = id.match(/^([0-9a-f-]{36})_(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z)?$/i);
  if (!m) return null;
  const t = Date.UTC(+m[2], +m[3] - 1, +m[4], m[5] ? +m[5] : 0, m[6] ? +m[6] : 0, m[7] ? +m[7] : 0);
  return { seriesId: m[1], originalStart: new Date(t) };
}

/** 키 조회용 — 회차 id 면 시리즈 id, 아니면 그대로 */
export function seriesIdOf(id: string): string {
  return parseOccurrenceId(id)?.seriesId ?? id;
}

export type RecurrenceException = {
  event_id: string;
  original_start: string;
  cancelled: boolean;
  start_at?: string | null;
  end_at?: string | null;
  title?: string | null;
  description?: string | null;
  location?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  travel_min?: number | null;
};

type SeriesRow = {
  id: string;
  start_at: string;
  end_at?: string | null;
  all_day?: boolean | null;
  rrule?: string | null;
  is_anniversary?: boolean | null;
  [k: string]: unknown;
};

/**
 * 반복 일정 행을 [rangeStart, rangeEnd] 안에 시작하는 회차들로 펼친다(기존 조회와 같은 '시작이 기간 안' 기준).
 * 예외로 옮긴 회차는 옮긴 시각 기준으로 기간을 본다. 취소한 회차는 뺀다.
 * 결과 행: 원래 칸 그대로 + id(회차 id)·start_at·end_at(회차)·series_id·original_start·series_start(기념일 n주년 계산용).
 */
export function expandSeries<T extends SeriesRow>(
  row: T,
  exceptions: RecurrenceException[],
  rangeStart: Date,
  rangeEnd: Date,
): Array<T & { series_id: string; original_start: string; series_start: string }> {
  const rule = parseRRule(row.rrule ?? null);
  const allDay = !!row.all_day;
  const dtstart = new Date(row.start_at);
  if (!rule || Number.isNaN(dtstart.getTime())) return [];
  const durationMs = row.end_at ? Math.max(0, Date.parse(row.end_at) - dtstart.getTime()) : 0;
  const byStart = new Map(
    exceptions.filter((x) => x.event_id === row.id).map((x) => [new Date(x.original_start).getTime(), x]),
  );
  // 예외로 기간 밖에서 안으로 옮겨 온 회차도 잡도록 앞뒤 넉넉히(최대 1년) 펼친 뒤 거른다
  const starts = occurrenceStarts(dtstart, rule, allDay, new Date(rangeEnd.getTime() + 366 * DAY_MS), !!row.is_anniversary);
  const out: Array<T & { series_id: string; original_start: string; series_start: string }> = [];
  for (const original of starts) {
    const ex = byStart.get(original.getTime());
    if (ex?.cancelled) continue;
    const start = ex?.start_at ? new Date(ex.start_at) : original;
    const end = ex?.end_at ? new Date(ex.end_at) : new Date(start.getTime() + durationMs);
    if (start < rangeStart || start > rangeEnd) continue;
    const occ = {
      ...row,
      id: occurrenceId(row.id, original, allDay),
      start_at: start.toISOString(),
      end_at: row.end_at || ex?.end_at ? end.toISOString() : row.end_at,
      series_id: row.id,
      original_start: original.toISOString(),
      series_start: dtstart.toISOString(),
    } as T & { series_id: string; original_start: string; series_start: string };
    if (ex?.title) (occ as SeriesRow).title = ex.title;
    if (ex?.description !== undefined && ex?.description !== null) (occ as SeriesRow).description = ex.description;
    if (ex?.location !== undefined && ex?.location !== null) (occ as SeriesRow).location = ex.location;
    // 좌표는 장소와 한 묶음 — 장소를 이 회차만 바꿨으면 좌표도 예외 값(없으면 null)
    if (ex?.location !== undefined && ex?.location !== null) {
      (occ as SeriesRow).location_lat = ex.location_lat ?? null;
      (occ as SeriesRow).location_lng = ex.location_lng ?? null;
    }
    if (ex?.travel_min !== undefined && ex?.travel_min !== null) (occ as SeriesRow).travel_min = ex.travel_min > 0 ? ex.travel_min : null;
    out.push(occ);
  }
  return out;
}

// ── 기념일 ────────────────────────────────────────────────

/** 기준일(YYYY-MM-DD)의 그해 기념일 날짜 — 2월 29일은 평년에 2월 28일 */
export function anniversaryDateInYear(baseDate: string, year: number): string {
  const [, mm, dd] = baseDate.slice(0, 10).split("-").map(Number);
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const day = mm === 2 && dd === 29 && !leap ? 28 : dd;
  return `${year}-${String(mm).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** 그날이 기준일의 몇 주년인지 — 기념일이 아니거나 기준 연도 이전이면 null */
export function anniversaryNumber(baseDate: string, onDate: string): number | null {
  const year = Number(onDate.slice(0, 4));
  const n = year - Number(baseDate.slice(0, 4));
  if (n < 1) return null;
  return anniversaryDateInYear(baseDate, year) === onDate.slice(0, 10) ? n : null;
}
