/**
 * 관계 궤도(사람) — 조회와 동기화. 웹 server action 과 /api/v1 라우트가 함께 쓴다.
 * 호출자가 신뢰할 수 있는 userId 를 넘긴다(lib/calendar-events.ts 와 같은 규칙).
 *
 * 사람(contacts)과 만남(contact_meetings)은 여러 경로에서 모인다.
 *   - 내부 신호(팔로우·예약·일정 참석자)는 언제나 동기화한다. 이미 orbit42 안에서
 *     사용자가 직접 맺은 관계라 따로 동의를 구할 필요가 없다.
 *   - 캘린더 참석자(구글·기기)는 users.people_import_enabled 를 켰을 때만 읽고,
 *     새로 찾은 사람은 'suggested' 로 두어 사용자가 고르게 한다.
 */

import { getAdminClient } from "@/lib/supabase";
import {
  getAuthenticatedCalendar,
  listExtraGoogleAccounts,
  getCalendarForExtraAccount,
} from "@/lib/google";
import {
  orbitRing,
  personColor,
  type MeetingSource,
  type OrbitPerson,
  type OrbitResponse,
  type PeopleNudge,
  type PersonDetailResponse,
  type PersonMeeting,
  type PersonSource,
  type PersonStatus,
} from "@/lib/people-types";

const DAY = 86_400_000;
/** 캘린더에서 읽어오는 범위: 지난 180일 ~ 앞으로 60일 */
const IMPORT_PAST_DAYS = 180;
const IMPORT_FUTURE_DAYS = 60;
/** 구글 재동기화 간격 */
const GOOGLE_SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000;
/** 참석자가 이보다 많은 일정(전사 회의·웨비나)은 관계 신호로 보지 않는다 */
const MAX_ATTENDEES = 8;
/** 한 만남이 함께한 시간에 더해지는 최대치 — 종일 워크숍이 합계를 왜곡하지 않게 */
const MAX_MEETING_HOURS = 12;

type ContactRow = {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  company: string | null;
  role: string | null;
  memo: string | null;
  status: PersonStatus;
  source: PersonSource;
  linked_user_id: string | null;
  archived_at: string | null;
  nudge_dismissed_at: string | null;
  created_at: string;
};

type MeetingRow = {
  id: string;
  contact_id: string;
  source: MeetingSource;
  source_ref: string | null;
  title: string | null;
  start_at: string;
  end_at: string | null;
};

const CONTACT_COLS =
  "id, user_id, name, email, company, role, memo, status, source, linked_user_id, archived_at, nudge_dismissed_at, created_at";

function normEmail(email: string | null | undefined): string | null {
  const e = (email ?? "").trim().toLowerCase();
  return e && e.includes("@") ? e : null;
}

/** 사람이 아닌 주소: 회의실·그룹 캘린더·자동 발신 */
function isMachineEmail(email: string): boolean {
  return (
    email.endsWith("calendar.google.com") ||
    /(^|[._-])(no-?reply|noreply|notifications?|calendar|mailer-daemon)([._-]|@)/.test(email)
  );
}

function localPart(email: string): string {
  return email.split("@")[0];
}

// ─────────────────────────────────────────────────────────────
// 사람 행 찾기/만들기
// ─────────────────────────────────────────────────────────────

/** 강한 신호(팔로우·예약·초대)로 들어온 사람은 제안 단계를 건너뛴다. */
const STRONG_SOURCES: PersonSource[] = ["manual", "follow", "booking", "participant"];

class ContactIndex {
  byEmail = new Map<string, ContactRow>();
  byMember = new Map<string, ContactRow>();

  constructor(rows: ContactRow[]) {
    for (const r of rows) this.add(r);
  }

  add(r: ContactRow) {
    if (r.email) this.byEmail.set(r.email.toLowerCase(), r);
    if (r.linked_user_id) this.byMember.set(r.linked_user_id, r);
  }

  find(email: string | null, memberId: string | null): ContactRow | null {
    return (
      (memberId ? this.byMember.get(memberId) : null) ??
      (email ? this.byEmail.get(email) : null) ??
      null
    );
  }
}

async function loadContacts(userId: string): Promise<ContactRow[]> {
  const db = getAdminClient();
  const { data } = await db.from("contacts").select(CONTACT_COLS).eq("user_id", userId);
  return (data ?? []) as ContactRow[];
}

/**
 * 이메일/회원으로 사람을 찾고, 없으면 만든다. 이미 있으면 빈 칸만 채우고
 * 강한 신호면 'suggested' 를 'active' 로 올린다. 사용자가 보관·거절한 사람은
 * 상태를 건드리지 않는다.
 */
