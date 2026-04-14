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

export default function BookingsInbox({
  initial,
  isMock = false,
}: {
  initial: BookingRow[];
  isMock?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const upcoming = initial.filter((b) => new Date(b.scheduled_at) >= new Date());
  const past = initial.filter((b) => new Date(b.scheduled_at) < new Date());

  const pendingCount = upcoming.filter((b) => b.status === "pending").length;
  const confirmedCount = upcoming.filter((b) => b.status === "confirmed").length;

  const update = (id: string, status: "confirmed" | "canceled" | "completed") => {
    if (isMock) return;
    startTransition(async () => {
      await updateBookingStatus(id, status);
      router.refresh();
    });
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-charcoal-100">Bookings</h1>
          <p className="mt-1 text-sm text-charcoal-500">
            내 슬롯에 들어온 예약을 한곳에서 관리하세요.
          </p>
        </div>
        <div className="flex gap-2">
          <Stat label="승인 대기" value={pendingCount} accent />
          <Stat label="예정" value={confirmedCount} />
          <Stat label="지난 예약" value={past.length} muted />
        </div>
      </header>

      {isMock && (
        <div className="rounded-lg border border-red-700/40 bg-red-700/10 px-4 py-2 text-xs text-red-200">
          샘플 데이터 미리보기 — URL에서 <code>?mock=1</code> 제거 시 실제 데이터로 복귀합니다.
        </div>
      )}

      <Section
        title="예정된 예약"
        rows={upcoming}
        update={update}
        pending={pending}
        emptyHint="아직 예정된 예약이 없어요."
      />
      <Section
        title="지난 예약"
        rows={past}
        update={update}
        pending={pending}
        muted
        emptyHint="지난 예약이 없어요."
      />
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  muted,
}: {
  label: string;
  value: number;
  accent?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="rounded-lg border border-charcoal-800/60 bg-charcoal-900/30 px-4 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-charcoal-500">
        {label}
      </p>
      <p
        className={`mt-0.5 text-lg font-bold tabular-nums ${
          accent
            ? "text-red-300"
            : muted
              ? "text-charcoal-500"
              : "text-charcoal-100"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function Section({
  title,
  rows,
  update,
  pending,
  muted,
  emptyHint,
}: {
  title: string;
  rows: BookingRow[];
  update: (id: string, status: "confirmed" | "canceled" | "completed") => void;
  pending: boolean;
  muted?: boolean;
  emptyHint: string;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-charcoal-500">
          {title}
        </h2>
        <span className="text-xs text-charcoal-500">{rows.length}</span>
      </div>
      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-charcoal-800/60 bg-charcoal-900/20 px-5 py-6 text-center">
          <p className="text-sm text-charcoal-500">{emptyHint}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((b) => {
            const start = new Date(b.scheduled_at);
            const end = new Date(b.scheduled_end_at);
            const guestLabel = b.guest
              ? b.guest.display_name || b.guest.username
              : b.guest_name ?? "Guest";
            const guestSub = b.guest
              ? `@${b.guest.username}`
              : b.guest_email ?? "";
            return (
              <li
                key={b.id}
                className={`group rounded-xl border border-charcoal-800/60 bg-charcoal-900/30 p-4 transition-colors hover:border-charcoal-700 ${
                  muted ? "opacity-70" : ""
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="flex w-14 shrink-0 flex-col items-center rounded-lg bg-charcoal-800/40 px-2 py-2 text-center">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-charcoal-500">
                      {start.toLocaleDateString("ko-KR", { month: "short" })}
                    </span>
                    <span className="mt-0.5 text-xl font-bold tabular-nums text-charcoal-100">
                      {start.getDate()}
                    </span>
                    <span className="text-[10px] text-charcoal-500">
                      {start.toLocaleDateString("ko-KR", { weekday: "short" })}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-charcoal-100">
                        {b.slot.title}
                      </p>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                          STATUS_STYLES[b.status] ??
                          "bg-charcoal-700/40 text-charcoal-500"
                        }`}
                      >
                        {b.status}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs tabular-nums text-charcoal-500">
                      {start.toLocaleTimeString("ko-KR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {" – "}
                      {end.toLocaleTimeString("ko-KR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                    <p className="mt-2 text-sm text-charcoal-200">
                      {guestLabel}
                      {guestSub && (
                        <span className="ml-1.5 text-xs text-charcoal-500">
                          {guestSub}
                        </span>
                      )}
                    </p>
                    {b.message && (
                      <p className="mt-2 rounded-md bg-charcoal-800/40 px-3 py-2 text-xs leading-relaxed text-charcoal-400">
                        {b.message}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    {b.status !== "confirmed" &&
                      b.status !== "canceled" &&
                      b.status !== "completed" && (
                        <button
                          onClick={() => update(b.id, "confirmed")}
                          disabled={pending}
                          className="rounded-md bg-emerald-600/20 px-3 py-1 text-xs font-semibold text-emerald-300 hover:bg-emerald-600/30"
                        >
                          수락
                        </button>
                      )}
                    {b.status !== "canceled" && b.status !== "completed" && (
                      <button
                        onClick={() => update(b.id, "canceled")}
                        disabled={pending}
                        className="rounded-md border border-charcoal-700 px-3 py-1 text-xs text-charcoal-400 hover:border-red-500/60 hover:text-red-400"
                      >
                        취소
                      </button>
                    )}
                    {b.status === "confirmed" && (
                      <button
                        onClick={() => update(b.id, "completed")}
                        disabled={pending}
                        className="rounded-md border border-charcoal-700 px-3 py-1 text-xs text-charcoal-400 hover:border-charcoal-600 hover:text-charcoal-200"
                      >
                        완료
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
