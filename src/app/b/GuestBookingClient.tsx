"use client";

import { useCallback, useEffect, useState } from "react";

type Booking = {
  title: string;
  hostName: string;
  hostPageUrl: string | null;
  guestName: string | null;
  startAt: string;
  endAt: string;
  location: string | null;
  status: "pending" | "confirmed" | "canceled" | "completed" | string;
  priceCents: number;
  payment: { status: string; dueAt: string | null; instructions: string | null } | null;
  proposal: { startAt: string; endAt: string; note: string | null; byMe: boolean } | null;
  expired: boolean;
  ended: boolean;
  canCancel: boolean;
  canPropose: boolean;
};

const fmt = (iso: string, opts: Intl.DateTimeFormatOptions = {}) =>
  new Date(iso).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    ...opts,
  });

const statusLabel = (b: Booking) => {
  if (b.status === "canceled") return { text: "취소된 예약", tone: "text-charcoal-500 border-charcoal-700" };
  if (b.status === "completed" || b.ended) return { text: "지난 예약", tone: "text-charcoal-400 border-charcoal-700" };
  if (b.payment?.status === "awaiting") return { text: "입금 대기", tone: "text-amber-600 dark:text-amber-300 border-amber-500/40" };
  if (b.status === "pending") return { text: "호스트 확인 대기", tone: "text-amber-600 dark:text-amber-300 border-amber-500/40" };
  return { text: "확정", tone: "text-emerald-600 dark:text-emerald-300 border-emerald-600/40" };
};