async function ensureContact(
  userId: string,
  index: ContactIndex,
  input: {
    email: string | null;
    memberId: string | null;
    name: string;
    source: PersonSource;
  },
): Promise<ContactRow | null> {
  const db = getAdminClient();
  const strong = STRONG_SOURCES.includes(input.source);
  const existing = index.find(input.email, input.memberId);

  if (existing) {
    const patch: Partial<ContactRow> = {};
    if (!existing.linked_user_id && input.memberId) patch.linked_user_id = input.memberId;
    if (!existing.email && input.email) patch.email = input.email;
    if (strong && existing.status === "suggested") patch.status = "active";
    // 이메일 앞부분으로 지어둔 이름은 더 나은 이름이 들어오면 바꾼다.
    if (
      existing.email &&
      existing.name === localPart(existing.email) &&
      input.name &&
      input.name !== existing.name
    ) {
      patch.name = input.name;
    }
    if (Object.keys(patch).length === 0) return existing;
    const { data } = await db
      .from("contacts")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", existing.id)
      .select(CONTACT_COLS)
      .single();
    const row = (data as ContactRow | null) ?? existing;
    index.add(row);
    return row;
  }

  const { data, error } = await db
    .from("contacts")
    .insert({
      user_id: userId,
      name: input.name.slice(0, 100) || "이름 없음",
      email: input.email,
      linked_user_id: input.memberId,
      source: input.source,
      status: strong ? "active" : "suggested",
    })
    .select(CONTACT_COLS)
    .single();
  if (error || !data) {
    // 동시 동기화로 유니크 충돌이 나면 다시 읽어온다.
    const fresh = await loadContacts(userId);
    for (const r of fresh) index.add(r);
    return index.find(input.email, input.memberId);
  }
  index.add(data as ContactRow);
  return data as ContactRow;
}

/** 공개·이메일 인증된 회원만 이메일로 연결한다 — 비공개 계정의 존재를 드러내지 않게. */
async function membersByEmail(emails: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (emails.length === 0) return out;
  const db = getAdminClient();
  for (let i = 0; i < emails.length; i += 200) {
    const chunk = emails.slice(i, i + 200);
    const { data } = await db
      .from("users")
      .select("id, email, is_private, email_verified")
      .in("email", chunk);
    for (const u of (data ?? []) as Array<{
      id: string;
      email: string | null;
      is_private: boolean | null;
      email_verified: boolean | null;
    }>) {
      if (u.email && !u.is_private && u.email_verified) out.set(u.email.toLowerCase(), u.id);
    }
  }
  return out;
}

async function insertMeetings(
  rows: Array<{
    user_id: string;
    contact_id: string;
    source: MeetingSource;
    source_ref: string | null;
    title: string | null;
    start_at: string;
    end_at: string | null;
  }>,
) {
  if (rows.length === 0) return;
  const db = getAdminClient();
  for (let i = 0; i < rows.length; i += 500) {
    await db
      .from("contact_meetings")
      .upsert(rows.slice(i, i + 500), {
        onConflict: "contact_id,start_at",
        ignoreDuplicates: true,
      });
  }
}

// ─────────────────────────────────────────────────────────────
// 내부 신호: 팔로우 · 예약 · 일정 참석자
// ─────────────────────────────────────────────────────────────

