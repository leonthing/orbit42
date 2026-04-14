"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { bookSlot } from "@/lib/slots";
import type { BookableOption } from "@/lib/slots";

export default function BookingForm({
  slotId,
  options,
  loggedIn,
}: {
  slotId: string;
  options: BookableOption[];
  loggedIn: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selectedKey, setSelectedKey] = useState<string>(() =>
    options[0] ? keyOf(options[0]) : "",
  );
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);

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

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const opt = options.find((o) => keyOf(o) === selectedKey);
    if (!opt) return;
    startTransition(async () => {
      const res = await bookSlot({
        slotId,
        availabilityId: opt.availability_id ?? undefined,
        startAt: opt.availability_id ? undefined : opt.start_at,
        message: message.trim() || undefined,
        guest_name: loggedIn ? undefined : name.trim() || undefined,
        guest_email: loggedIn ? undefined : email.trim() || undefined,
      });
      if (res.error) return alert(res.error);
      setDone(true);
      router.refresh();
    });
  };

  if (done) {
    return (
      <div className="rounded-lg border border-emerald-700/40 bg-emerald-700/10 p-4 text-sm text-emerald-300">
        예약 요청이 전송되었습니다. 호스트의 캘린더에 이벤트가 추가되었을 거예요.
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
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
                        ? "border-navy-500 bg-navy-600/15 text-charcoal-100"
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
        className="w-full rounded-lg bg-navy-600 px-4 py-3 text-sm font-medium text-white hover:bg-navy-500 disabled:opacity-60"
      >
        {pending ? "예약 중…" : "Book this slot"}
      </button>

      {!loggedIn && (
        <p className="text-center text-xs text-charcoal-500">
          이미 가입했나요?{" "}
          <a href="/login" className="text-navy-400 hover:text-navy-300">
            로그인하고 예약
          </a>
        </p>
      )}
    </form>
  );
}

function keyOf(o: BookableOption): string {
  return o.availability_id ?? o.start_at;
}
