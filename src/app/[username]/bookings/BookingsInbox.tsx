"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateBookingStatus } from "@/lib/slots";
import type { BookingRow } from "@/lib/slots";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-red-600/20 text-red-300",
  confirmed: "bg-emerald-600/20 text-emerald-300",
  canceled: "bg-charcoal-700/40 text-charcoal-500",
  completed: "bg-red-600/20 text-red-300",
};

export default function BookingsInbox({ initial }: { initial: BookingRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const upcoming = initial.filter((b) => new Date(b.scheduled_at) >= new Date());
  const past = initial.filter((b) => new Date(b.scheduled_at) < new Date());

  const update = (id: string, status: "confirmed" | "canceled" | "completed") =>
    startTransition(async () => {
      await updateBookingStatus(id, status);
      router.refresh();
    });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-charcoal-100">Bookings</h1>
        <p className="mt-1 text-sm text-charcoal-500">
          내 슬롯에 들어온 예약을 한곳에서 관리하세요.
        </p>
      </div>

      <Section title="Upcoming" rows={upcoming} update={update} pending={pending} />
      <Section title="Past" rows={past} update={update} pending={pending} muted />
    </div>
  );
}

function Section({
  title,
  rows,
  update,
  pending,
  muted,
}: {
  title: string;
  rows: BookingRow[];
  update: (id: string, status: "confirmed" | "canceled" | "completed") => void;
  pending: boolean;
  muted?: boolean;
}) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-charcoal-200">
        {title} ({rows.length})
      </h2>
      {rows.length === 0 ? (
        <p className="text-sm text-charcoal-500">없음</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((b) => (
            <li
              key={b.id}
              className={`rounded-xl border border-charcoal-800/60 bg-charcoal-900/30 p-4 ${
                muted ? "opacity-70" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                        STATUS_STYLES[b.status] ?? "bg-charcoal-700/40 text-charcoal-500"
                      }`}
                    >
                      {b.status}
                    </span>
                    <p className="truncate text-sm font-semibold text-charcoal-100">
                      {b.slot.title}
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-charcoal-500">
                    {new Date(b.scheduled_at).toLocaleString("ko-KR", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      weekday: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  <p className="mt-2 text-sm text-charcoal-300">
                    {b.guest
                      ? `${b.guest.display_name || b.guest.username} (@${b.guest.username})`
                      : `${b.guest_name ?? "Guest"}${b.guest_email ? ` · ${b.guest_email}` : ""}`}
                  </p>
                  {b.message && (
                    <p className="mt-2 rounded-md bg-charcoal-800/40 px-3 py-2 text-xs text-charcoal-400">
                      {b.message}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  {b.status !== "confirmed" && b.status !== "canceled" && (
                    <button
                      onClick={() => update(b.id, "confirmed")}
                      disabled={pending}
                      className="rounded-md border border-emerald-700/40 px-2.5 py-1 text-xs text-emerald-300 hover:bg-emerald-700/20"
                    >
                      Confirm
                    </button>
                  )}
                  {b.status !== "canceled" && b.status !== "completed" && (
                    <button
                      onClick={() => update(b.id, "canceled")}
                      disabled={pending}
                      className="rounded-md border border-charcoal-700 px-2.5 py-1 text-xs text-charcoal-400 hover:border-red-500/60 hover:text-red-400"
                    >
                      Cancel
                    </button>
                  )}
                  {b.status !== "completed" && b.status !== "canceled" && (
                    <button
                      onClick={() => update(b.id, "completed")}
                      disabled={pending}
                      className="rounded-md border border-red-700/40 px-2.5 py-1 text-xs text-red-300 hover:bg-red-700/20"
                    >
                      Done
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