async function syncInternal(userId: string, index: ContactIndex) {
  const db = getAdminClient();

  // 팔로우한 회원
  const { data: follows } = await db
    .from("follows")
    .select("following:users!follows_following_id_fkey(id, display_name, username)")
    .eq("follower_id", userId);
  for (const f of (follows ?? []) as unknown as Array<{
    following: { id: string; display_name: string | null; username: string } | null;
  }>) {
    const u = f.following;
    if (!u) continue;
    await ensureContact(userId, index, {
      email: null,
      memberId: u.id,
      name: u.display_name || u.username,
      source: "follow",
    });
  }

  const meetings: Parameters<typeof insertMeetings>[0] = [];

  // 예약 — 내가 호스트든 게스트든, 확정·완료된 것만
  const { data: bookings } = await db
    .from("bookings")
    .select(
      "id, host_id, guest_id, guest_name, guest_email, status, scheduled_at, scheduled_end_at, slot:time_slots(title)",
    )
    .or(`host_id.eq.${userId},guest_id.eq.${userId}`)
    .in("status", ["confirmed", "completed"])
    .not("scheduled_at", "is", null);
  const otherIds = new Set<string>();
  for (const b of (bookings ?? []) as Array<{ host_id: string; guest_id: string | null }>) {
    const other = b.host_id === userId ? b.guest_id : b.host_id;
    if (other) otherIds.add(other);
  }

  // 일정 참석자 — 내가 초대했거나(거절 제외), 초대받아 수락한 것
  const { data: participations } = await db
    .from("event_participants")
    .select("id, owner_id, participant_id, invited_email, title, start_at, end_at, all_day, status, event_key")
    .or(`owner_id.eq.${userId},participant_id.eq.${userId}`)
    .neq("status", "declined");
  for (const p of (participations ?? []) as Array<{
    owner_id: string;
    participant_id: string | null;
  }>) {
    const other = p.owner_id === userId ? p.participant_id : p.owner_id;
    if (other) otherIds.add(other);
  }

  const memberNames = new Map<string, string>();
  if (otherIds.size > 0) {
    const { data: users } = await db
      .from("users")
      .select("id, username, display_name")
      .in("id", Array.from(otherIds));
    for (const u of (users ?? []) as Array<{ id: string; username: string; display_name: string | null }>) {
      memberNames.set(u.id, u.display_name || u.username);
    }
  }

  for (const b of (bookings ?? []) as unknown as Array<{
    id: string;
    host_id: string;
    guest_id: string | null;
    guest_name: string | null;
    guest_email: string | null;
    scheduled_at: string;
    scheduled_end_at: string | null;
    slot: { title: string } | null;
  }>) {
    const iAmHost = b.host_id === userId;
    const memberId = iAmHost ? b.guest_id : b.host_id;
    if (memberId === userId) continue;
    const email = iAmHost && !b.guest_id ? normEmail(b.guest_email) : null;
    if (!memberId && !email) continue;
    const name =
      (memberId && memberNames.get(memberId)) ||
      (iAmHost ? b.guest_name : null) ||
      (email ? localPart(email) : "게스트");
    const contact = await ensureContact(userId, index, {
      email,
      memberId,
      name,
      source: "booking",
    });
    if (!contact) continue;
    meetings.push({
      user_id: userId,
      contact_id: contact.id,
      source: "booking",
      source_ref: b.id,
      title: b.slot?.title ?? "예약",
      start_at: b.scheduled_at,
      end_at: b.scheduled_end_at,
    });
  }

  for (const p of (participations ?? []) as Array<{
    owner_id: string;
    participant_id: string | null;
    invited_email: string | null;
    title: string;
    start_at: string;
    end_at: string | null;
    all_day: boolean;
    status: string;
    event_key: string;
  }>) {
    const iAmOwner = p.owner_id === userId;
    // 초대받은 쪽은 수락했을 때만 만남으로 본다.
    if (!iAmOwner && p.status !== "accepted") continue;
    const memberId = iAmOwner ? p.participant_id : p.owner_id;
    const email = iAmOwner && !p.participant_id ? normEmail(p.invited_email) : null;
    if (!memberId && !email) continue;
    const contact = await ensureContact(userId, index, {
      email,
      memberId,
      name: (memberId && memberNames.get(memberId)) || (email ? localPart(email) : "참석자"),
      source: "participant",
    });
    if (!contact || p.all_day) continue;
    meetings.push({
      user_id: userId,
      contact_id: contact.id,
      source: "participant",
      source_ref: p.event_key,
      title: p.title,
      start_at: p.start_at,
      end_at: p.end_at,
    });
  }

  // 예약·초대는 취소되거나 시간이 바뀔 수 있으니 매번 다시 쓴다.
  await db
    .from("contact_meetings")
    .delete()
    .eq("user_id", userId)
    .in("source", ["booking", "participant"]);
  await insertMeetings(meetings);
}

// ─────────────────────────────────────────────────────────────
// 캘린더 참석자: 구글 · 기기
// ─────────────────────────────────────────────────────────────

export type AttendeeEvent = {
  ref: string;
  title: string | null;
  startAt: string;
  endAt: string | null;
  attendees: Array<{ email: string; name?: string | null }>;
};

async function myEmails(userId: string): Promise<Set<string>> {
  const db = getAdminClient();
  const [{ data: me }, extras] = await Promise.all([
    db.from("users").select("email").eq("id", userId).single(),
    listExtraGoogleAccounts(userId),
  ]);
  const set = new Set<string>();
  const e = normEmail((me as { email: string | null } | null)?.email);
  if (e) set.add(e);
  for (const a of extras) {
    const x = normEmail(a.email);
    if (x) set.add(x);
  }
  return set;
}

