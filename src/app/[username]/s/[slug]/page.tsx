import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSlotBySlug, getBookableOptions } from "@/lib/slots";
import { getSession } from "@/lib/auth";
import BookingForm from "./BookingForm";

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

  const [options, session] = await Promise.all([
    getBookableOptions(slot),
    getSession(),
  ]);

  const isOwner = session?.username === params.username;

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
          <span className="ml-auto rounded-full bg-charcoal-800/60 px-2 py-0.5 text-[10px] font-medium uppercase text-charcoal-400">
            {slot.mode}
          </span>
        </div>
        <p className="mt-2 text-sm text-charcoal-400">
          {slot.duration_min}분 ·{" "}
          {slot.price_cents === 0
            ? "Free"
            : `${(slot.price_cents / 100).toLocaleString("ko-KR")}원`}
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

      <section className="rounded-2xl border border-charcoal-800/60 bg-charcoal-900/30 p-6">
        <h2 className="text-sm font-semibold text-charcoal-200">예약 가능한 시간</h2>
        {!slot.active ? (
          <p className="mt-3 text-sm text-charcoal-500">현재 예약을 받지 않는 슬롯이에요.</p>
        ) : options.length === 0 ? (
          <p className="mt-3 text-sm text-charcoal-500">
            예약 가능한 시간이 없어요. 잠시 후 다시 확인해주세요.
          </p>
        ) : isOwner ? (
          <p className="mt-3 text-sm text-charcoal-500">
            본인은 예약할 수 없어요. (Slots에서 가능 시간을 관리할 수 있습니다.)
          </p>
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

    </div>
  );
}
