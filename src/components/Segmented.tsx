import Link from "next/link";

/**
 * iOS 세그먼트 컨트롤 모양 — 회색 트랙 위에 흰 썸.
 * 링크(페이지 전환)나 버튼(탭 상태) 어느 쪽으로든 쓴다.
 */
export function Segmented<T extends string>({
  items,
  value,
  onChange,
  className = "",
}: {
  items: Array<{ value: T; label: React.ReactNode; href?: string }>;
  value: T;
  onChange?: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={`flex rounded-full bg-charcoal-800/70 p-1 ${className}`} role="tablist">
      {items.map((it) => {
        const active = it.value === value;
        const cls = `flex h-9 flex-1 items-center justify-center rounded-full text-sm transition ${
          active
            ? "bg-[rgb(var(--bg-surface))] font-semibold text-charcoal-50 shadow-sm"
            : "font-medium text-charcoal-300"
        }`;
        return it.href ? (
          <Link key={it.value} href={it.href} className={cls} role="tab" aria-selected={active}>
            {it.label}
          </Link>
        ) : (
          <button
            key={it.value}
            type="button"
            className={cls}
            role="tab"
            aria-selected={active}
            onClick={() => onChange?.(it.value)}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}
