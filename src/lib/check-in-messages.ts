/**
 * 안부 문구 — iOS CheckInMessages 와 같은 규칙 (Clique 의 '안부 보내기'를 orbit42 에 맞게).
 * 1:1 로 시간을 파는 사람이 지난 고객·지인에게 다시 말을 거는 용도라 존댓말로 짧게.
 * 시간대(서울)·뜸한 정도·지난 만남 제목에 맞춰 4개만, 같은 날·같은 사람이면 같은 목록.
 */
type When = "any" | "morning" | "lunch" | "evening" | "weekend";

type Person = { id: string; name: string; daysSince: number | null; lastMeetingTitle: string | null };

function callName(name: string) {
  const n = name.trim();
  return n.endsWith("님") ? n : `${n}님`;
}

function seoulNow(now: Date) {
  const s = new Date(now.getTime() + 9 * 3_600_000);
  return { hour: s.getUTCHours(), weekday: s.getUTCDay(), day: Math.floor(s.getTime() / 86_400_000) };
}

export function checkInOptions(p: Person, now = new Date()): string[] {
  const name = callName(p.name);
  const lead: string[] = [];
  if (p.daysSince !== null && p.daysSince >= 60) lead.push(`${name}, 정말 오랜만이에요! 그동안 잘 지내셨어요?`);
  const title = p.lastMeetingTitle?.trim();
  if (title && title.length <= 20) lead.push(`${name}, 지난번 '${title}' 이후로 어떻게 지내세요?`);

  const lines: [string, When][] = [
    [`${name}, 잘 지내시죠? 문득 생각나서 연락드려요.`, "any"],
    [`${name}, 요즘 어떻게 지내세요? 근황이 궁금해서요.`, "any"],
    [`${name}, 지난번에 나눈 이야기 이후로 어떻게 되셨는지 궁금해요.`, "any"],
    [`좋은 아침이에요, ${name}! 요즘 어떻게 지내세요?`, "morning"],
    [`${name}, 점심 맛있게 드셨어요? 시간 되실 때 커피 한잔해요.`, "lunch"],
    [`${name}, 오늘도 수고 많으셨어요. 요즘 근황 궁금해요.`, "evening"],
    [`${name}, 즐거운 주말 보내고 계세요? 다음 주에 시간 되시면 한번 봬요.`, "weekend"],
  ];
  const { hour, weekday, day } = seoulNow(now);
  const current: When | null =
    weekday === 0 || weekday === 6 ? "weekend"
    : hour >= 5 && hour < 11 ? "morning"
    : hour >= 11 && hour < 14 ? "lunch"
    : hour >= 17 && hour < 23 ? "evening"
    : null;
  const timely = lines.filter(([, w]) => w !== "any" && w === current).slice(0, 1).map(([t]) => t);
  const rest = lines.filter(([, w]) => w === "any").map(([t]) => t);
  // 날짜·사람으로 고정된 섞기
  let seed = day;
  for (const ch of p.id) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const next = () => (seed = (seed * 1103515245 + 12345) >>> 0) >>> 8;
  for (let i = rest.length - 1; i > 0; i--) {
    const j = next() % (i + 1);
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return [...lead, ...timely, ...rest].slice(0, 4);
}

/** 예약 링크를 붙인 문구 — 다시 만날 시간을 상대가 직접 고르게. */
export function checkInWithLink(p: Person, link: string): string[] {
  const name = callName(p.name);
  return [
    `${name}, 잘 지내시죠? 편하실 때 한번 봬요. 여기서 시간 골라주시면 맞춰둘게요 → ${link}`,
    `${name}, 요즘 어떠세요? 이야기 나누고 싶으시면 편한 시간으로 잡아주세요 → ${link}`,
  ];
}
