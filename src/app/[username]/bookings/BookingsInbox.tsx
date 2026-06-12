"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  updateBookingStatus,
  cancelMyBooking,
  rescheduleMyBooking,
  refreshBookableOptions,
} from "@/lib/slots";
import type { BookingRow, GuestBookingRow, BookableOption } from "@/lib/slots";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmDialog";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-800 ring-1 ring-amber-500/40 dark:text-amber-200 dark:ring-0",
  confirmed: "bg-emerald-500/15 text-emerald-800 ring-1 ring-emerald-500/40 dark:text-emerald-200 dark:ring-0",
  canceled: "bg-charcoal-700/40 text-charcoal-500",
  completed: "bg-charcoal-700/40 text-charcoal-600 dark:text-charcoal-300",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "대기",
  confirmed: "확정",
  canceled: "취소",
  completed: "완료",
};

type Tab = "host" | "guest";

export default function BookingsInbox({
  username,
  hostBookings,
  guestBookings,
  isMock = false,
}: {
  username: string;
  hostBookings: BookingRow[];
  guestBookings: GuestBookingRow[];
  isMock?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tab, setTab] = useState<Tab>(
    hostBookings.length === 0 && guestBookings.length > 0 ? "guest" : "host",
  );

  const upcoming = hostBookings.filter(
    (b) => new Date(b.scheduled_at) >= new Date(),
  );
  const past = hostBookings.filter(
    (b) => new Date(b.scheduled_at) < new Date(),
  );
  const guestUpcoming = guestBookings.filter(
    (b) => new Date(b.scheduled_at) >= new Date(),
  );
  const guestPast = guestBookings.filter(
    (b) => new Date(b.scheduled_at) < new Date(),
  );

  const pendingCount = upcoming.filter((b) => b.status === "pending").length;
  const confirmedCount = upcoming.filter((b) => b.status === "confirmed").length;

  const update = (id: string, status: "confirmed" | "canceled" | "completed") => {
    if (isMock) return;
    startTransition(async () => {
      await updateBookingStatus(id, status);
      router.refresh();
    });
  };

  const toast = useToast();
  const confirm = useConfirm();
  const cancelSelf = async (id: string) => {
    const ok = await confirm({
      title: "이 예약을 취소할까요?",
      body: "호스트에게도 취소 알림이 전송돼요.",
      confirmLabel: "예약 취소",
      danger: true,
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await cancelMyBooking(id);
      if (res.error) toast.error(res.error);
      else toast.success("예약을 취소했어요.");
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-charcoal-100">예약</h1>
          <p className="mt-1 text-sm text-charcoal-500">
            받은 예약과 내가 한 예약을 한곳에서 볼 수 있어요.
          </p>
        </div>
        {tab === "host" && (
          <div className="flex gap-2">
            <Stat label="승인 대기" value={pendingCount} accent />
            <Stat label="예정" value={confirmedCount} />
            <Stat label="지난 예약" value={past.length} muted />
          </div>
        )}
      </header>

      <div className="flex rounded-md bg-charcoal-800/40 p-0.5">
        <TabButton active={tab === "host"} onClick={() => setTab("host")}>
          받은 예약 {hostBookings.length > 0 && `(${hostBookings.length})`}
        </TabButton>
        <TabButton active={tab === "guest"} onClick={() => setTab("guest")}>
          내가 한 예약 {guestBookings.length > 0 && `(${guestBookings.length})`}
        </TabButton>
      </div>

      {isMock && tab === "host" && (
        <div className="rounded-lg border border-red-700/40 bg-red-700/10 px-4 py-2 text-xs text-red-200">
          샘플 데이터 미리보기 — URL에서 <code>?mock=1</code> 제거 시 실제 데이터로 복귀합니다.
        </div>
      )}

      {tab === "host" ? (
        <>
          <HostSection
            title="예정된 예약"
            rows={upcoming}
            update={update}
            pending={pending}
            emptyHint="아직 예정된 예약이 없어요."
          />
          <HostSection
            title="지난 예약"
            rows={past}
            update={update}
            pending={pending}
            muted
            emptyHint="지난 예약이 없어요."
          />
        </>
      ) : (
        <>
          <GuestSection
            title="예정된 예약"
            rows={guestUpcoming}
            username={username}
            onCancel={cancelSelf}
            pending={pending}
            emptyHint="아직 예정된 예약이 없어요. 오르빗을 둘러보고 시간을 잡아보세요."
          />
          <GuestSection
            title="지난 예약"
            rows={guestPast}
            username={username}
            onCancel={cancelSelf}
            pending={pending}
            muted
            emptyHint="지난 예약이 없어요."
          />
        </>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-[5px] px-3 py-1.5 text-xs font-semibold transition-colors ${
        active
          ? "bg-red-600 text-white shadow-sm"
          : "text-charcoal-500 hover:text-charcoal-900 dark:text-charcoal-400 dark:hover:text-charcoal-100"
      }`}
    >
      {children}
    </button>
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
            ? "text-red-700 dark:text-red-300"
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

function SectionHeader({
  title,
  count,
}: {
  title: string;
  count: number;
}) {
  return (
    <div className="flex items-baseline justify-between">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-charcoal-500">
        {title}
      </h2>
      <span className="text-xs text-charcoal-500">{count}</span>
    </div>
  );
}

function EmptyCard({ hint }: { hint: string }) {
  return (
    <div className="rounded-xl border border-dashed border-charcoal-800/60 bg-charcoal-900/20 px-5 py-6 text-center">
      <p className="text-sm text-charcoal-500">{hint}</p>
    </div>
  );
}

function DateStamp({ iso }: { iso: string }) {
  const d = new Date(iso);
  return (
    <div className="flex w-14 shrink-0 flex-col items-center rounded-lg bg-charcoal-800/40 px-2 py-2 text-center">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-charcoal-500">
        {d.toLocaleDateString("ko-KR", { month: "short" })}
      </span>
      <span className="mt-0.5 text-xl font-bold tabular-nums text-charcoal-100">
        {d.getDate()}
      </span>
      <span className="text-[10px] text-charcoal-500">
        {d.toLocaleDateString("ko-KR", { weekday: "short" })}
      </span>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
        STATUS_STYLES[status] ?? "bg-charcoal-700/40 text-charcoal-500"
      }`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function TimeLine({ start, end }: { start: Date; end: Date }) {
  return (
    <p className="mt-0.5 text-xs tabular-nums text-charcoal-500">
      {start.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
      {" – "}
      {end.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
    </p>
  );
}

function HostSection({
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
      <SectionHeader title={title} count={rows.length} />
      {rows.length === 0 ? (
        <EmptyCard hint={emptyHint} />
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
                className={`rounded-xl border border-charcoal-800/60 bg-charcoal-900/30 p-4 ${
                  muted ? "opacity-70" : ""
                }`}
              >
                <div className="flex items-start gap-4">
                  <DateStamp iso={b.scheduled_at} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-charcoal-100">
                        {b.slot.title}
                      </p>
                      <StatusPill status={b.status} />
                    </div>
                    <TimeLine start={start} end={end} />
                    <p className="mt-2 text-sm text-charcoal-200">
                      {guestLabel}
                      {guestSub && (
                        <span className="ml-1.5 text-xs text-charcoal-500">
                          {guestSub}
                        </span>
                      )}
                    </p>
                    {b.selected_menus && b.selected_menus.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {b.selected_menus.map((m) => (
                          <span
                            key={m.id}
                            className="inline-flex items-center gap-1 rounded-md bg-red-500/10 px-2 py-0.5 text-[11px] text-red-700 ring-1 ring-red-500/30 dark:text-red-200 dark:ring-0"
                          >
                            {m.name}
                            <span className="text-charcoal-500">
                              {m.price_cents === 0
                                ? "· Free"
                                : `· ₩${(m.price_cents / 100).toLocaleString("ko-KR")}`}
                            </span>
                          </span>
                        ))}
                      </div>
                    )}
                    {b.message && (
                      <p className="mt-2 rounded-md bg-charcoal-800/40 px-3 py-2 text-xs leading-relaxed text-charcoal-400">
                        {b.message}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    {b.status === "pending" && (
                      <button
                        onClick={() => update(b.id, "confirmed")}
                        disabled={pending}
                        className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                      >
                        수락
                      </button>
                    )}
                    {b.status !== "canceled" && b.status !== "completed" && (
                      <button
                        onClick={() => update(b.id, "canceled")}
                        disabled={pending}
                        className="rounded-md border border-charcoal-700 px-3 py-1 text-xs text-charcoal-400 hover:border-red-500/60 hover:text-red-500"
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

function GuestSection({
  title,
  rows,
  onCancel,
  pending,
  muted,
  emptyHint,
}: {
  title: string;
  rows: GuestBookingRow[];
  username: string;
  onCancel: (id: string) => void;
  pending: boolean;
  muted?: boolean;
  emptyHint: string;
}) {
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);
  return (
    <section className="space-y-3">
      <SectionHeader title={title} count={rows.length} />
      {rows.length === 0 ? (
        <EmptyCard hint={emptyHint} />
      ) : (
        <ul className="space-y-2">
          {rows.map((b) => {
            const start = new Date(b.scheduled_at);
            const end = new Date(b.scheduled_end_at);
            const hostLabel = b.host
              ? b.host.display_name || b.host.username
              : "Host";
            return (
              <li
                key={b.id}
                className={`rounded-xl border border-charcoal-800/60 bg-charcoal-900/30 p-4 ${
                  muted ? "opacity-70" : ""
                }`}
              >
                <div className="flex items-start gap-4">
                  <DateStamp iso={b.scheduled_at} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-charcoal-100">
                        {b.slot.title}
                      </p>
                      <StatusPill status={b.status} />
                    </div>
                    <TimeLine start={start} end={end} />
                    {b.host && (
                      <p className="mt-2 text-sm text-charcoal-200">
                        <Link
                          href={`/${b.host.username}`}
                          className="hover:underline"
                        >
                          {hostLabel}
                        </Link>
                        <span className="ml-1.5 text-xs text-charcoal-500">
                          @{b.host.username}
                        </span>
                      </p>
                    )}
                    {b.slot.location_detail && (
                      <p className="mt-0.5 text-xs text-charcoal-500">
                        📍 {b.slot.location_detail}
                      </p>
                    )}
                    {b.message && (
                      <p className="mt-2 rounded-md bg-charcoal-800/40 px-3 py-2 text-xs leading-relaxed text-charcoal-400">
                        {b.message}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    {b.host && (
                      <Link
                        href={`/${b.host.username}/s/${b.slot.slug}`}
                        className="rounded-md border border-charcoal-800 px-2.5 py-1 text-center text-xs text-charcoal-400 hover:border-charcoal-700 hover:text-charcoal-100"
                      >
                        슬롯
                      </Link>
                    )}
                    {b.status !== "canceled" && b.status !== "completed" && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            setReschedulingId((cur) =>
                              cur === b.id ? null : b.id,
                            )
                          }
                          disabled={pending}
                          className="rounded-md border border-charcoal-800 px-2.5 py-1 text-xs text-charcoal-400 hover:border-charcoal-600 hover:text-charcoal-100 disabled:opacity-50"
                        >
                          시간 변경
                        </button>
                        <button
                          type="button"
                          onClick={() => onCancel(b.id)}
                          disabled={pending}
                          className="rounded-md border border-charcoal-800 px-2.5 py-1 text-xs text-charcoal-400 hover:border-red-500/60 hover:text-red-500 disabled:opacity-50"
                        >
                          취소
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {reschedulingId === b.id && (
                  <ReschedulePanel
                    booking={b}
                    onDone={() => setReschedulingId(null)}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function ReschedulePanel({
  booking,
  onDone,
}: {
  booking: GuestBookingRow;
  onDone: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [options, setOptions] = useState<BookableOption[] | null>(null);
  const [picked, setPicked] = useState("");
  const [saving, startSaving] = useTransition();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const opts = await refreshBookableOptions(booking.slot.id, null).catch(
        () => [],
      );
      if (!cancelled) setOptions(opts.slice(0, 120));
    })();
    return () => {
      cancelled = true;
    };
  }, [booking.slot.id]);

  const submit = () => {
    const opt = (options ?? []).find((o) => o.start_at === picked);
    if (!opt) return;
    startSaving(async () => {
      const res = await rescheduleMyBooking(booking.id, {
        startAt: opt.availability_id ? undefined : opt.start_at,
        availabilityId: opt.availability_id ?? undefined,
      });
      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(
        "status" in res && res.status === "pending"
          ? "시간을 변경했어요. 호스트 승인을 기다려주세요."
          : "예약 시간을 변경했어요.",
      );
      onDone();
      router.refresh();
    });
  };

  return (
    <div className="mt-3 rounded-lg border border-charcoal-800/60 bg-charcoal-900/40 p-3">
      {options === null ? (
        <p className="text-xs text-charcoal-500">가능한 시간을 불러오는 중…</p>
      ) : options.length === 0 ? (
        <p className="text-xs text-charcoal-500">
          지금은 옮길 수 있는 시간이 없어요. 호스트에게 메시지로 문의해보세요.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={picked}
            onChange={(e) => setPicked(e.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-charcoal-800/60 bg-[rgb(var(--bg-surface))] px-3 py-1.5 text-xs text-charcoal-100 focus:border-charcoal-600 focus:outline-none"
          >
            <option value="">새 시간 선택…</option>
            {options.map((o) => (
              <option key={o.start_at} value={o.start_at}>
                {new Date(o.start_at).toLocaleString("ko-KR", {
                  timeZone: "Asia/Seoul",
                  month: "long",
                  day: "numeric",
                  weekday: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={submit}
            disabled={!picked || saving}
            className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "변경 중…" : "변경"}
          </button>
        </div>
      )}
    </div>
  );
}
