import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSlotBySlug, getBookableOptions, getUpcomingAvailabilities } from "@/lib/slots";
import { listBids } from "@/lib/auctions";
import { listMenusForSlot } from "@/lib/menus";
import { getSession } from "@/lib/auth";
import BookingForm from "./BookingForm";
import AuctionPanel from "./AuctionPanel";
import OwnerBookingPreview from "./OwnerBookingPreview";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { PoweredByCta } from "@/components/PoweredByCta";
import { getHostRating, listHostReviews } from "@/lib/reviews";
import { Avatar } from "@/components/Avatar";
import { SITE, slotTypeLabel } from "@/lib/constants";
import { JsonLd } from "@/components/JsonLd";

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
  const title = `${slot.title} · ${hostName}`;
  const isAuction = slot.pricing_model === "auction";
  const priceLabel = isAuction
    ? `경매 · 시작가 ₩${((slot.reserve_price_cents ?? 0) / 100).toLocaleString("ko-KR")}`
    : slot.price_cents === 0
      ? "무료"
      : `₩${(slot.price_cents / 100).toLocaleString("ko-KR")}`;
  const description =
    slot.description?.slice(0, 140) ??
    `${slot.duration_min}분 · ${priceLabel} · Orbit42에서 예약하기`;
  // Prefer the host-uploaded cover image for link previews; fall back to
  // the auto-generated opengraph-image.tsx card when none exists.
  const coverImage = slot.image_urls?.[0];
  const images = coverImage ? [{ url: coverImage, alt: slot.title }] : undefined;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      siteName: "Orbit42",
      locale: "ko_KR",
      ...(images ? { images } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(coverImage ? { images: [coverImage] } : {}),
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
  const [attachedMenus, hostRating, hostReviews] = await Promise.all([
    listMenusForSlot(slot.id),
    getHostRating(slot.host_id),
    listHostReviews(slot.host_id, 3),
  ]);

  const slotUrl = `${SITE.url}/${params.username}/s/${slot.slug}`;
  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: slot.title,
    description:
      slot.description ||
      `${slot.duration_min}분 · ${host.display_name || host.username}의 타임슬롯`,
    url: slotUrl,
    category: slot.slot_type || "TimeSlot",
    brand: {
      "@type": "Person",
      name: host.display_name || host.username,
      url: `${SITE.url}/${host.username}`,
    },
    offers: isAuction
      ? {
          "@type": "AggregateOffer",
          priceCurrency: "KRW",
          lowPrice: ((slot.reserve_price_cents ?? 0) / 100).toString(),
          offerCount: 1,
          availability: slot.active
            ? "https://schema.org/InStock"
            : "https://schema.org/OutOfStock",
          url: slotUrl,
        }
      : {
          "@type": "Offer",
          priceCurrency: "KRW",
          price: (slot.price_cents / 100).toString(),
          availability: slot.active
            ? "https://schema.org/InStock"
            : "https://schema.org/OutOfStock",
          url: slotUrl,
        },
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <JsonLd data={productSchema} />
      {isOwner ? (
        <Link
          href={`/${params.username}/slots`}
          className="inline-flex items-center gap-1 text-xs text-charcoal-500 hover:text-charcoal-300"
        >
          ← Timeslots
        </Link>
      ) : (
        // 방문자에게는 "누구의 시간인지"를 먼저 보여준다 (SNS 에서 바로 들어오는 링크)
        <Link
          href={`/${params.username}`}
          className="flex items-center gap-3 rounded-2xl border border-charcoal-800/60 bg-[rgb(var(--bg-surface))] px-4 py-3 transition-colors hover:border-charcoal-700"
        >
          {host.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={host.avatar_url as string}
              alt=""
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-navy-500/20 text-sm font-bold text-navy-400">
              {(host.display_name || host.username).slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-charcoal-100">
              {host.display_name || host.username}
            </span>
            <span className="block truncate text-xs text-charcoal-500">
              @{host.username} · 다른 시간도 보기
            </span>
          </span>
          <span className="text-charcoal-600">›</span>
        </Link>
      )}

      <header className="overflow-hidden rounded-2xl border border-charcoal-800/60 bg-charcoal-900/30">
        {slot.image_urls && slot.image_urls.length > 0 && (
          <div
            className={`grid gap-1 ${
              slot.image_urls.length === 1
                ? "grid-cols-1"
                : slot.image_urls.length === 2
                  ? "grid-cols-2"
                  : "grid-cols-2 sm:grid-cols-3"
            }`}
          >
            {slot.image_urls.slice(0, 6).map((url) => (
              <div
                key={url}
                className="relative aspect-[4/3] bg-charcoal-800/40"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
        )}
        <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start gap-x-2 gap-y-1.5">
          <h1 className="min-w-0 flex-1 break-words text-xl font-bold leading-tight text-charcoal-100 sm:text-2xl">
            {slot.title}
          </h1>
          <div className="flex shrink-0 items-center gap-1.5">
            {!slot.active && (
              <span className="rounded-full bg-charcoal-700/40 px-2 py-0.5 text-[10px] font-semibold text-charcoal-500">
                OFF
              </span>
            )}
            {(isAuction || isOwner) && (
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                  isAuction
                    ? "bg-navy-400/20 text-navy-300"
                    : "bg-charcoal-800/60 text-charcoal-400"
                }`}
              >
                {isAuction ? "경매" : slot.mode === "auto" ? "자동" : "직접"}
              </span>
            )}
            <CopyLinkButton url={`${SITE.url}/${params.username}/s/${slot.slug}`} />
          </div>
        </div>
        {hostRating && (
          <p className="mt-2 flex items-center gap-1 text-xs text-charcoal-400">
            <span className="text-amber-400">★</span>
            <span className="font-semibold text-charcoal-200">
              {hostRating.average.toFixed(1)}
            </span>
            <span className="text-charcoal-500">후기 {hostRating.count}개</span>
          </p>
        )}
        <p className="mt-2 text-sm text-charcoal-400">
          {slot.duration_min}분 ·{" "}
          {isAuction
            ? `시작가 ₩${((slot.reserve_price_cents ?? 0) / 100).toLocaleString("ko-KR")}`
            : slot.price_cents === 0
              ? "Free"
              : `₩${(slot.price_cents / 100).toLocaleString("ko-KR")}`}
          {" · "}
          {slotTypeLabel(slot.slot_type)}
          {(() => {
            const locs =
              slot.locations && slot.locations.length > 0
                ? slot.locations
                : slot.location_detail
                  ? [slot.location_detail]
                  : [];
            return locs.length > 0 ? ` · ${locs.join(" / ")}` : "";
          })()}
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
        </div>
      </header>

      {isAuction ? (
        <AuctionSection
          slot={slot}
          username={params.username}
          loggedIn={!!session}
          isOwner={isOwner}
        />
      ) : (
        <BookingSection
          slot={slot}
          username={params.username}
          hostLabel={host.display_name || host.username}
          session={session}
          isOwner={isOwner}
        />
      )}

      {hostReviews.length > 0 && (
        <section className="rounded-2xl border border-charcoal-800/60 bg-charcoal-900/30 p-6">
          <h2 className="text-sm font-semibold text-charcoal-200">
            후기
            {hostRating && (
              <span className="ml-2 text-xs font-normal text-charcoal-500">
                <span className="text-amber-400">★</span>{" "}
                {hostRating.average.toFixed(1)} · {hostRating.count}개
              </span>
            )}
          </h2>
          <ul className="mt-4 space-y-4">
            {hostReviews.map((r) => (
              <li key={r.id} className="flex items-start gap-3">
                <Link
                  href={r.reviewer ? `/${r.reviewer.username}` : "#"}
                  className="shrink-0"
                >
                  <Avatar
                    url={r.reviewer?.avatar_url ?? null}
                    name={
                      r.reviewer?.display_name || r.reviewer?.username || "익명"
                    }
                    size={32}
                  />
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="text-xs font-semibold text-charcoal-100">
                      {r.reviewer?.display_name || r.reviewer?.username || "익명"}
                    </span>
                    <span className="text-xs text-amber-400">
                      {"★".repeat(r.rating)}
                    </span>
                    {r.slot_title && (
                      <span className="text-[11px] text-charcoal-600">
                        {r.slot_title}
                      </span>
                    )}
                  </div>
                  {r.body && (
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-charcoal-300">
                      {r.body}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!session && <PoweredByCta hostUsername={params.username} />}

      {!isOwner && !session && (
        <div className="pt-2 text-center">
          <Link
            href={`/signup?ref=${params.username}`}
            className="inline-block rounded-full bg-charcoal-100 px-6 py-3 text-sm font-bold text-charcoal-950 transition-transform hover:scale-[1.02]"
          >
            나도 예약 링크 만들기
          </Link>
          <p className="mt-3 text-[11px] text-charcoal-600">
            orbit42 · 링크 하나로 내 시간을 예약받아요
          </p>
        </div>
      )}
    </div>
  );
}

async function BookingSection({
  slot,
  username,
  hostLabel,
  session,
  isOwner,
}: {
  slot: import("@/lib/slots").TimeSlot;
  username: string;
  hostLabel: string;
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
        <OwnerBookingPreview
          slotId={slot.id}
          options={options}
          locations={
            slot.locations && slot.locations.length > 0
              ? slot.locations
              : slot.location_detail
                ? [slot.location_detail]
                : []
          }
        />
      ) : (
        <div className="mt-4">
          <BookingForm
            slotId={slot.id}
            options={options}
            loggedIn={!!session}
            priceCents={slot.price_cents}
            slotTitle={slot.title}
            hostUsername={username}
            hostLabel={hostLabel}
            locations={
              slot.locations && slot.locations.length > 0
                ? slot.locations
                : slot.location_detail
                  ? [slot.location_detail]
                  : []
            }
            paymentMethod={slot.payment_method}
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
