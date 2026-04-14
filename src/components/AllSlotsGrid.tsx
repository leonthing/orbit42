"use client";

import Link from "next/link";
import { ReactionStrip } from "@/components/ReactionStrip";
import { useSlotPanel } from "@/components/SlotPanel";
import type { ReactionSummary } from "@/lib/reactions-types";

type SlotCard = {
  id: string;
  slug: string;
  title: string;
  price_cents: number;
  duration_min: number;
  slot_type: string;
  location_detail: string | null;
  description: string | null;
};

export function AllSlotsGrid({
  username,
  slots,
  reactionsBySlot,
  loggedIn,
}: {
  username: string;
  slots: SlotCard[];
  reactionsBySlot: Array<[string, ReactionSummary[]]>;
  loggedIn: boolean;
}) {
  const panel = useSlotPanel();
  const reactionMap = new Map(reactionsBySlot);
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {slots.map((s) => {
        const priceLabel =
          s.price_cents === 0
            ? "FREE"
            : `₩${(s.price_cents / 100).toLocaleString("ko-KR")}`;
        const cardInner = (
          <>
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="truncate text-sm font-semibold text-charcoal-100 group-hover:text-red-700 dark:group-hover:text-red-200">
                {s.title}
              </h3>
              <span className="shrink-0 rounded-md bg-red-500/15 px-2 py-0.5 text-xs font-bold text-red-800 ring-1 ring-red-500/30 dark:text-red-300 dark:ring-0">
                {priceLabel}
              </span>
            </div>
            <p className="mt-1 text-xs text-charcoal-500">
              {s.duration_min}분 · {s.slot_type}
              {s.location_detail && ` · ${s.location_detail}`}
            </p>
            {s.description && (
              <p className="mt-2 line-clamp-2 text-xs text-charcoal-400">
                {s.description}
              </p>
            )}
          </>
        );
        return (
          <div
            key={s.id}
            className="group rounded-xl border border-charcoal-800/60 bg-charcoal-900/30 p-5 transition-colors hover:border-red-500/50"
          >
            {panel ? (
              <button
                type="button"
                onClick={() => panel.open({ slug: s.slug })}
                className="block w-full text-left"
              >
                {cardInner}
              </button>
            ) : (
              <Link href={`/${username}/s/${s.slug}`} className="block">
                {cardInner}
              </Link>
            )}
            <div className="mt-3">
              <ReactionStrip
                target_type="slot"
                target_id={s.id}
                initial={reactionMap.get(s.id) ?? []}
                loggedIn={loggedIn}
                size="sm"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