/**
 * 참석자 목록이 붙은 일정들을 사람·만남으로 옮긴다. [rangeStart, rangeEnd] 안의
 * 같은 출처 만남은 먼저 지우고 다시 쓴다 — 취소·변경된 일정이 남지 않게.
 */
async function ingestAttendeeEvents(
  userId: string,
  index: ContactIndex,
  source: "google" | "device",
  rangeStart: Date,
  rangeEnd: Date,
  events: AttendeeEvent[],
) {
  const db = getAdminClient();
  const mine = await myEmails(userId);

  type Clean = { ev: AttendeeEvent; people: Array<{ email: string; name: string }> };
  const cleaned: Clean[] = [];
  for (const ev of events) {
    const seen = new Set<string>();
    const people: Array<{ email: string; name: string }> = [];
    for (const a of ev.attendees) {
      const email = normEmail(a.email);
      if (!email || mine.has(email) || isMachineEmail(email) || seen.has(email)) continue;
      seen.add(email);
      people.push({ email, name: (a.name ?? "").trim() || localPart(email) });
    }
    if (people.length === 0 || people.length > MAX_ATTENDEES) continue;
    cleaned.push({ ev, people });
  }

  const allEmails = Array.from(new Set(cleaned.flatMap((c) => c.people.map((p) => p.email))));
  const members = await membersByEmail(allEmails);

  const meetings: Parameters<typeof insertMeetings>[0] = [];
  for (const { ev, people } of cleaned) {
    for (const p of people) {
      const memberId = members.get(p.email) ?? null;
      if (memberId === userId) continue;
      const contact = await ensureContact(userId, index, {
        email: p.email,
        memberId,
        name: p.name,
        source,
      });
      if (!contact || contact.status === "dismissed") continue;
      meetings.push({
        user_id: userId,
        contact_id: contact.id,
        source,
        source_ref: ev.ref,
        title: ev.title ? ev.title.slice(0, 200) : null,
        start_at: new Date(ev.startAt).toISOString(),
        end_at: ev.endAt ? new Date(ev.endAt).toISOString() : null,
      });
    }
  }

  await db
    .from("contact_meetings")
    .delete()
    .eq("user_id", userId)
    .eq("source", source)
    .gte("start_at", rangeStart.toISOString())
    .lte("start_at", rangeEnd.toISOString());
  await insertMeetings(meetings);
}

async function fetchGoogleAttendeeEvents(
  userId: string,
  rangeStart: Date,
  rangeEnd: Date,
): Promise<AttendeeEvent[] | null> {
  const db = getAdminClient();
  const primary = await getAuthenticatedCalendar(userId);
  if (!primary) return null;

  const { data: cals } = await db
    .from("calendars")
    .select("google_calendar_id, google_account_id")
    .eq("user_id", userId)
    .eq("source", "google");
  const targets = ((cals ?? []) as Array<{
    google_calendar_id: string | null;
    google_account_id: string | null;
  }>).filter((c) => !!c.google_calendar_id);
  if (targets.length === 0) targets.push({ google_calendar_id: "primary", google_account_id: null });

  const extras = await listExtraGoogleAccounts(userId);
  const extraClients = new Map(
    await Promise.all(
      extras.map(async (a) => [a.id, await getCalendarForExtraAccount(a)] as const),
    ),
  );

  const out: AttendeeEvent[] = [];
  await Promise.all(
    targets.map(async (cal) => {
      const client = cal.google_account_id
        ? extraClients.get(cal.google_account_id) ?? null
        : primary;
      if (!client) return;
      let pageToken: string | undefined;
      for (let page = 0; page < 5; page++) {
        try {
          const res = await client.events.list({
            calendarId: cal.google_calendar_id as string,
            timeMin: rangeStart.toISOString(),
            timeMax: rangeEnd.toISOString(),
            singleEvents: true,
            maxResults: 2500,
            pageToken,
            fields:
              "nextPageToken,items(id,status,summary,start,end,attendees(email,displayName,self,resource,responseStatus))",
          });
          for (const it of res.data.items ?? []) {
            if (it.status === "cancelled") continue;
            // 종일 일정(휴가·출장 공유 등)은 만남으로 보지 않는다.
            if (!it.start?.dateTime) continue;
            const attendees = it.attendees ?? [];
            if (attendees.length < 2) continue;
            const self = attendees.find((a) => a.self);
            if (self?.responseStatus === "declined") continue;
            out.push({
              ref: `gcal_${it.id}`,
              title: it.summary ?? null,
              startAt: it.start.dateTime,
              endAt: it.end?.dateTime ?? null,
              attendees: attendees
                .filter((a) => !a.self && !a.resource && a.responseStatus !== "declined" && a.email)
                .map((a) => ({ email: a.email as string, name: a.displayName ?? null })),
            });
          }
          pageToken = res.data.nextPageToken ?? undefined;
          if (!pageToken) break;
        } catch (err) {
          console.error("people google sync", err);
          break;
        }
      }
    }),
  );
  return out;
}

