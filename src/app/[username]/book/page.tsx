import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProfile, getSession } from "@/lib/auth";
import { listPublicSlotsByUsername, getBookableOptions } from "@/lib/slots";
import { Avatar } from "@/components/Avatar";
import { BookingCalendar, type BookSlot } from "./BookingCalendar";
import { CopyShareLink } from "./CopyShareLink";
import { PoweredByCta } from "@/components/PoweredByCta";

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
  const fixed = allSlots.filter((s) => s.pricing_model === "fixed" && s.active);
  const withOptions: BookSlot[] = await Promise.all(
    fixed.map(async (s) => ({
      id: s.id,
      slug: s.slug,
      title: s.title,
      description: s.description ?? null,
      duration_min: s.duration_min,
      price_cents: s.price_cents,
      slot_type: s.slot_type,
      location_detail: s.location_detail,
      options: (await getBookableOptions(s)).map((o) => ({
        availability_id: o.availability_id,
        start_at: o.start_at,
        end_at: o.end_at,
      })),
    })),
  );

  const hostName = profile.display_name || profile.username;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="rounded-2xl border border-charcoal-800/60 bg-charcoal-900/30 p-6">
        <div className="flex items-center gap-4">
          <Avatar
            url={(profile.avatar_url as string | null) ?? null}
            name={hostName}
            size={56}
          />
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-charcoal-100 md:text-2xl">
              {hostName}와 미팅 잡기
            </h1>
            <p className="text-sm text-charcoal-500">@{profile.username}</p>
          </div>
        </div>
        {profile.bio && (
          <p className="mt-3 text-sm leading-relaxed text-charcoal-300">
            {profile.bio}
          </p>
        )}
        {isOwner && (
          <div className="mt-4 flex items-center justify-between gap-2 rounded-lg border border-red-500/40 bg-red-500/5 px-3 py-2">
            <p className="text-xs text-red-300">
              이 페이지가 공유용 예약 링크예요. 내 다른 일정은 보이지 않고,
              예약 가능한 슬롯만 노출됩니다.
            </p>
            <CopyShareLink username={params.username} />
          </div>
        )}
      </header>

      <BookingCalendar
        slots={withOptions}
        hostName={hostName}
        loggedIn={!!session}
      />

      {!session && <PoweredByCta hostUsername={params.username} />}

      <p className="pt-2 text-center text-xs text-charcoal-600">
        <Link href={`/${params.username}`} className="hover:text-charcoal-400">
          {hostName}의 프로필 보기 →
        </Link>
      </p>
    </div>
  );
}
