"use client";

import Link from "next/link";
import { slotTypeLabel } from "@/lib/constants";
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
  pricing_model?: "fixed" | "auction";
  reserve_price_cents?: number | null;
  current_high_bid_cents?: number | null;
  auction_ends_at?: string | null;
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
        const isAuction = s.pricing_model === "auction";
        const auctionEnded =
          isAuction &&
          !!s.auction_ends_at &&
          new Date(s.auction_ends_at).getTime() <= Date.now();
        const topBid = s.current_high_bid_cents ?? s.reserve_price_cents ?? 0;
        const priceLabel = isAuction
          ? `₩${(topBid / 100).toLocaleString("ko-KR")}`
          : s.price_cents === 0
            ? "FREE"
            : `₩${(s.price_cents / 100).toLocaleString("ko-KR")}`;
        const auctionStatus = auctionEnded ? "경매 종료" : "경매중";
        const badgeClass = isAuction
          ? auctionEnded
            ? "shrink-0 rounded-md bg-charcoal-800/40 px-2 py-0.5 text-xs font-bold text-charcoal-500 ring-1 ring-charcoal-300 dark:ring-0"
            : "shrink-0 rounded-md bg-amber-500/15 px-2 py-0.5 text-xs font-bold text-amber-800 ring-1 ring-amber-500/40 dark:text-amber-200 dark:ring-0"
          : "shrink-0 rounded-md bg-navy-400/15 px-2 py-0.5 text-xs font-bold text-navy-700 ring-1 ring-navy-400/30 dark:text-navy-300 dark:ring-0";
        const pillClass = auctionEnded
          ? "bg-charcoal-800/40 text-charcoal-500 ring-1 ring-charcoal-300 dark:ring-0"
          : "bg-amber-500/15 text-amber-800 ring-1 ring-amber-500/40 dark:text-amber-200 dark:ring-0";
        const cardInner = (
          <>
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="truncate text-sm font-semibold text-charcoal-100 group-hover:text-navy-600 dark:group-hover:text-navy-200">
                {s.title}
              </h3>
              <span className={badgeClass}>{priceLabel}</span>
            </div>
            <p className="mt-1 text-xs text-charcoal-500">
              {isAuction && (
                <span
                  className={`mr-1 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${pillClass}`}
                >
                  {auctionStatus}
                </span>
              )}
              {s.duration_min}분 · {slotTypeLabel(s.slot_type)}
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
            className="group rounded-xl border border-charcoal-800/60 bg-charcoal-900/30 p-5 transition-colors hover:border-navy-400/50"
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
