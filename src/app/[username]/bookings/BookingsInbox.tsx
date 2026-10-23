"use client";

import Link from "next/link";
import { useEffect, useState, useTransition, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  updateBookingStatus,
  cancelMyBooking,
  rescheduleMyBooking,
  refreshBookableOptions,
  proposeRescheduleAsHost,
  respondToReschedule,
  withdrawReschedule,
  changeMyBookingListState,
} from "@/lib/slots";
import type { BookingRow, GuestBookingRow, BookableOption } from "@/lib/slots";
import { Segmented } from "@/components/Segmented";
import { addBookingReview } from "@/lib/reviews";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";

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

/** 보관·삭제 버튼 묶음이 어느 목록에 붙는지 — 일반 목록은 보관/삭제, 보관함은 되돌리기/삭제 (개선-28) */
type ListMode = "list" | "archive";
type ListChange = "archive" | "unarchive" | "delete";
type OnListChange = (id: string, change: ListChange) => void;

/** 진행 중(대기/확정 + 미래)이 아니면 끝난 예약 — 서버 규칙(booking-list-state)과 같다 */
function isFinished(status: string, scheduledAt: string) {
  const active =
    (status === "pending" || status === "confirmed") &&
    new Date(scheduledAt).getTime() > Date.now();
  return !active;
}