function importRange(now = new Date()) {
  return {
    start: new Date(now.getTime() - IMPORT_PAST_DAYS * DAY),
    end: new Date(now.getTime() + IMPORT_FUTURE_DAYS * DAY),
  };
}

/**
 * 궤도를 열 때 부른다. 내부 신호는 매번, 구글 참석자는 켜져 있고 6시간이
 * 지났을 때(또는 force)만 다시 읽는다.
 */
export async function syncPeople(userId: string, opts: { force?: boolean } = {}) {
  const db = getAdminClient();
  const index = new ContactIndex(await loadContacts(userId));
  await syncInternal(userId, index);

  const { data: me } = await db
    .from("users")
    .select("people_import_enabled, people_synced_at")
    .eq("id", userId)
    .single();
  const settings = me as { people_import_enabled: boolean; people_synced_at: string | null } | null;
  if (!settings?.people_import_enabled) return;

  const stale =
    !settings.people_synced_at ||
    Date.now() - new Date(settings.people_synced_at).getTime() > GOOGLE_SYNC_INTERVAL_MS;
  if (!stale && !opts.force) return;

  const range = importRange();
  const events = await fetchGoogleAttendeeEvents(userId, range.start, range.end);
  if (events) {
    await ingestAttendeeEvents(userId, index, "google", range.start, range.end, events);
  }
  await db
    .from("users")
    .update({ people_synced_at: new Date().toISOString() })
    .eq("id", userId);
}

/** iOS 기기 캘린더(EventKit)에서 읽은 일정. 범위는 서버 기준으로 자른다. */
export async function importDeviceEvents(
  userId: string,
  rangeStart: Date,
  rangeEnd: Date,
  events: AttendeeEvent[],
) {
  const db = getAdminClient();
  const { data: me } = await db
    .from("users")
    .select("people_import_enabled")
    .eq("id", userId)
    .single();
  if (!(me as { people_import_enabled: boolean } | null)?.people_import_enabled) {
    throw new Error("캘린더에서 사람 찾기가 꺼져 있어요.");
  }
  const limit = importRange();
  const start = new Date(Math.max(rangeStart.getTime(), limit.start.getTime()));
  const end = new Date(Math.min(rangeEnd.getTime(), limit.end.getTime()));
  const inRange = events
    .filter((e) => {
      const t = new Date(e.startAt).getTime();
      return Number.isFinite(t) && t >= start.getTime() && t <= end.getTime();
    })
    .slice(0, 3000);
  const index = new ContactIndex(await loadContacts(userId));
  await ingestAttendeeEvents(userId, index, "device", start, end, inRange);
}

/**
 * 캘린더에서 사람 찾기 켜기/끄기. 끄면 캘린더에서 읽은 만남을 지우고,
 * 사용자가 고르지 않은(제안·거절) 사람도 함께 지운다. 직접 궤도에 넣은
 * 사람은 메모가 있을 수 있어 남긴다.
 */
export async function setPeopleImport(userId: string, enabled: boolean) {
  const db = getAdminClient();
  await db
    .from("users")
    .update({ people_import_enabled: enabled, people_synced_at: null })
    .eq("id", userId);
  if (enabled) {
    await syncPeople(userId, { force: true });
    return;
  }
  await db
    .from("contact_meetings")
    .delete()
    .eq("user_id", userId)
    .in("source", ["google", "device"]);
  await db
    .from("contacts")
    .delete()
    .eq("user_id", userId)
    .in("source", ["google", "device"])
    .in("status", ["suggested", "dismissed"]);
}

// ─────────────────────────────────────────────────────────────
// 조회
// ─────────────────────────────────────────────────────────────

type MemberInfo = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

