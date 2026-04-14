"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { bookSlot } from "@/lib/slots";
import type { BookableOption } from "@/lib/slots";

type Stage = "form" | "payment" | "done";

export default function BookingForm({
  slotId,
  options,
  loggedIn,
  priceCents,
  slotTitle,
}: {
  slotId: string;
  options: BookableOption[];
  loggedIn: boolean;
  priceCents: number;
  slotTitle: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [stage, setStage] = useState<Stage>("form");
  const [selectedKey, setSelectedKey] = useState<string>(() =>
    options[0] ? keyOf(options[0]) : "",
  );
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const grouped = useMemo(() => {
    const by: Record<string, BookableOption[]> = {};
    for (const o of options) {
      const dayKey = new Date(o.start_at).toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "short",
      });
      (by[dayKey] ||= []).push(o);
    }
    return by;
  }, [options]);

  const selectedOpt = options.find((o) => keyOf(o) === selectedKey) ?? null;
  const isPaid = priceCents > 0;

  const proceed = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOpt) return;
    if (!loggedIn && (!name.trim() || !email.trim())) {
      alert("이름과 이메일을 입력하세요.");
      return;
    }
    setStage(isPaid ? "payment" : "form");
    if (isPaid) {
      setStage("payment");
    } else {
      doBook();
    }
  };

  const doBook = () => {
    if (!selectedOpt) return;
    startTransition(async () => {
      const res = await bookSlot({
        slotId,
        availabilityId: selectedOpt.availability_id ?? undefined,
        startAt: selectedOpt.availability_id ? undefined : selectedOpt.start_at,
        message: message.trim() || undefined,
        guest_name: loggedIn ? undefined : name.trim() || undefined,
        guest_email: loggedIn ? undefined : email.trim() || undefined,
      });
      if (res.error) return alert(res.error);
      setStage("done");
      router.refresh();
    });
  };

  if (stage === "done") {
    return (
      <div className="rounded-lg border border-emerald-700/40 bg-emerald-700/10 p-4 text-sm text-emerald-300">
        예약이 완료되었습니다. 호스트의 캘린더에 이벤트가 추가되었고,
        등록하신 이메일로 확인 메일이 발송됩니다.
      </div>
    );
  }

  if (stage === "payment" && selectedOpt) {
    return (
      <PaymentStep
        priceCents={priceCents}
        slotTitle={slotTitle}
        when={selectedOpt.start_at}
        pending={pending}
        onCancel={() => setStage("form")}
        onPay={doBook}
      />
    );
  }

  return (
    <form onSubmit={proceed} className="space-y-4">
      <div className="space-y-4">
        {Object.entries(grouped).map(([day, opts]) => (
          <div key={day}>
            <p className="mb-1 text-xs font-medium text-charcoal-500">{day}</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {opts.map((o) => {
                const k = keyOf(o);
                const active = selectedKey === k;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setSelectedKey(k)}
                    className={`rounded-md border px-3 py-2 text-sm transition-colors ${
                      active
                        ? "border-red-500 bg-red-600/15 text-charcoal-100"
                        : "border-charcoal-800/60 bg-charcoal-800/20 text-charcoal-300 hover:border-charcoal-700"
                    }`}
                  >
                    {new Date(o.start_at).toLocaleTimeString("ko-KR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {!loggedIn && (
        <div className="grid gap-2 md:grid-cols-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="이름"
            required
            className="rounded-lg border border-charcoal-800/40 bg-charcoal-900/60 px-3 py-2 text-sm text-charcoal-100"
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="이메일"
            required
            className="rounded-lg border border-charcoal-800/40 bg-charcoal-900/60 px-3 py-2 text-sm text-charcoal-100"
          />
        </div>
      )}

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={3}
        placeholder="호스트에게 한 마디 (선택)"
        className="w-full rounded-lg border border-charcoal-800/40 bg-charcoal-900/60 px-3 py-2 text-sm text-charcoal-100"
      />

      <button
        type="submit"
        disabled={pending || !selectedKey}
        className="w-full rounded-lg bg-red-600 px-4 py-3 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-60"
      >
        {isPaid
          ? `${(priceCents / 100).toLocaleString("ko-KR")}원 결제하고 예약`
          : pending
            ? "예약 중…"
            : "Book this slot"}
      </button>

      {!loggedIn && (
        <p className="text-center text-xs text-charcoal-500">
          이미 가입했나요?{" "}
          <a href="/login" className="text-red-400 hover:text-red-300">
            로그인하고 예약
          </a>
        </p>
      )}
    </form>
  );
}

function PaymentStep({
  priceCents,
  slotTitle,
  when,
  pending,
  onCancel,
  onPay,
}: {
  priceCents: number;
  slotTitle: string;
  when: string;
  pending: boolean;
  onCancel: () => void;
  onPay: () => void;
}) {
  const [acknowledged, setAcknowledged] = useState(false);
  return (
    <div className="space-y-4 rounded-xl border border-charcoal-800/60 bg-charcoal-900/40 p-5">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-charcoal-500">
          결제
        </p>
        <p className="mt-2 text-sm text-charcoal-200">{slotTitle}</p>
        <p className="mt-1 text-xs text-charcoal-500">
          {new Date(when).toLocaleString("ko-KR", {
            year: "numeric",
            month: "long",
            day: "numeric",
            weekday: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
        <p className="mt-4 text-3xl font-bold text-charcoal-100">
          {(priceCents / 100).toLocaleString("ko-KR")}
          <span className="ml-1 text-base font-medium text-charcoal-500">원</span>
        </p>
      </div>

      <div className="rounded-lg border border-red-700/40 bg-red-700/10 p-3 text-xs text-red-200">
        토스페이먼츠 연동은 곧 출시됩니다. 지금은 결제 없이 예약을 진행해주세요 —
        호스트가 별도로 결제 안내를 드립니다.
      </div>

      <button
        type="button"
        disabled
        className="w-full rounded-lg border border-charcoal-700 bg-charcoal-800/40 px-4 py-3 text-sm font-medium text-charcoal-500"
      >
        Pay with Toss (준비 중)
      </button>

      <label className="flex items-center gap-2 text-xs text-charcoal-400">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => setAcknowledged(e.target.checked)}
          className="accent-red-500"
        />
        결제 없이 예약 진행에 동의합니다.
      </label>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="flex-1 rounded-lg border border-charcoal-700 px-4 py-2.5 text-sm text-charcoal-300 hover:border-charcoal-600"
        >
          뒤로
        </button>
        <button
          type="button"
          onClick={onPay}
          disabled={pending || !acknowledged}
          className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
        >
          {pending ? "예약 중…" : "결제 없이 예약"}
        </button>
      </div>
    </div>
  );
}

function keyOf(o: BookableOption): string {
  return o.availability_id ?? o.start_at;
}
