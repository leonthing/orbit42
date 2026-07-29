"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { placeBid } from "@/lib/auctions";
import { useToast } from "@/components/Toast";

type SlotInfo = {
  id: string;
  title: string;
  reserve_price_cents: number | null;
  auction_ends_at: string | null;
  current_high_bid_cents: number | null;
  active: boolean;
};

type BidRow = {
  id: string;
  amount_cents: number;
  created_at: string;
  bidder_username: string | null;
  bidder_display_name: string | null;
};

export default function AuctionPanel({
  slot,
  slotTime,
  bids,
  loggedIn,
  isOwner,
}: {
  slot: SlotInfo;
  slotTime: string | null;
  bids: BidRow[];
  loggedIn: boolean;
  isOwner: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [bidInput, setBidInput] = useState("");
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const ended = !!slot.auction_ends_at && new Date(slot.auction_ends_at) <= now;
  const reserve = slot.reserve_price_cents ?? 0;
  const high = slot.current_high_bid_cents ?? 0;
  const minNext = high > 0 ? high + 100 : Math.max(reserve, 100);

  const submit = () => {
    const won = Math.round(Number(bidInput));
    if (!won || won <= 0) return toast.error("올바른 금액을 입력해주세요.");
    const cents = won * 100;
    if (cents < minNext)
      return toast.error(
        `최소 입찰가는 ₩${(minNext / 100).toLocaleString("ko-KR")}원입니다.`,
      );
    startTransition(async () => {
      const res = await placeBid(slot.id, cents);
      if (res.error) return toast.error(res.error);
      setBidInput("");
      toast.success("입찰했어요.");
      router.refresh();
    });
  };

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-navy-400/40 bg-gradient-to-br from-navy-400/10 to-navy-500/5 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-2xs font-semibold uppercase tracking-wider text-navy-400">
              {ended ? "Closed" : "Live auction"}
            </p>
            <p className="mt-2 text-3xl font-bold text-charcoal-100">
              ₩
              {(high > 0 ? high : reserve) / 100 > 0
                ? ((high > 0 ? high : reserve) / 100).toLocaleString("ko-KR")
                : 0}
              <span className="ml-1 text-base font-medium text-charcoal-500">
                {high > 0 ? "현재 최고가" : "시작가"}
              </span>
            </p>
            {slotTime && (
              <p className="mt-2 text-sm text-charcoal-400">
                낙찰자 시간:{" "}
                {new Date(slotTime).toLocaleString("ko-KR", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  weekday: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            )}
          </div>
          {slot.auction_ends_at && (
            <Countdown endsAt={slot.auction_ends_at} now={now} ended={ended} />
          )}
        </div>

        {!ended && slot.active && !isOwner && (
          <>
            {!loggedIn && (
              <p className="mt-5 rounded-lg border border-charcoal-700/60 bg-charcoal-800/30 px-3 py-2 text-xs text-charcoal-400">
                입찰하려면 로그인이 필요해요.{" "}
                <Link href="/login" className="font-semibold text-navy-400 underline">
                  로그인하기
                </Link>
              </p>
            )}
            <div className="mt-3 flex gap-2">
              <div className="relative flex-1">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-charcoal-500">
                  ₩
                </span>
                <input
                  type="number"
                  min={Math.ceil(minNext / 100)}
                  step={1}
                  value={bidInput}
                  onChange={(e) => setBidInput(e.target.value)}
                  disabled={!loggedIn}
                  placeholder={`${(minNext / 100).toLocaleString("ko-KR")} 이상`}
                  className="w-full rounded-lg border border-charcoal-700 bg-charcoal-900/40 py-3 pl-7 pr-3 text-base text-charcoal-100 placeholder:text-charcoal-500 focus:border-navy-400/60 focus:outline-none disabled:opacity-60"
                />
              </div>
              <button
                type="button"
                onClick={submit}
                disabled={pending || !loggedIn}
                className="rounded-lg bg-navy-400 px-5 py-3 text-sm font-semibold text-charcoal-950 hover:bg-navy-400 disabled:opacity-60"
              >
                {pending ? "입찰 중…" : loggedIn ? "입찰" : "로그인 후 입찰"}
              </button>
            </div>
          </>
        )}
        {ended && bids[0] && (
          <p className="mt-5 rounded-lg border border-emerald-700/40 bg-emerald-700/10 p-3 text-sm text-emerald-300">
            낙찰: <strong>{bids[0].bidder_display_name || bids[0].bidder_username}</strong>{" "}
            · ₩{(bids[0].amount_cents / 100).toLocaleString("ko-KR")}
          </p>
        )}
        {!loggedIn && !ended && (
          <p className="mt-3 text-center text-xs text-charcoal-500">
            <Link href="/login" className="text-navy-400 hover:underline">
              로그인
            </Link>{" "}
            후 입찰할 수 있어요.
          </p>
        )}
      </div>

      <div className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/30 p-5">
        <h3 className="text-sm font-semibold text-charcoal-200">
          입찰 기록 ({bids.length})
        </h3>
        {bids.length === 0 ? (
          <p className="mt-3 text-sm text-charcoal-500">아직 입찰이 없어요.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {bids.map((b, i) => (
              <li
                key={b.id}
                className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
                  i === 0
                    ? "bg-navy-400/10 text-navy-200"
                    : "text-charcoal-400"
                }`}
              >
                <span>
                  {b.bidder_display_name || b.bidder_username}
                  <span className="ml-2 text-xs text-charcoal-600">
                    {new Date(b.created_at).toLocaleString("ko-KR", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </span>
                <span className={i === 0 ? "font-bold" : ""}>
                  ₩{(b.amount_cents / 100).toLocaleString("ko-KR")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function Countdown({
  endsAt,
  now,
  ended,
}: {
  endsAt: string;
  now: Date;
  ended: boolean;
}) {
  const ms = Math.max(0, new Date(endsAt).getTime() - now.getTime());
  const d = Math.floor(ms / (24 * 3600_000));
  const h = Math.floor((ms / 3600_000) % 24);
  const m = Math.floor((ms / 60_000) % 60);
  const s = Math.floor((ms / 1000) % 60);

  return (
    <div className="text-right">
      <p className="text-2xs font-semibold uppercase tracking-wider text-charcoal-500">
        {ended ? "Ended" : "마감까지"}
      </p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-navy-300">
        {ended
          ? "—"
          : d > 0
            ? `${d}d ${h}h`
            : `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(
                s,
              ).padStart(2, "0")}`}
      </p>
    </div>
  );
}
