import Link from "next/link";
import type { ReactNode } from "react";
import { buttonClasses } from "@/components/PendingButton";

type Props = {
  icon?: ReactNode;
  title: string;
  body?: ReactNode;
  /** 링크로 이동하는 CTA. 버튼(onClick)이 필요하면 `action` 을 쓴다. */
  cta?: { label: string; href: string };
  /** 클라이언트 컴포넌트의 버튼처럼 직접 넘기는 액션 */
  action?: ReactNode;
  /** 목록 안에 끼워 넣는 작은 변형 — 여백과 글자를 줄인다 */
  compact?: boolean;
};

/**
 * Shared empty-state — a soft card with an optional icon, title, body,
 * and a single CTA. Keeps the tone calm rather than shouty.
 */
export function EmptyState({
  icon,
  title,
  body,
  cta,
  action,
  compact = false,
}: Props) {
  return (
    <div
      className={`rounded-xl border border-dashed border-charcoal-800/60 bg-charcoal-900/20 text-center ${
        compact ? "px-5 py-6" : "px-6 py-12"
      }`}
    >
      {icon && !compact && (
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-charcoal-800/60 text-charcoal-400">
          {icon}
        </div>
      )}
      <p
        className={
          compact
            ? "text-sm font-medium text-charcoal-300"
            : "text-base font-semibold text-charcoal-200"
        }
      >
        {title}
      </p>
      {body && (
        <p
          className={`mx-auto max-w-md leading-relaxed text-charcoal-500 ${
            compact ? "mt-1 text-xs" : "mt-1.5 text-sm"
          }`}
        >
          {body}
        </p>
      )}
      {cta && (
        <Link href={cta.href} className={`mt-5 ${buttonClasses()}`}>
          {cta.label}
        </Link>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