function buildPerson(
  c: ContactRow,
  meetings: MeetingRow[],
  member: MemberInfo | null,
  following: boolean,
  now: number,
): OrbitPerson {
  const past = meetings.filter((m) => new Date(m.start_at).getTime() <= now);
  const future = meetings
    .filter((m) => new Date(m.start_at).getTime() > now)
    .sort((a, b) => a.start_at.localeCompare(b.start_at));
  const last = past.reduce<MeetingRow | null>(
    (acc, m) => (!acc || m.start_at > acc.start_at ? m : acc),
    null,
  );
  const daysSince = last
    ? Math.max(0, Math.floor((now - new Date(last.start_at).getTime()) / DAY))
    : null;
  let hours = 0;
  for (const m of past) {
    if (!m.end_at) continue;
    const h = (new Date(m.end_at).getTime() - new Date(m.start_at).getTime()) / 3_600_000;
    if (h > 0) hours += Math.min(h, MAX_MEETING_HOURS);
  }
  return {
    id: c.id,
    name: member?.display_name || c.name,
    email: c.email,
    company: c.company,
    role: c.role,
    memo: c.memo,
    status: c.status,
    source: c.source,
    color: personColor(c.id),
    member: member
      ? { username: member.username, displayName: member.display_name, avatarUrl: member.avatar_url }
      : null,
    following,
    lastMetAt: last?.start_at ?? null,
    daysSince,
    meetings90: past.filter((m) => now - new Date(m.start_at).getTime() <= 90 * DAY).length,
    meetingsTotal: past.length,
    hoursTogether: Math.round(hours * 10) / 10,
    lastMeetingTitle: last?.title ?? null,
    nextMeetingAt: future[0]?.start_at ?? null,
    nextMeetingTitle: future[0]?.title ?? null,
    ring: orbitRing(daysSince),
    archivedAt: c.archived_at,
  };
}

/** 가까움 점수: 최근일수록, 최근 90일에 자주 만날수록 높다. */
function closeness(p: OrbitPerson): number {
  const recency = p.daysSince == null ? 0 : 100 / (1 + p.daysSince / 7);
  const upcoming = p.nextMeetingAt ? 10 : 0;
  return recency + p.meetings90 * 5 + upcoming;
}

async function loadPeople(userId: string, contacts: ContactRow[]) {
  const db = getAdminClient();
  const ids = contacts.map((c) => c.id);
  const meetingsBy = new Map<string, MeetingRow[]>();
  if (ids.length > 0) {
    const { data } = await db
      .from("contact_meetings")
      .select("id, contact_id, source, source_ref, title, start_at, end_at")
      .eq("user_id", userId);
    for (const m of (data ?? []) as MeetingRow[]) {
      const list = meetingsBy.get(m.contact_id) ?? [];
      list.push(m);
      meetingsBy.set(m.contact_id, list);
    }
  }

  const memberIds = contacts.map((c) => c.linked_user_id).filter(Boolean) as string[];
  const members = new Map<string, MemberInfo>();
  const followingIds = new Set<string>();
  if (memberIds.length > 0) {
    const [{ data: users }, { data: follows }] = await Promise.all([
      db.from("users").select("id, username, display_name, avatar_url").in("id", memberIds),
      db.from("follows").select("following_id").eq("follower_id", userId).in("following_id", memberIds),
    ]);
    for (const u of (users ?? []) as MemberInfo[]) members.set(u.id, u);
    for (const f of (follows ?? []) as Array<{ following_id: string }>) followingIds.add(f.following_id);
  }

  const now = Date.now();
  return contacts.map((c) =>
    buildPerson(
      c,
      meetingsBy.get(c.id) ?? [],
      c.linked_user_id ? members.get(c.linked_user_id) ?? null : null,
      !!c.linked_user_id && followingIds.has(c.linked_user_id),
      now,
    ),
  );
}

/** 무료 메일이 아닌 내 이메일 도메인 — 같은 회사 동료는 캘린더 제안에서 뺀다. */
const FREE_MAIL = new Set([
  "gmail.com", "googlemail.com", "naver.com", "daum.net", "hanmail.net", "kakao.com",
  "icloud.com", "me.com", "mac.com", "outlook.com", "hotmail.com", "live.com", "yahoo.com", "nate.com",
]);
async function companyDomains(userId: string): Promise<Set<string>> {
  const out = new Set<string>();
  for (const e of Array.from(await myEmails(userId))) {
    const d = e.split("@")[1];
    if (d && !FREE_MAIL.has(d)) out.add(d);
  }
  return out;
}

