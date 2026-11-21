/**
 * 단색 선 아이콘(11/21 묶음 바) — 화면에 남아 있던 이모지(📍🔒📌🔗❤)를 대신한다.
 * 색은 currentColor(글자색·공개 링크 테마 글자색을 그대로 따른다), 굵기 1.6 — 프로필 공유·행 아이콘과 같다.
 * 크기는 className 으로(기본 글자 높이 정도 1em).
 */
const PATHS: Record<string, string[]> = {
  mapPin: [
    "M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
    "M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z",
  ],
  lock: [
    "M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z",
  ],
  pin: [
    "M12 17v5",
    "M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1Z",
  ],
  link: [
    "M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244",
  ],
  heart: [
    "M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z",
  ],
};

export type LineIconName = keyof typeof PATHS;

export function LineIcon({
  name,
  className = "mr-[0.15em] inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]",
  filled = false,
  label,
}: {
  name: "mapPin" | "lock" | "pin" | "link" | "heart";
  className?: string;
  /** 하트를 누른 상태처럼 안을 채울 때 */
  filled?: boolean;
  /** 읽어 줄 이름 — 없으면 장식(aria-hidden) */
  label?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.6}
      className={className}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {PATHS[name].map((d) => (
        <path key={d} strokeLinecap="round" strokeLinejoin="round" d={d} />
      ))}
    </svg>
  );
}
