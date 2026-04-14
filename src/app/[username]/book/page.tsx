import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProfile, getSession } from "@/lib/auth";
import {
  listPublicSlotsByUsername,
  getBookableOptions,
  type TimeSlot,
  type BookableOption,
} from "@/lib/slots";
import { Avatar } from "@/components/Avatar";
import BookingForm from "../s/[slug]/BookingForm";
import { CopyShareLink } from "./CopyShareLink";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { username: string };
}): Promise<Metadata> {
  const profile = await getProfile(params.username);
  if (!profile) return { title: "Book" };
  const name = profile.display_name || profile.username;
  return {
    title: `${name}와 미팅 잡기 · Orbit42`,
    description: `${name}의 예약 가능한 시간을 바로 잡아보세요.`,
  };
}

export default async function BookingSharePage({
  params,
}: {
  params: { username: string };
}) {
  const profile = await getProfile(params.username);
  if (!profile) notFound();

  const session = await getSession();
  const isOwner = session?.username === params.username;

  const allSlots = await listPublicSlotsByUsername(params.username);
  // Share page is for fixed-price (manual or auto) bookable slots only;
  // auction slots live on their own dedicated page.
  const slots = allSlots.filter((s) => s.pricing_model === "fixed" && s.active);

  const slotsWithOptions = await Promise.all(
    slots.map(async (s) => ({
      slot: s,
      options: await getBookableOptions(s),
    })),
  );
  const bookable = slotsWithOptions.filter((s) => s.options.length > 0);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="rounded-2xl border border-charcoal-800/60 bg-charcoal-900/30 p-6">
        <div className="flex items-center gap-4">
          <Avatar
            url={(profile.avatar_url as string | null) ?? null}
            name={profile.display_name || profile.username}
            size={64}
          />
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-charcoal-100 md:text-2xl">
              {profile.display_name || profile.username}와 미팅 잡기
            </h1>
            <p className="text-sm text-charcoal-500">@{profile.username}</p>
          </div>
        </div>
        {profile.bio && (
          <p className="mt-4 text-sm leading-relaxed text-charcoal-300">
            {profile.bio}
          </p>
        )}
        {isOwner && (
          <div className="mt-4 flex items-center justify-between gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2">
            <p className="text-xs text-amber-300">
              이 페이지가 공유용 예약 링크예요. 내 다른 일정은 보이지 않고,
              예약 가능한 슬롯만 노출됩니다.
            </p>
            <CopyShareLink username={params.username} />
          </div>
        )}
      </header>

      {bookable.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-charcoal-800/60 p-10 text-center">
          <p className="text-sm font-semibold text-charcoal-200">
            지금은 예약 가능한 시간이 없어요
          </p>
          <p className="mt-2 text-sm text-charcoal-500">
            {isOwner
              ? "Slots에서 시간을 열거나 Auto 모드를 설정해보세요."
              : "조금 뒤에 다시 확인해주세요."}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {bookable.map((row) => (
            <SlotBookRow
              key={row.slot.id}
              slot={row.slot}
              options={row.options}
              loggedIn={!!session}
              isOwner={isOwner}
            />
          ))}
        </div>
      )}

      <p className="pt-4 text-center text-xs text-charcoal-600">
        <Link href={`/${params.username}`} className="hover:text-charcoal-400">
          {profile.display_name || profile.username}의 프로필 보기 →
        </Link>
      </p>
    </div>
  );
}

function SlotBookRow({
  slot,
  options,
  loggedIn,
  isOwner,
}: {
  slot: TimeSlot;
  options: BookableOption[];
  loggedIn: boolean;
  isOwner: boolean;
}) {
  return (
    <section className="rounded-2xl border border-charcoal-800/60 bg-charcoal-900/30 p-5">
      <div className="flex items-baseline justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-charcoal-100">{slot.title}</h2>
          <p className="mt-0.5 text-xs text-charcoal-500">
            {slot.duration_min}분 · {slot.slot_type}
            {slot.location_detail && ` · ${slot.location_detail}`}
          </p>
        </div>
        <span className="shrink-0 rounded-md bg-amber-500/15 px-2 py-0.5 text-xs font-bold text-amber-300">
          {slot.price_cents === 0
            ? "FREE"
            : `₩${(slot.price_cents / 100).toLocaleString("ko-KR")}`}
        </span>
      </div>
      {slot.description && (
        <p className="mt-2 text-sm text-charcoal-400">{slot.description}</p>
      )}

      {isOwner ? (
        <p className="mt-4 text-xs text-charcoal-500">
          본인은 예약할 수 없어요. 공유 링크를 외부에 보낼 때 이렇게 보입니다.
        </p>
      ) : (
        <div className="mt-4 border-t border-charcoal-800/40 pt-4">
          <BookingForm
            slotId={slot.id}
            options={options}
            loggedIn={loggedIn}
            priceCents={slot.price_cents}
            slotTitle={slot.title}
          />
        </div>
      )}
    </section>
  );
}
