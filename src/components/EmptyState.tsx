import Link from "next/link";
import type { ReactNode } from "react";
import { buttonClasses } from "@/components/PendingButton";

type Props = {
  icon?: ReactNode;
  title: string;
  body?: string;
  cta?: { label: string; href: string };
};

/**
 * Shared empty-state — a soft card with an optional icon, title, body,
 * and a single CTA. Keeps the tone calm rather than shouty.
 */
export function EmptyState({ icon, title, body, cta }: Props) {
  return (
    <div className="rounded-2xl border border-dashed border-charcoal-800/60 bg-charcoal-900/20 px-6 py-12 text-center">
      {icon && (
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-charcoal-800/60 text-charcoal-400">
          {icon}
        </div>
      )}
      <p className="text-base font-semibold text-charcoal-200">{title}</p>
      {body && (
        <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-charcoal-500">
          {body}
        </p>
      )}
      {cta && (
        <Link href={cta.href} className={`mt-5 ${buttonClasses()}`}>
          {cta.label}
        </Link>
      )}
    </div>
  );
}
