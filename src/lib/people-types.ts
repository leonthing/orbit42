/**
 * 관계 궤도(사람) — 클라이언트에서도 import 할 수 있는 타입과 순수 함수.
 * 서버 전용 조회·동기화는 lib/people.ts.
 */

export type PersonStatus = "suggested" | "active" | "archived" | "dismissed";
export type PersonSource =
  | "manual"
  | "follow"
  | "booking"
  | "participant"
  | "google"
  | "device";
export type MeetingSource = "manual" | "booking" | "participant" | "google" | "device";

/** 0 = 가까이(7일 이내) · 1 = 조금 멀리(30일 이내) · 2 = 멀리 */
export type OrbitRing = 0 | 1 | 2;

export type OrbitPerson = {
  id: string;
  name: string;
  email: string | null;
  company: string | null;
  role: string | null;
  memo: string | null;
  status: PersonStatus;
  source: PersonSource;
  /** 사람마다의 고유색 — 궤도·아바타·카드에서 이 사람을 구분하는 언어 */
  color: string;
  member: {
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  } | null;
  following: boolean;
  lastMetAt: string | null;
  daysSince: number | null;
  meetings90: number;
  meetingsTotal: number;
  /** 지나간 만남의 총 시간(시간 단위, 소수 1자리) */
  hoursTogether: number;
  lastMeetingTitle: string | null;
  nextMeetingAt: string | null;
  nextMeetingTitle: string | null;
  ring: OrbitRing;
  archivedAt: string | null;
};

export type PersonMeeting = {
  id: string;
  source: MeetingSource;
  title: string | null;
  startAt: string;
  endAt: string | null;
};

export type PeopleNudge = {
  personId: string;
  days: number;
};

export type OrbitResponse = {
  /** 궤도 위의 사람 — 실제로 만난 기록(또는 잡힌 약속)이 있거나 직접 추가한 사람 */
  people: OrbitPerson[];
  /** 팔로우만 하고 아직 만난 기록이 없는 사람 — 궤도 아래 목록 */
  followingOnly: OrbitPerson[];
  followCounts: { following: number; followers: number };
  suggestions: OrbitPerson[];
  archived: OrbitPerson[];
  nudges: PeopleNudge[];
  importEnabled: boolean;
  googleConnected: boolean;
  syncedAt: string | null;
};

export type PersonDetailResponse = {
  person: OrbitPerson;
  past: PersonMeeting[];
  upcoming: PersonMeeting[];
};

/** 궤도에 그리는 최대 인원. 나머지는 아래 목록에서. */
export const ORBIT_LIMIT = 12;

/** 사람 색 팔레트 — 강조색(인디고)과 겹치지 않는 차분한 톤 */
export const PERSON_COLORS = [
  "#E8775A", // coral
  "#E2A93B", // amber
  "#5BAA7A", // green
  "#3FA7A3", // teal
  "#4C8DF0", // blue
  "#9A6FE0", // violet
  "#D96A9E", // pink
  "#C7834A", // copper
] as const;

/** id(uuid) 로 정하는 고정색 — FNV-1a 로 섞어 비슷한 id 가 같은 색에 몰리지 않게 */
export function personColor(id: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return PERSON_COLORS[h % PERSON_COLORS.length];
}

export function orbitRing(daysSince: number | null): OrbitRing {
  if (daysSince != null && daysSince <= 7) return 0;
  if (daysSince != null && daysSince <= 30) return 1;
  return 2;
}

export const RING_LABELS: Record<OrbitRing, string> = {
  0: "가까이",
  1: "조금 멀리",
  2: "멀리",
};

/** "오늘" · "어제" · "3일 전" · "기록 없음" */
export function daysSinceLabel(days: number | null): string {
  if (days == null) return "기록 없음";
  if (days <= 0) return "오늘";
  if (days === 1) return "어제";
  return `${days}일 전`;
}

/** 아바타 이니셜: 한글은 첫 글자, 영문은 첫 글자 대문자 */
export function personInitial(name: string): string {
  const t = name.trim();
  return t ? t[0].toUpperCase() : "?";
}

export const SOURCE_LABELS: Record<PersonSource, string> = {
  manual: "직접 추가",
  follow: "팔로우",
  booking: "예약",
  participant: "일정 초대",
  google: "구글 캘린더",
  device: "기기 캘린더",
};
