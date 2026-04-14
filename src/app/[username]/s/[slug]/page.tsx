import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSlotBySlug, getBookableOptions, getUpcomingAvailabilities } from "@/lib/slots";
import { listBids } from "@/lib/auctions";
import { getSession } from "@/lib/auth";
import BookingForm from "./BookingForm";
import AuctionPanel from "./AuctionPanel";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { username: string; slug: string };
}): Promise<Metadata> {
  const data = await getSlotBySlug(params.username, params.slug);
  if (!data) return { title: "Not found" };
  return {
    title: `${data.slot.title} · @${data.host.username}`,
    description: data.slot.description ?? undefined,
  };
}

export default async function SlotPage({
  params,
}: {
  params: { username: string; slug: string };
}) {
  const data = await getSlotBySlug(params.username, params.slug);
  if (!data) notFound();
  const { slot, host } = data;

  const session = await getSession();
  const isOwner = session?.username === params.username;
  const isAuction = slot.pricing_model === "auction";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href={`/${params.username}`}
        className="inline-flex items-center gap-1 text-xs text-charcoal-500 hover:text-charcoal-300"
      >
        ← {host.display_name || host.username}
      </Link>

      <header className="rounded-2xl border border-charcoal-800/60 bg-charcoal-900/30 p-6">
        <div className="flex items-baseline gap-2">
          <h1 className="text-2xl font-bold text-charcoal-100">{slot.title}</h1>
          {!slot.active && (
            <span className="rounded-full bg-charcoal-700/40 px-2 py-0.5 text-[10px] font-semibold text-charcoal-500">
              OFF
            </span>
          )}
          <span
            className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
              isAuction
                ? "bg-red-500/20 text-red-300"
                : "bg-charcoal-800/60 text-charcoal-400"
            }`}
          >
            {isAuction ? "Auction" : slot.mode}
          </span>
        </div>
        <p className="mt-2 text-sm text-charcoal-400">
          {slot.duration_min}분 ·{" "}
          {isAuction
            ? `시작가 ₩${((slot.reserve_price_cents ?? 0) / 100).toLocaleString("ko-KR")}`
            : slot.price_cents === 0
              ? "Free"
              : `₩${(slot.price_cents / 100).toLocaleString("ko-KR")}`}
          {" · "}
          {slot.slot_type}
          {slot.location_detail && ` · ${slot.location_detail}`}
        </p>
        {slot.description && (
          <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-charcoal-300">
            {slot.description}
          </p>
        )}
      </header>

      {isAuction ? (
        <AuctionSection
          slot={slot}
          username={params.username}
          loggedIn={!!session}
          isOwner={isOwner}
        />
      ) : (
        <BookingSection slot={slot} username={params.username} session={session} isOwner={isOwner} />
      )}
    </div>
  );
}

async function BookingSection({
  slot,
  session,
  isOwner,
}: {
  slot: import("@/lib/slots").TimeSlot;
  username: string;
  session: { username: string } | null;
  isOwner: boolean;
}) {
  const options = await getBookableOptions(slot);
  return (
    <section className="rounded-2xl border border-charcoal-800/60 bg-charcoal-900/30 p-6">
      <h2 className="text-sm font-semibold text-charcoal-200">예약 가능한 시간</h2>
      {!slot.active ? (
        <p className="mt-3 text-sm text-charcoal-500">현재 예약을 받지 않는 슬롯이에요.</p>
      ) : options.length === 0 ? (
        <p className="mt-3 text-sm text-charcoal-500">
          예약 가능한 시간이 없어요. 잠시 후 다시 확인해주세요.
        </p>
      ) : isOwner ? (
        <div className="mt-4 space-y-3">
          <p className="text-xs text-charcoal-500">
            본인은 예약할 수 없지만, 게스트에게 노출되는 시간을 미리 확인할 수 있어요.
          </p>
          <OwnerAvailabilityPreview options={options} />
        </div>
      ) : (
        <div className="mt-4">
          <BookingForm
            slotId={slot.id}
            options={options}
            loggedIn={!!session}
            priceCents={slot.price_cents}
            slotTitle={slot.title}
          />
        </div>
      )}
    </section>
  );
}

function OwnerAvailabilityPreview({
  options,
}: {
  options: import("@/lib/slots").BookableOption[];
}) {
  const byDay = new Map<string, typeof options>();
  for (const o of options) {
    const d = new Date(o.start_at);
    const key = d.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "short",
    });
    const list = byDay.get(key) ?? [];
    list.push(o);
    byDay.set(key, list);
  }
  return (
    <div className="space-y-4">
      {Array.from(byDay.entries()).map(([day, opts]) => (
        <div key={day}>
          <p className="mb-2 text-xs font-medium text-charcoal-500">{day}</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {opts.map((o) => (
              <div
                key={o.availability_id ?? o.start_at}
                className="rounded-md border border-charcoal-800/60 bg-charcoal-800/20 px-3 py-2 text-sm tabular-nums text-charcoal-300"
              >
                {new Date(o.start_at).toLocaleTimeString("ko-KR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                {o.remaining > 1 && (
                  <span className="ml-1.5 text-[10px] text-charcoal-500">
                    ×{o.remaining}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

async function AuctionSection({
  slot,
  loggedIn,
  isOwner,
}: {
  slot: import("@/lib/slots").TimeSlot;
  username: string;
  loggedIn: boolean;
  isOwner: boolean;
}) {
  const [bids, availabilities] = await Promise.all([
    listBids(slot.id, 10),
    getUpcomingAvailabilities(slot.id),
  ]);
  const slotTime = availabilities[0]?.start_at ?? null;
  return (
    <AuctionPanel
      slot={{
        id: slot.id,
        title: slot.title,
        reserve_price_cents: slot.reserve_price_cents,
        auction_ends_at: slot.auction_ends_at,
        current_high_bid_cents: slot.current_high_bid_cents,
        active: slot.active,
      }}
      slotTime={slotTime}
      bids={bids.map((b) => ({
        id: b.id,
        amount_cents: b.amount_cents,
        created_at: b.created_at,
        bidder_username: b.bidder?.username ?? null,
        bidder_display_name: b.bidder?.display_name ?? null,
      }))}
      loggedIn={loggedIn}
      isOwner={isOwner}
    />
  );
}
