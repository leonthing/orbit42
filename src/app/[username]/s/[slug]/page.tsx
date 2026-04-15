import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSlotBySlug, getBookableOptions, getUpcomingAvailabilities } from "@/lib/slots";
import { listBids } from "@/lib/auctions";
import { listMenusForSlot } from "@/lib/menus";
import { getSession } from "@/lib/auth";
import BookingForm from "./BookingForm";
import AuctionPanel from "./AuctionPanel";
import { SlotDatePreview } from "@/components/SlotDatePicker";

function formatWindow(from: string | null, until: string | null): string {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  if (from && until) return `예약 가능 기간: ${fmt(from)} – ${fmt(until)}`;
  if (until) return `${fmt(until)}까지 예약 가능`;
  if (from) return `${fmt(from)}부터 예약 가능`;
  return "";
}

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { username: string; slug: string };
}): Promise<Metadata> {
  const data = await getSlotBySlug(params.username, params.slug);
  if (!data) return { title: "Not found" };
  const { slot, host } = data;
  const hostName = host.display_name || host.username;
  const title = `${slot.title} · ${hostName} (@${host.username})`;
  const isAuction = slot.pricing_model === "auction";
  const priceLabel = isAuction
    ? `경매 · 시작가 ₩${((slot.reserve_price_cents ?? 0) / 100).toLocaleString("ko-KR")}`
    : slot.price_cents === 0
      ? "무료"
      : `₩${(slot.price_cents / 100).toLocaleString("ko-KR")}`;
  const description =
    slot.description?.slice(0, 140) ??
    `${slot.duration_min}분 · ${priceLabel} · Orbit42에서 예약하기`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      siteName: "Orbit42",
      locale: "ko_KR",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
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
  const attachedMenus = await listMenusForSlot(slot.id);

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
        {(slot.valid_from || slot.valid_until) && (
          <p className="mt-3 text-xs text-charcoal-500">
            {formatWindow(slot.valid_from, slot.valid_until)}
          </p>
        )}
        {attachedMenus.length > 0 && (
          <div className="mt-4 space-y-1.5 border-t border-charcoal-800/40 pt-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-charcoal-500">
              포함되는 서비스
            </p>
            <ul className="space-y-1">
              {attachedMenus.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="text-charcoal-200">{m.name}</span>
                  <span className="shrink-0 text-xs font-semibold text-charcoal-400">
                    {m.price_cents === 0
                      ? "Free"
                      : `+ ₩${(m.price_cents / 100).toLocaleString("ko-KR")}`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
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
  const [options, menus] = await Promise.all([
    getBookableOptions(slot),
    listMenusForSlot(slot.id),
  ]);
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
          <SlotDatePreview options={options} />
        </div>
      ) : (
        <div className="mt-4">
          <BookingForm
            slotId={slot.id}
            options={options}
            loggedIn={!!session}
            priceCents={slot.price_cents}
            slotTitle={slot.title}
            menus={menus.map((m) => ({
              id: m.id,
              name: m.name,
              category: m.category,
              description: m.description,
              price_cents: m.price_cents,
            }))}
          />
        </div>
      )}
    </section>
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