export async function getOrbit(userId: string): Promise<OrbitResponse> {
  const db = getAdminClient();
  const contacts = await loadContacts(userId);
  const all = await loadPeople(userId, contacts);
  const rowById = new Map(contacts.map((c) => [c.id, c]));

  // 궤도는 "실제로 만난 사람"의 지도다. 팔로우만 하고 만난 기록이 없는 사람은
  // 궤도 바깥에 아무 정보 없이 쌓이기만 해서, 아래 '팔로우 중' 목록으로 따로 둔다.
  // (직접 추가한 사람은 만난 기록이 없어도 사용자가 고른 것이라 궤도에 둔다.)
  const active = all.filter((p) => p.status === "active");
  const onOrbit = (p: OrbitPerson) =>
    p.meetingsTotal > 0 || !!p.nextMeetingAt || p.source === "manual";
  const people = active
    .filter(onOrbit)
    .sort((a, b) => closeness(b) - closeness(a) || a.name.localeCompare(b.name));
  const followingOnly = active
    .filter((p) => !onOrbit(p))
    .sort((a, b) => a.name.localeCompare(b.name));

  // 제안 기준을 높인다: 두 번 이상 만났거나(한 번 + 다음 약속), 내 회사 도메인(동료)이 아닌 사람.
  const myDomains = await companyDomains(userId);
  const sameCompany = (email: string | null) => {
    const d = email?.split("@")[1]?.toLowerCase();
    return !!d && myDomains.has(d);
  };
  const suggestions = all
    .filter(
      (p) =>
        p.status === "suggested" &&
        (p.meetingsTotal >= 2 || (p.meetingsTotal >= 1 && !!p.nextMeetingAt)) &&
        !sameCompany(p.email),
    )
    .sort(
      (a, b) =>
        b.meetings90 - a.meetings90 ||
        b.meetingsTotal - a.meetingsTotal ||
        (a.daysSince ?? 9999) - (b.daysSince ?? 9999),
    )
    .slice(0, 20);

  const archived = all
    .filter((p) => p.status === "archived")
    .sort((a, b) => (b.archivedAt ?? "").localeCompare(a.archivedAt ?? ""));

  // 안부 넛지: 두 번 이상 만난 사이인데 3주 넘게 못 봤고, 잡힌 약속도 없는 사람.
  const nudges: PeopleNudge[] = people
    .filter((p) => {
      if (p.daysSince == null || p.daysSince < 21 || p.daysSince > 120) return false;
      if (p.meetingsTotal < 2 || p.nextMeetingAt) return false;
      const dismissed = rowById.get(p.id)?.nudge_dismissed_at;
      return !dismissed || (p.lastMetAt != null && dismissed < p.lastMetAt);
    })
    .sort((a, b) => b.meetings90 - a.meetings90 || (a.daysSince ?? 0) - (b.daysSince ?? 0))
    .slice(0, 3)
    .map((p) => ({ personId: p.id, days: p.daysSince as number }));

  const { data: me } = await db
    .from("users")
    .select("people_import_enabled, people_synced_at, google_refresh_token")
    .eq("id", userId)
    .single();
  const s = me as {
    people_import_enabled: boolean;
    people_synced_at: string | null;
    google_refresh_token: string | null;
  } | null;

  const [{ count: following }, { count: followers }] = await Promise.all([
    db.from("follows").select("id", { count: "exact", head: true }).eq("follower_id", userId),
    db.from("follows").select("id", { count: "exact", head: true }).eq("following_id", userId),
  ]);

  return {
    people,
    followingOnly,
    followCounts: { following: following ?? 0, followers: followers ?? 0 },
    suggestions,
    archived,
    nudges,
    importEnabled: !!s?.people_import_enabled,
    googleConnected: !!s?.google_refresh_token,
    syncedAt: s?.people_synced_at ?? null,
  };
}

export async function getPersonDetail(
  userId: string,
  personId: string,
): Promise<PersonDetailResponse | null> {
  const db = getAdminClient();
  const { data: row } = await db
    .from("contacts")
    .select(CONTACT_COLS)
    .eq("id", personId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!row) return null;
  const [person] = await loadPeople(userId, [row as ContactRow]);
  const { data } = await db
    .from("contact_meetings")
    .select("id, contact_id, source, source_ref, title, start_at, end_at")
    .eq("user_id", userId)
    .eq("contact_id", personId)
    .order("start_at", { ascending: false })
    .limit(200);
  const now = Date.now();
  const toMeeting = (m: MeetingRow): PersonMeeting => ({
    id: m.id,
    source: m.source,
    title: m.title,
    startAt: m.start_at,
    endAt: m.end_at,
  });
  const rows = (data ?? []) as MeetingRow[];
  return {
    person,
    past: rows.filter((m) => new Date(m.start_at).getTime() <= now).slice(0, 50).map(toMeeting),
    upcoming: rows
      .filter((m) => new Date(m.start_at).getTime() > now)
      .reverse()
      .map(toMeeting),
  };
}