export default function BookingsInbox({
  username,
  hostBookings,
  guestBookings,
  hostArchived = [],
  guestArchived = [],
  reviewedBookingIds = [],
}: {
  username: string;
  hostBookings: BookingRow[];
  guestBookings: GuestBookingRow[];
  hostArchived?: BookingRow[];
  guestArchived?: GuestBookingRow[];
  reviewedBookingIds?: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab | "slots">(
    searchParams.get("tab") === "guest" || searchParams.get("tab") === "host"
      ? (searchParams.get("tab") as Tab)
      : hostBookings.length === 0 && guestBookings.length > 0 ? "guest" : "host",
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

  // 보관/되돌리기/삭제 — 문구는 앱과 같게 (개선-28)
  const changeListState: OnListChange = async (id, change) => {
    if (change === "archive") {
      const ok = await confirm({
        title: "이 예약을 보관할까요?",
        body: "보관함에서 언제든 다시 꺼낼 수 있어요.",
        confirmLabel: "보관",
      });
      if (!ok) return;
    } else if (change === "delete") {
      const ok = await confirm({
        title: "이 예약을 목록에서 삭제할까요?",
        body: "내 목록에서만 사라지고 상대방의 기록은 유지돼요.",
        confirmLabel: "삭제",
        danger: true,
      });
      if (!ok) return;
    }
    startTransition(async () => {
      const res = await changeMyBookingListState(id, change);
      if ("error" in res) toast.error(res.error);
      else
        toast.success(
          change === "archive"
            ? "보관했어요."
            : change === "unarchive"
              ? "목록으로 되돌렸어요."
              : "삭제했어요.",
        );
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="max-md:hidden text-2xl font-bold text-charcoal-100">예약</h1>
          <p className="mt-1 text-sm text-charcoal-500">
            받은 예약과 내가 한 예약을 한곳에서 볼 수 있어요.
          </p>
        </div>
        {tab === "host" && (
          <div className="flex gap-2">
            <Stat label="승인·입금 대기" value={pendingCount} accent />
            <Stat label="예정" value={confirmedCount} />
            <Stat label="지난 예약" value={past.length} muted />
          </div>
        )}
      </header>

      {/* iOS 예약 탭과 같은 한 줄 세 칸 — 예약 링크는 같은 탭의 세 번째 칸 */}
      <Segmented
        value={tab}
        onChange={(v) => v !== "slots" && setTab(v)}
        items={[
          { value: "host", label: "받은 예약" },
          { value: "guest", label: "내가 한 예약" },
          { value: "slots", label: "예약 링크", href: `/${username}/slots` },
        ]}
      />

      {tab === "host" ? (
        <>
          <HostSection
            title="예정된 예약"
            rows={upcoming}
            update={update}
            pending={pending}
            emptyHint="아직 예정된 예약이 없어요."
            listMode="list"
            onListChange={changeListState}
          />
          <HostSection
            title="지난 예약"
            rows={past}
            update={update}
            pending={pending}
            muted
            emptyHint="지난 예약이 없어요."
            listMode="list"
            onListChange={changeListState}
          />
          <ArchiveDrawer count={hostArchived.length}>
            <HostSection
              title="보관함"
              rows={hostArchived}
              update={update}
              pending={pending}
              muted
              emptyHint="보관한 예약이 없어요."
              listMode="archive"
              onListChange={changeListState}
            />
          </ArchiveDrawer>
        </>
      ) : (
        <>
          <GuestSection
            title="예정된 예약"
            rows={guestUpcoming}
            username={username}
            onCancel={cancelSelf}
            pending={pending}
            reviewedBookingIds={reviewedBookingIds}
            emptyHint="아직 예정된 예약이 없어요. 오르빗을 둘러보고 시간을 잡아 보세요."
            listMode="list"
            onListChange={changeListState}
          />
          <GuestSection
            title="지난 예약"
            rows={guestPast}
            username={username}
            onCancel={cancelSelf}
            pending={pending}
            reviewedBookingIds={reviewedBookingIds}
            muted
            emptyHint="지난 예약이 없어요."
            listMode="list"
            onListChange={changeListState}
          />
          <ArchiveDrawer count={guestArchived.length}>
            <GuestSection
              title="보관함"
              rows={guestArchived}
              username={username}
              onCancel={cancelSelf}
              pending={pending}
              reviewedBookingIds={reviewedBookingIds}
              muted
              emptyHint="보관한 예약이 없어요."
              listMode="archive"
              onListChange={changeListState}
            />
          </ArchiveDrawer>
        </>
      )}
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
      <p className="text-2xs font-semibold uppercase tracking-wider text-charcoal-500">
        {label}
      </p>
      <p
        className={`mt-0.5 text-lg font-bold tabular-nums ${
          accent
            ? "text-navy-600 dark:text-navy-300"
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

/** 끝난 예약의 보관(되돌리기)·삭제 — 작은 보조 버튼 두 개 (개선-28) */
function ListStateButtons({
  mode,
  disabled,
  onChange,
}: {
  mode: ListMode;
  disabled: boolean;
  onChange: (change: ListChange) => void;
}) {
  return (
    <div className="flex gap-1">
      <button
        type="button"
        onClick={() => onChange(mode === "archive" ? "unarchive" : "archive")}
        disabled={disabled}
        className="flex-1 whitespace-nowrap rounded-lg border border-charcoal-800 px-2.5 py-1 text-xs text-charcoal-400 hover:border-navy-400/60 hover:text-navy-400 disabled:opacity-50"
      >
        {mode === "archive" ? "되돌리기" : "보관"}
      </button>
      <button
        type="button"
        onClick={() => onChange("delete")}
        disabled={disabled}
        className="flex-1 whitespace-nowrap rounded-lg border border-charcoal-800 px-2.5 py-1 text-xs text-charcoal-400 hover:border-red-400/60 hover:text-red-500 disabled:opacity-50"
      >
        삭제
      </button>
    </div>
  );
}

/** 목록 맨 아래 '보관함 (n)' — 누르면 펼쳐서 보관한 예약을 보여 준다 (개선-28) */
function ArchiveDrawer({
  count,
  children,
}: {
  count: number;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  if (count === 0 && !open) return null;
  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-xl border border-charcoal-800/60 bg-charcoal-900/30 px-4 py-3 text-left text-sm text-charcoal-200 hover:border-charcoal-700"
      >
        <span className="flex items-center gap-2">
          <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4 text-navy-400" fill="none" stroke="currentColor" strokeWidth={1.8}>
            <rect x="3" y="4" width="18" height="5" rx="1" />
            <path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9M10 13h4" />
          </svg>
          보관함 ({count})
        </span>
        <span className={`text-charcoal-500 transition-transform ${open ? "rotate-90" : ""}`}>›</span>
      </button>
      {open && (
        <div className="space-y-2">
          <p className="text-xs text-charcoal-500">
            보관한 예약은 여기서 되돌리거나 삭제할 수 있어요.
          </p>
          {children}
        </div>
      )}
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
  return <EmptyState compact title={hint} />;
}

function DateStamp({ iso }: { iso: string }) {
  const d = new Date(iso);
  return (
    <div className="flex w-14 shrink-0 flex-col items-center rounded-lg bg-charcoal-800/40 px-2 py-2 text-center">
      <span className="text-2xs font-semibold uppercase tracking-wider text-charcoal-500">
        {d.toLocaleDateString("ko-KR", { month: "short" })}
      </span>
      <span className="mt-0.5 text-xl font-bold tabular-nums text-charcoal-100">
        {d.getDate()}
      </span>
      <span className="text-2xs text-charcoal-500">
        {d.toLocaleDateString("ko-KR", { weekday: "short" })}
      </span>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-2xs font-semibold ${
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
  listMode,
  onListChange,
}: {
  title: string;
  rows: BookingRow[];
  update: (id: string, status: "confirmed" | "canceled" | "completed") => void;
  pending: boolean;
  muted?: boolean;
  emptyHint: string;
  listMode?: ListMode;
  onListChange?: OnListChange;
}) {
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);
  return (
    <section className="space-y-3">
      {/* 보관함 안에서는 위의 '보관함 (n)' 줄이 제목 역할 */}
      {listMode !== "archive" && <SectionHeader title={title} count={rows.length} />}
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
                      {b.payment_status === "awaiting" && b.status === "pending" && (
                        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-2xs font-semibold text-amber-700 dark:text-amber-300">
                          입금 대기 · ₩{Math.round(b.slot.price_cents / 100).toLocaleString("ko-KR")}
                          {b.payment_due_at &&
                            ` · ${new Date(b.payment_due_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}까지`}
                        </span>
                      )}
                      {b.payment_status === "paid" && (
                        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-2xs font-semibold text-emerald-700 dark:text-emerald-300">
                          입금 확인됨
                        </span>
                      )}
                    </div>
                    <TimeLine start={start} end={end} />
                    <p className="mt-2 text-sm text-charcoal-200">
                      {guestLabel}
                      {guestSub && (
                        <span className="ml-1.5 text-xs text-charcoal-500">
                          {guestSub}
                        </span>
                      )}
                      {/* 회원이 아닌 게스트에게도 바로 연락할 수 있게 */}
                      {!b.guest && b.guest_email && (
                        <a
                          href={`mailto:${b.guest_email}?subject=${encodeURIComponent(`[${b.slot.title}] 예약 관련`)}`}
                          className="ml-2 text-xs font-medium text-navy-400 hover:underline"
                        >
                          메일 보내기
                        </a>
                      )}
                    </p>
                    {b.selected_menus && b.selected_menus.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {b.selected_menus.map((m) => (
                          <span
                            key={m.id}
                            className="inline-flex items-center gap-1 rounded-lg bg-navy-400/10 px-2 py-0.5 text-2xs text-navy-600 ring-1 ring-navy-400/30 dark:text-navy-200 dark:ring-0"
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
                      <p className="mt-2 rounded-lg bg-charcoal-800/40 px-3 py-2 text-xs leading-relaxed text-charcoal-400">
                        {b.message}
                      </p>
                    )}
                    <RescheduleBanner booking={b} />
                    {reschedulingId === b.id && (
                      <HostReschedulePanel
                        bookingId={b.id}
                        onDone={() => setReschedulingId(null)}
                      />
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    {b.status === "pending" && (
                      <button
                        onClick={() => update(b.id, "confirmed")}
                        disabled={pending}
                        className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                      >
                        {b.payment_status === "awaiting" ? "입금 확인 · 확정" : "수락"}
                      </button>
                    )}
                    {b.status !== "canceled" &&
                      b.status !== "completed" &&
                      start > new Date() && (
                        <button
                          onClick={() =>
                            setReschedulingId(
                              reschedulingId === b.id ? null : b.id,
                            )
                          }
                          className="rounded-lg border border-charcoal-700 px-3 py-1 text-xs text-charcoal-400 hover:border-navy-400/60 hover:text-navy-400"
                        >
                          시간 변경
                        </button>
                      )}
                    {b.status !== "canceled" && b.status !== "completed" && (
                      <button
                        onClick={() => update(b.id, "canceled")}
                        disabled={pending}
                        className="rounded-lg border border-charcoal-700 px-3 py-1 text-xs text-charcoal-400 hover:border-navy-400/60 hover:text-navy-400"
                      >
                        취소
                      </button>
                    )}
                    {b.status === "confirmed" && (
                      <button
                        onClick={() => update(b.id, "completed")}
                        disabled={pending}
                        className="rounded-lg border border-charcoal-700 px-3 py-1 text-xs text-charcoal-400 hover:border-charcoal-600 hover:text-charcoal-200"
                      >
                        완료
                      </button>
                    )}
                    {listMode && onListChange && isFinished(b.status, b.scheduled_at) && (
                      <ListStateButtons
                        mode={listMode}
                        disabled={pending}
                        onChange={(change) => onListChange(b.id, change)}
                      />
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
  reviewedBookingIds = [],
  listMode,
  onListChange,
}: {
  title: string;
  rows: GuestBookingRow[];
  username: string;
  onCancel: (id: string) => void;
  pending: boolean;
  muted?: boolean;
  emptyHint: string;
  reviewedBookingIds?: string[];
  listMode?: ListMode;
  onListChange?: OnListChange;
}) {
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewedLocal, setReviewedLocal] = useState<string[]>([]);
  const reviewed = new Set([...reviewedBookingIds, ...reviewedLocal]);
  return (
    <section className="space-y-3">
      {/* 보관함 안에서는 위의 '보관함 (n)' 줄이 제목 역할 */}
      {listMode !== "archive" && <SectionHeader title={title} count={rows.length} />}
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
                    {b.payment_status === "awaiting" && b.status === "pending" && b.host?.payment_instructions && (
                      <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs">
                        <p className="font-semibold text-amber-700 dark:text-amber-300">
                          입금 대기 · ₩{Math.round(b.slot.price_cents / 100).toLocaleString("ko-KR")}
                          {b.payment_due_at &&
                            ` · ${new Date(b.payment_due_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}까지`}
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-charcoal-200">{b.host.payment_instructions}</p>
                      </div>
                    )}
                    {b.message && (
                      <p className="mt-2 rounded-lg bg-charcoal-800/40 px-3 py-2 text-xs leading-relaxed text-charcoal-400">
                        {b.message}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    {b.host && (
                      <Link
                        href={`/${b.host.username}/s/${b.slot.slug}`}
                        className="rounded-lg border border-charcoal-800 px-2.5 py-1 text-center text-xs text-charcoal-400 hover:border-charcoal-700 hover:text-charcoal-100"
                      >
                        슬롯
                      </Link>
                    )}
                    {b.status !== "canceled" &&
                      b.status !== "completed" &&
                      end >= new Date() && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              setReschedulingId((cur) =>
                                cur === b.id ? null : b.id,
                              )
                            }
                            disabled={pending}
                            className="rounded-lg border border-charcoal-800 px-2.5 py-1 text-xs text-charcoal-400 hover:border-charcoal-600 hover:text-charcoal-100 disabled:opacity-50"
                          >
                            시간 변경
                          </button>
                          <button
                            type="button"
                            onClick={() => onCancel(b.id)}
                            disabled={pending}
                            className="rounded-lg border border-charcoal-800 px-2.5 py-1 text-xs text-charcoal-400 hover:border-navy-400/60 hover:text-navy-400 disabled:opacity-50"
                          >
                            취소
                          </button>
                        </>
                      )}
                    {(b.status === "completed" ||
                      (b.status === "confirmed" && end < new Date())) &&
                      !reviewed.has(b.id) && (
                        <button
                          type="button"
                          onClick={() =>
                            setReviewingId((cur) =>
                              cur === b.id ? null : b.id,
                            )
                          }
                          className="rounded-lg bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-500/40 hover:bg-amber-500/25 dark:text-amber-200 dark:ring-0"
                        >
                          후기 남기기
                        </button>
                      )}
                    {reviewed.has(b.id) && (
                      <span className="px-2.5 py-1 text-center text-2xs text-charcoal-600">
                        후기 완료
                      </span>
                    )}
                    {listMode && onListChange && isFinished(b.status, b.scheduled_at) && (
                      <ListStateButtons
                        mode={listMode}
                        disabled={pending}
                        onChange={(change) => onListChange(b.id, change)}
                      />
                    )}
                  </div>
                </div>
                <RescheduleBanner booking={b} />
                {reschedulingId === b.id && (
                  <ReschedulePanel
                    booking={b}
                    onDone={() => setReschedulingId(null)}
                  />
                )}
                {reviewingId === b.id && (
                  <ReviewPanel
                    booking={b}
                    onDone={() => {
                      setReviewedLocal((prev) => [...prev, b.id]);
                      setReviewingId(null);
                    }}
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

function ReviewPanel({
  booking,
  onDone,
}: {
  booking: GuestBookingRow;
  onDone: () => void;
}) {
  const toast = useToast();
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [saving, startSaving] = useTransition();

  const submit = () => {
    if (rating === 0) return;
    startSaving(async () => {
      const res = await addBookingReview(booking.id, rating, body);
      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("후기를 남겼어요. 감사합니다!");
      onDone();
    });
  };

  return (
    <div className="mt-3 space-y-2 rounded-lg border border-charcoal-800/60 bg-charcoal-900/40 p-3">
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            aria-label={`${n}점`}
            className={`text-xl transition-colors ${
              n <= rating ? "text-amber-400" : "text-charcoal-700 hover:text-charcoal-500"
            }`}
          >
            ★
          </button>
        ))}
        {rating > 0 && (
          <span className="ml-1 text-xs text-charcoal-500">{rating}점</span>
        )}
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={`${booking.slot.title} 어떠셨나요? (선택)`}
        rows={2}
        maxLength={2000}
        className="w-full resize-none rounded-lg border border-charcoal-800/60 bg-[rgb(var(--bg-surface))] px-3 py-2 text-xs text-charcoal-100 placeholder:text-charcoal-600 focus:border-charcoal-600 focus:outline-none"
      />
      <div className="flex justify-end">
        <button
          type="button"
          onClick={submit}
          disabled={rating === 0 || saving}
          className="rounded-lg bg-navy-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "등록 중…" : "후기 등록"}
        </button>
      </div>
    </div>
  );
}

/** KST 표기 "8월 22일 (토) 11:00" */
function whenLabel(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * 대기 중인 시간 변경 제안 배너.
 * 내가 보낸 제안이면 대기 안내만, 받은 제안이면 수락/거절 버튼을 준다.
 */
function RescheduleBanner({
  booking,
}: {
  booking: {
    id: string;
    scheduled_at: string;
    reschedule_start_at: string | null;
    reschedule_note: string | null;
    reschedule_by_me?: boolean;
  };
}) {
  const router = useRouter();
  const toast = useToast();
  const [saving, startSaving] = useTransition();

  if (!booking.reschedule_start_at) return null;
  const mine = booking.reschedule_by_me ?? false;

  const respond = (action: "accept" | "decline") => {
    startSaving(async () => {
      const res = await respondToReschedule(booking.id, action);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success(
        action === "accept"
          ? "새 시간으로 옮겼어요."
          : "제안을 거절했어요. 예약은 그대로예요.",
      );
      router.refresh();
    });
  };

  const withdraw = () => {
    startSaving(async () => {
      const res = await withdrawReschedule(booking.id);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("제안을 취소했어요.");
      router.refresh();
    });
  };

  return (
    <div className="mt-2 rounded-lg border border-navy-400/40 bg-navy-400/10 px-3 py-2">
      <p className="text-2xs font-semibold text-navy-600 dark:text-navy-200">
        {mine ? "변경 제안을 보냈어요" : "시간 변경 제안이 왔어요"}
      </p>
      <p className="mt-1 text-xs text-charcoal-300">
        <span className="text-charcoal-500 line-through">
          {whenLabel(booking.scheduled_at)}
        </span>
        <span className="mx-1.5 text-charcoal-500">→</span>
        <span className="font-semibold text-charcoal-100">
          {whenLabel(booking.reschedule_start_at)}
        </span>
      </p>
      {booking.reschedule_note && (
        <p className="mt-1 text-xs text-charcoal-400">
          {booking.reschedule_note}
        </p>
      )}
      {mine ? (
        <>
          <p className="mt-1 text-2xs text-charcoal-500">
            상대가 수락하면 예약과 캘린더가 함께 옮겨져요.
          </p>
          <button
            type="button"
            onClick={withdraw}
            disabled={saving}
            className="mt-2 rounded-lg border border-charcoal-700 px-3 py-1 text-xs text-charcoal-400 hover:border-navy-400/60 hover:text-navy-400 disabled:opacity-60"
          >
            제안 취소
          </button>
        </>
      ) : (
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => respond("accept")}
            disabled={saving}
            className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
          >
            수락
          </button>
          <button
            type="button"
            onClick={() => respond("decline")}
            disabled={saving}
            className="rounded-lg border border-charcoal-700 px-3 py-1 text-xs text-charcoal-400 hover:border-navy-400/60 hover:text-navy-400 disabled:opacity-60"
          >
            거절
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * 호스트가 새 시간을 제안하는 패널.
 * 자기 일정이라 시각은 자유롭게 고르되, 게스트가 그 시간에 올 수 있는지는
 * 알 수 없으므로 바로 옮기지 않고 제안으로 남는다.
 */
function HostReschedulePanel({
  bookingId,
  onDone,
}: {
  bookingId: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [when, setWhen] = useState("");
  const [note, setNote] = useState("");
  const [saving, startSaving] = useTransition();

  const submit = () => {
    if (!when) return;
    const iso = new Date(when).toISOString();
    startSaving(async () => {
      const res = await proposeRescheduleAsHost(bookingId, iso, note || null);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success(
        res.applied
          ? "시간을 변경하고 게스트에게 메일로 알렸어요."
          : "변경을 제안했어요. 게스트가 수락하면 옮겨져요.",
      );
      onDone();
      router.refresh();
    });
  };

  return (
    <div className="mt-3 space-y-2 rounded-lg border border-charcoal-800/60 bg-charcoal-900/40 p-3">
      <input
        type="datetime-local"
        value={when}
        onChange={(e) => setWhen(e.target.value)}
        className="w-full rounded-lg border border-charcoal-800/60 bg-[rgb(var(--bg-surface))] px-3 py-1.5 text-xs text-charcoal-100 focus:border-charcoal-600 focus:outline-none"
      />
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="변경 사유 (선택)"
        maxLength={500}
        className="w-full rounded-lg border border-charcoal-800/60 bg-[rgb(var(--bg-surface))] px-3 py-1.5 text-xs text-charcoal-100 placeholder:text-charcoal-600 focus:border-charcoal-600 focus:outline-none"
      />
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onDone}
          className="rounded-lg border border-charcoal-700 px-3 py-1 text-xs text-charcoal-400 hover:text-charcoal-200"
        >
          닫기
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={!when || saving}
          className="rounded-lg bg-navy-500 px-3 py-1 text-xs font-semibold text-white hover:bg-navy-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "보내는 중…" : "변경 제안"}
        </button>
      </div>
    </div>
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
            className="rounded-lg bg-navy-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "변경 중…" : "변경"}
          </button>
        </div>
      )}
    </div>
  );
}