export default function GuestBookingClient() {
  const [token, setToken] = useState<string | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [proposing, setProposing] = useState(false);
  const [options, setOptions] = useState<{ startAt: string; endAt: string; availabilityId: string | null }[] | null>(null);
  const [picked, setPicked] = useState<{ startAt: string; availabilityId: string | null } | null>(null);

  const call = useCallback(
    async (action: string, extra: Record<string, unknown> = {}) => {
      if (!token) return null;
      const res = await fetch("/api/guest-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        referrerPolicy: "no-referrer",
        body: JSON.stringify({ token, action, ...extra }),
      });
      return res;
    },
    [token],
  );

  const load = useCallback(async () => {
    const res = await call("view");
    if (!res) return;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "예약을 불러오지 못했어요.");
      return;
    }
    setBooking(data.booking);
  }, [call]);

  useEffect(() => {
    const t = window.location.hash.replace(/^#/, "");
    if (!t) {
      setError("예약 링크가 올바르지 않아요. 메일의 버튼을 다시 눌러 주세요.");
      return;
    }
    setToken(t);
  }, []);

  useEffect(() => {
    if (token) void load();
  }, [token, load]);

  const run = async (action: string, extra: Record<string, unknown>, done: string) => {
    setBusy(true);
    setNotice(null);
    try {
      const res = await call(action, extra);
      if (!res) return;
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice(data.error ?? "처리하지 못했어요.");
        return;
      }
      setNotice(done);
      setConfirmingCancel(false);
      setProposing(false);
      setPicked(null);
      setOptions(null);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const downloadIcs = async () => {
    const res = await call("ics");
    if (!res || !res.ok) return setNotice("캘린더 파일을 만들지 못했어요.");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "orbit42-booking.ics";
    a.click();
    URL.revokeObjectURL(url);
  };

  const openPropose = async () => {
    setProposing(true);
    if (options) return;
    const res = await call("options");
    const data = res ? await res.json().catch(() => ({})) : {};
    setOptions(data.options ?? []);
  };

  if (error) {
    return (
      <div className="rounded-xl border border-charcoal-800/60 bg-[rgb(var(--bg-surface))] p-6 text-center">
        <p className="text-sm font-semibold text-charcoal-100">예약을 열 수 없어요</p>
        <p className="mt-2 text-sm text-charcoal-400">{error}</p>
      </div>
    );
  }
  if (!booking) {
    return <div className="h-48 animate-pulse rounded-xl bg-charcoal-800/30" />;
  }

  const st = statusLabel(booking);
  const readOnly = booking.expired || booking.status === "canceled" || booking.status === "completed";

  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-charcoal-500">내 예약</p>

      <section className="rounded-xl border border-charcoal-800/60 bg-[rgb(var(--bg-surface))] p-5">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-lg font-bold text-charcoal-50">{booking.title}</h1>
          <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${st.tone}`}>{st.text}</span>
        </div>
        <p className="mt-1 text-sm text-charcoal-300">{booking.hostName}님과의 예약</p>
        <dl className="mt-4 space-y-1.5 text-sm">
          <div className="flex gap-3">
            <dt className="w-12 shrink-0 text-charcoal-500">일시</dt>
            <dd className="text-charcoal-100">
              {fmt(booking.startAt)} – {fmt(booking.endAt, { month: undefined, day: undefined, weekday: undefined })}
            </dd>
          </div>
          {booking.location && (
            <div className="flex gap-3">
              <dt className="w-12 shrink-0 text-charcoal-500">장소</dt>
              <dd className="text-charcoal-100">{booking.location}</dd>
            </div>
          )}
          {booking.priceCents > 0 && (
            <div className="flex gap-3">
              <dt className="w-12 shrink-0 text-charcoal-500">금액</dt>
              <dd className="text-charcoal-100">{Math.round(booking.priceCents / 100).toLocaleString("ko-KR")}원</dd>
            </div>
          )}
        </dl>
      </section>

      {booking.payment?.status === "awaiting" && booking.payment.instructions && !readOnly && (
        <section className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-5">
          <p className="text-sm font-semibold text-charcoal-100">입금 안내</p>
          <p className="mt-2 whitespace-pre-wrap rounded-lg bg-charcoal-800/40 px-3 py-2.5 text-sm text-charcoal-100">
            {booking.payment.instructions}
          </p>
          {booking.payment.dueAt && (
            <p className="mt-2 text-xs text-charcoal-500">
              {fmt(booking.payment.dueAt, { weekday: undefined })}까지 입금해 주세요. 호스트가 확인하면 확정 메일을 보내드려요.
            </p>
          )}
        </section>
      )}

      {booking.proposal && !readOnly && (
        <section className="rounded-xl border border-navy-400/40 bg-navy-400/10 p-4 text-sm">
          <p className="font-semibold text-charcoal-100">
            {booking.proposal.byMe ? "시간 변경을 제안했어요" : `${booking.hostName}님이 시간 변경을 제안했어요`}
          </p>
          <p className="mt-1 text-charcoal-300">{fmt(booking.proposal.startAt)}</p>
          <p className="mt-1 text-xs text-charcoal-500">
            {booking.proposal.byMe ? "호스트가 수락하면 새 시간으로 옮겨져요." : "Orbit42 앱이나 웹의 예약 화면에서 수락하거나 거절할 수 있어요."}
          </p>
        </section>
      )}

      {notice && <p className="rounded-lg bg-charcoal-800/40 px-3 py-2 text-sm text-charcoal-200">{notice}</p>}

      {!readOnly && (
        <div className="grid gap-2">
          <button
            type="button"
            onClick={downloadIcs}
            className="rounded-lg border border-charcoal-700 px-4 py-2.5 text-sm font-semibold text-charcoal-100 hover:border-charcoal-500"
          >
            내 캘린더에 추가
          </button>
          {booking.canPropose && !proposing && (
            <button
              type="button"
              onClick={openPropose}
              className="rounded-lg border border-charcoal-700 px-4 py-2.5 text-sm font-semibold text-charcoal-100 hover:border-charcoal-500"
            >
              다른 시간으로 바꾸기
            </button>
          )}
          {booking.canCancel && !confirmingCancel && (
            <button
              type="button"
              onClick={() => setConfirmingCancel(true)}
              className="rounded-lg px-4 py-2.5 text-sm font-semibold text-red-500 hover:bg-red-500/10"
            >
              예약 취소
            </button>
          )}
        </div>
      )}

      {proposing && (
        <section className="rounded-xl border border-charcoal-800/60 bg-[rgb(var(--bg-surface))] p-5">
          <p className="text-sm font-semibold text-charcoal-100">어느 시간으로 바꿀까요?</p>
          <p className="mt-1 text-xs text-charcoal-500">고른 시간이 잡히면 바로 옮겨지고, {booking.hostName}님께 알려 드려요.</p>
          {options === null ? (
            <div className="mt-3 h-20 animate-pulse rounded-lg bg-charcoal-800/30" />
          ) : options.length === 0 ? (
            <p className="mt-3 text-sm text-charcoal-400">지금은 고를 수 있는 다른 시간이 없어요.</p>
          ) : (
            <div className="mt-3 flex max-h-64 flex-wrap gap-1.5 overflow-y-auto">
              {options.map((o) => (
                <button
                  key={o.startAt}
                  type="button"
                  onClick={() => setPicked({ startAt: o.startAt, availabilityId: o.availabilityId })}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                    picked?.startAt === o.startAt
                      ? "border-navy-400 bg-navy-400/15 text-navy-600 dark:text-navy-300"
                      : "border-charcoal-800/60 text-charcoal-300 hover:border-charcoal-600"
                  }`}
                >
                  {fmt(o.startAt)}
                </button>
              ))}
            </div>
          )}
          {picked && (
            <p className="mt-3 rounded-lg bg-charcoal-800/40 px-3 py-2 text-sm text-charcoal-100">
              {fmt(booking.startAt)} → <strong>{fmt(picked.startAt)}</strong>(으)로 바꿀까요?
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={!picked || busy}
              onClick={() =>
                picked &&
                run(
                  "reschedule",
                  { confirm: true, startAt: picked.startAt, availabilityId: picked.availabilityId },
                  "예약 시간을 바꿨어요.",
                )
              }
              className="flex-1 rounded-lg bg-navy-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              이 시간으로 바꾸기
            </button>
            <button type="button" onClick={() => { setProposing(false); setPicked(null); }} className="rounded-lg px-4 py-2.5 text-sm text-charcoal-400">
              닫기
            </button>
          </div>
        </section>
      )}

      {confirmingCancel && (
        <section className="rounded-xl border border-red-500/40 bg-red-500/10 p-5">
          <p className="text-sm font-semibold text-charcoal-100">예약을 취소할까요?</p>
          <p className="mt-1 text-xs text-charcoal-400">취소하면 {booking.hostName}님께 알림이 가고, 되돌릴 수 없어요.</p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => run("cancel", { confirm: true }, "예약을 취소했어요.")}
              className="flex-1 rounded-lg bg-red-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              취소하기
            </button>
            <button type="button" onClick={() => setConfirmingCancel(false)} className="rounded-lg px-4 py-2.5 text-sm text-charcoal-400">
              그대로 두기
            </button>
          </div>
        </section>
      )}

      {booking.hostPageUrl && (
        <p className="text-xs text-charcoal-500">
          호스트에게 연락하려면{" "}
          <a href={booking.hostPageUrl} rel="noreferrer" className="text-charcoal-300 underline underline-offset-2">
            {booking.hostName}님의 페이지
          </a>
          에서 SNS나 시간 요청을 이용해 주세요.
        </p>
      )}
      {booking.expired && <p className="text-xs text-charcoal-500">예약이 끝나고 7일이 지나 이 링크로는 볼 수만 있어요.</p>}

      <p className="pt-4 text-center text-xs text-charcoal-500">
        나도 이런 예약 링크를 만들 수 있어요 ·{" "}
        <a href="/signup" className="text-charcoal-300 underline underline-offset-2">
          Orbit42에서 만들기
        </a>
      </p>
    </div>
  );
}