// ─────────────────────────────────────────────────────────────
// 변경
// ─────────────────────────────────────────────────────────────

export type PersonPatch = {
  status?: "active" | "archived" | "dismissed";
  name?: string;
  company?: string | null;
  role?: string | null;
  memo?: string | null;
  dismissNudge?: boolean;
};

export async function updatePerson(userId: string, personId: string, patch: PersonPatch) {
  const db = getAdminClient();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.status) {
    update.status = patch.status;
    update.archived_at = patch.status === "archived" ? new Date().toISOString() : null;
  }
  if (patch.name !== undefined) {
    const name = patch.name.trim().slice(0, 100);
    if (!name) throw new Error("이름을 입력해주세요.");
    update.name = name;
  }
  const text = (v: string | null | undefined, max: number) =>
    v == null ? null : v.trim().slice(0, max) || null;
  if (patch.company !== undefined) update.company = text(patch.company, 100);
  if (patch.role !== undefined) update.role = text(patch.role, 100);
  if (patch.memo !== undefined) update.memo = text(patch.memo, 2000);
  if (patch.dismissNudge) update.nudge_dismissed_at = new Date().toISOString();

  const { data, error } = await db
    .from("contacts")
    .update(update)
    .eq("id", personId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();
  if (error) throw new Error("저장하지 못했어요.");
  if (!data) throw new Error("사람을 찾을 수 없어요.");
}

/** 제안 여러 명을 한 번에 궤도에 넣거나 거절한다. */
export async function resolveSuggestions(
  userId: string,
  ids: string[],
  action: "accept" | "dismiss",
) {
  if (ids.length === 0) return;
  const db = getAdminClient();
  await db
    .from("contacts")
    .update({
      status: action === "accept" ? "active" : "dismissed",
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("status", "suggested")
    .in("id", ids.slice(0, 200));
}

export async function addPerson(
  userId: string,
  input: { name: string; email?: string | null; company?: string | null; role?: string | null; memo?: string | null },
): Promise<string> {
  const name = input.name.trim().slice(0, 100);
  if (!name) throw new Error("이름을 입력해주세요.");
  const email = normEmail(input.email);
  const index = new ContactIndex(await loadContacts(userId));
  const members = email ? await membersByEmail([email]) : new Map<string, string>();
  const contact = await ensureContact(userId, index, {
    email,
    memberId: email ? members.get(email) ?? null : null,
    name,
    source: "manual",
  });
  if (!contact) throw new Error("추가하지 못했어요.");
  await updatePerson(userId, contact.id, {
    status: "active",
    company: input.company ?? contact.company,
    role: input.role ?? contact.role,
    memo: input.memo ?? contact.memo,
  });
  return contact.id;
}

/** "만났어요" — 캘린더에 없던 만남(커피챗·우연한 만남)을 직접 남긴다. */
export async function logMeeting(
  userId: string,
  personId: string,
  input: { title?: string | null; at?: string | null; minutes?: number | null },
) {
  const db = getAdminClient();
  const { data: c } = await db
    .from("contacts")
    .select("id")
    .eq("id", personId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!c) throw new Error("사람을 찾을 수 없어요.");
  const start = input.at ? new Date(input.at) : new Date();
  if (!Number.isFinite(start.getTime())) throw new Error("날짜가 올바르지 않아요.");
  // 같은 시각 중복 방지 유니크에 걸리지 않도록 초 단위를 버린다.
  start.setSeconds(0, 0);
  const minutes = Math.min(Math.max(input.minutes ?? 60, 0), 24 * 60);
  const { error } = await db.from("contact_meetings").insert({
    user_id: userId,
    contact_id: personId,
    source: "manual",
    title: input.title?.trim().slice(0, 200) || "만남",
    start_at: start.toISOString(),
    end_at: minutes > 0 ? new Date(start.getTime() + minutes * 60_000).toISOString() : null,
  });
  if (error) {
    if (error.code === "23505") throw new Error("그 시각에 이미 만남이 기록돼 있어요.");
    throw new Error("기록하지 못했어요.");
  }
}

export async function deleteMeeting(userId: string, meetingId: string) {
  const db = getAdminClient();
  // 직접 남긴 만남만 지울 수 있다 — 캘린더에서 온 것은 다음 동기화 때 되살아난다.
  await db
    .from("contact_meetings")
    .delete()
    .eq("id", meetingId)
    .eq("user_id", userId)
    .eq("source", "manual");
}
