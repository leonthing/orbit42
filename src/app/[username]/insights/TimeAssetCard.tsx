"use client";

import { useState } from "react";
import type { ValueStats } from "@/lib/value-stats";

function fmtWon(cents: number) {
  return `₩${Math.round(cents / 100).toLocaleString("ko-KR")}`;
}

/**
 * "내 시간 자산" — the asset view of one's time: hours traded, total
 * value, implied hourly rate. Generates a shareable PNG card whose
 * numbers travel via query params (nothing private served).
 */
export function TimeAssetCard({
  displayName,
  stats,
}: {
  displayName: string;
  stats: ValueStats;
}) {
  const [copied, setCopied] = useState(false);

  const cardUrl = `/api/time-card?${new URLSearchParams({
    name: displayName,
    hours: String(stats.total_booked_hours),
    value: String(Math.round(stats.total_revenue_cents / 100)),
    rate: stats.hourly_rate_cents
      ? String(Math.round(stats.hourly_rate_cents / 100))
      : "0",
  }).toString()}`;

  const copyCard = async () => {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}${cardUrl}`,
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // clipboard blocked — the 미리보기 link still works
    }
  };

  return (
    <section className="rounded-xl border border-navy-400/30 bg-gradient-to-br from-navy-500/10 to-charcoal-900/40 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-charcoal-100">
            내 시간 자산
          </h2>
          <p className="mt-0.5 text-2xs text-charcoal-500">
            확정·완료된 예약과 경매 낙찰 기준 누적
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={cardUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-charcoal-700 px-3 py-1.5 text-xs text-charcoal-300 hover:border-charcoal-600 hover:text-charcoal-100"
          >
            카드 미리보기
          </a>
          <button
            type="button"
            onClick={copyCard}
            className="rounded-lg bg-navy-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-400"
          >
            {copied ? "복사됨!" : "공유 카드 복사"}
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <AssetStat
          label="거래된 시간"
          value={`${stats.total_booked_hours}h`}
        />
        <AssetStat
          label="누적 거래액"
          value={
            stats.total_revenue_cents > 0
              ? fmtWon(stats.total_revenue_cents)
              : "—"
          }
          accent
        />
        <AssetStat
          label="시간당 가치"
          value={
            stats.hourly_rate_cents ? fmtWon(stats.hourly_rate_cents) : "—"
          }
        />
        <AssetStat
          label="최고 입찰가"
          value={
            stats.highest_bid_cents ? fmtWon(stats.highest_bid_cents) : "—"
          }
        />
      </div>
    </section>
  );
}

function AssetStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg border border-charcoal-800/60 bg-charcoal-900/40 p-3">
      <p className="text-2xs font-semibold uppercase tracking-wider text-charcoal-500">
        {label}
      </p>
      <p
        className={`mt-1 truncate text-lg font-bold ${
          accent ? "text-navy-600 dark:text-navy-300" : "text-charcoal-100"
        }`}
        title={value}
      >
        {value}
      </p>
    </div>
  );
}
