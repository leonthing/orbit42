"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { bookSlot } from "@/lib/slots";

type Open = { id: string; start_at: string; remaining: number };

export default function BookingForm({
  availabilities,
  loggedIn,
}: {
  availabilities: Open[];
  priceCents: number;
  loggedIn: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<string>(availabilities[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    startTransition(async () => {
      const res = await bookSlot({
        availabilityId: selected,
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
        예약 요청이 전송되었습니다. 호스트가 확인 후 연락드릴 거예요.
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        {availabilities.map((a) => (
          <label
            key={a.id}
            className={`flex cursor-pointer items-center justify-between rounded-lg border px-4 py-3 text-sm transition-colors ${
              selected === a.id
                ? "border-navy-500 bg-navy-600/15 text-charcoal-100"
                : "border-charcoal-800/60 bg-charcoal-800/20 text-charcoal-300 hover:border-charcoal-700"
            }`}
          >
            <div className="flex items-center gap-3">
              <input
                type="radio"
                name="avail"
                value={a.id}
                checked={selected === a.id}
                onChange={() => setSelected(a.id)}
                className="accent-navy-500"
              />
              <span>
                {new Date(a.start_at).toLocaleString("ko-KR", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  weekday: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <span className="text-xs text-charcoal-500">{a.remaining}자리</span>
          </label>
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
        disabled={pending || !selected}
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
