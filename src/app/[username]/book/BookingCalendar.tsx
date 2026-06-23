"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { bookSlot } from "@/lib/slots";
import { useToast } from "@/components/Toast";

export type BookSlot = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  duration_min: number;
  price_cents: number;
  slot_type: string;
  location_detail: string | null;
  options: Array<{ availability_id: string | null; start_at: string; end_at: string }>;
};

type Pick = { slot: BookSlot; start_at: string; availability_id: string | null };

const priceLabel = (cents: number) =>
  cents === 0 ? "FREE" : `₩${(cents / 100).toLocaleString("ko-KR")}`;

const firstDayOf = (slot: BookSlot): Date | null => {
  if (slot.options.length === 0) return null;
  const earliest = slot.options.reduce((a, b) =>
    new Date(a.start_at) < new Date(b.start_at) ? a : b,
  );
  return atDayStart(new Date(earliest.start_at));
};

export function BookingCalendar({
  slots,
  hostName,
  loggedIn,
}: {
  slots: BookSlot[];
  hostName: string;
  loggedIn: boolean;
}) {
  // Only slots that actually have bookable times.
  const activeSlots = useMemo(
    () => slots.filter((s) => s.options.length > 0),
    [slots],
  );

  // Step 1: which service? Auto-pick when there's only one.
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(() =>
    activeSlots.length === 1 ? activeSlots[0].id : null,
  );
  const selectedSlot = useMemo(
    () => activeSlots.find((s) => s.id === selectedSlotId) ?? null,
    [activeSlots, selectedSlotId],
  );

  // Step 2: the selected slot's days/times.
  const byDay = useMemo(() => {
    const map = new Map<string, Pick[]>();
    if (!selectedSlot) return map;
    const sorted = [...selectedSlot.options].sort(
      (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
    );
    for (const o of sorted) {
      const k = dayKey(new Date(o.start_at));
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push({
        slot: selectedSlot,
        start_at: o.start_at,
        availability_id: o.availability_id,
      });
    }
    return map;
  }, [selectedSlot]);

  const initialDate = selectedSlot ? firstDayOf(selectedSlot) : null;
  const [monthAnchor, setMonthAnchor] = useState<Date>(
    () => initialDate ?? atDayStart(new Date()),
  );
  const [selectedDate, setSelectedDate] = useState<Date | null>(initialDate);
  const [picked, setPicked] = useState<Pick | null>(null);

  function chooseSlot(id: string) {
    const slot = activeSlots.find((s) => s.id === id) ?? null;
    setSelectedSlotId(id);
    setPicked(null);
    const fd = slot ? firstDayOf(slot) : null;
    setSelectedDate(fd);
    if (fd) setMonthAnchor(fd);
  }

  const optionsForDay = useMemo(() => {
    if (!selectedDate) return [];
    return byDay.get(dayKey(selectedDate)) ?? [];
  }, [byDay, selectedDate]);

  if (activeSlots.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-charcoal-800/60 p-10 text-center">
        <p className="text-sm font-semibold text-charcoal-200">
          지금은 예약 가능한 시간이 없어요
        </p>
        <p className="mt-2 text-sm text-charcoal-500">
          잠시 후 다시 확인해주세요.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Step 1 — choose a service */}
      <SlotChooser
        slots={activeSlots}
        selectedId={selectedSlotId}
        onSelect={chooseSlot}
      />

      {/* Step 2 — pick a time for the chosen service */}
      {selectedSlot ? (
        <div className="grid gap-5 md:grid-cols-[300px_minmax(0,1fr)] md:gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <MonthCalendar
            anchor={monthAnchor}
            onAnchorChange={setMonthAnchor}
            selected={selectedDate}
            onSelect={(d) => {
              setSelectedDate(d);
              setPicked(null);
            }}
            byDay={byDay}
          />

          <div className="space-y-5">
            <section className="rounded-2xl border border-charcoal-800/60 bg-charcoal-900/30 p-5">
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="text-base font-semibold text-charcoal-100">
                  {selectedDate
                    ? selectedDate.toLocaleDateString("ko-KR", {
                        month: "long",
                        day: "numeric",
                        weekday: "long",
                      })
                    : "날짜를 선택하세요"}
                </h2>
                <p className="text-xs text-charcoal-500">
                  {selectedDate ? `${optionsForDay.length}개의 시간` : ""}
                </p>
              </div>

              {selectedDate && (
                <div className="mt-5">
                  {optionsForDay.length === 0 ? (
                    <p className="text-sm text-charcoal-500">
                      이 날은 예약 가능한 시간이 없어요.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {optionsForDay.map((o) => {
                        const active = picked
                          ? picked.start_at === o.start_at
                          : false;
                        return (
                          <button
                            key={o.start_at}
                            type="button"
                            onClick={() => setPicked(o)}
                            className={`rounded-lg border px-3 py-2.5 text-center transition-colors ${
                              active
                                ? "border-red-500 bg-red-500/20 text-charcoal-100"
                                : "border-charcoal-800/60 bg-charcoal-800/30 text-charcoal-200 hover:border-red-500/60 hover:bg-red-500/10"
                            }`}
                          >
                            <p className="text-sm font-semibold tabular-nums">
                              {new Date(o.start_at).toLocaleTimeString("ko-KR", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </section>

            {picked && (
              <ConfirmBook picked={picked} hostName={hostName} loggedIn={loggedIn} />
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-charcoal-800/60 p-10 text-center">
          <p className="text-sm font-semibold text-charcoal-200">
            예약할 항목을 먼저 선택하세요
          </p>
          <p className="mt-2 text-sm text-charcoal-500">
            위에서 원하는 미팅을 고르면 가능한 날짜와 시간이 나와요.
          </p>
        </div>
      )}
    </div>
  );
}

function SlotChooser({
  slots,
  selectedId,
  onSelect,
}: {
  slots: BookSlot[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="rounded-2xl border border-charcoal-800/60 bg-charcoal-900/30 p-5">
      <h2 className="text-base font-semibold text-charcoal-100">
        무엇을 예약할까요?
      </h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {slots.map((s) => {
          const active = s.id === selectedId;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelect(s.id)}
              aria-pressed={active}
              className={`rounded-xl border p-4 text-left transition-colors ${
                active
                  ? "border-red-500 bg-red-500/10"
                  : "border-charcoal-800/60 bg-charcoal-800/20 hover:border-red-500/50 hover:bg-red-500/5"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-charcoal-100">{s.title}</p>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    s.price_cents === 0
                      ? "bg-charcoal-700/50 text-charcoal-300"
                      : "bg-red-500/20 text-red-300"
                  }`}
                >
                  {priceLabel(s.price_cents)}
                </span>
              </div>
              <p className="mt-1 text-xs text-charcoal-500">
                {s.duration_min}분
                {s.location_detail ? ` · ${s.location_detail}` : ""}
              </p>
              {s.description && (
                <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-charcoal-400">
                  {s.description}
                </p>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function MonthCalendar({
  anchor,
  onAnchorChange,
  selected,
  onSelect,
  byDay,
}: {
  anchor: Date;
  onAnchorChange: (d: Date) => void;
  selected: Date | null;
  onSelect: (d: Date) => void;
  byDay: Map<string, unknown[]>;
}) {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const first = new Date(year, month, 1);
  const startDow = (first.getDay() + 6) % 7; // Monday start
  const gridStart = new Date(year, month, 1 - startDow);
  const today = atDayStart(new Date());

  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) {
    cells.push(new Date(gridStart.getTime() + i * 24 * 60 * 60_000));
  }

  return (
    <section className="self-start rounded-2xl border border-charcoal-800/60 bg-charcoal-900/30 p-4">
      <header className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => onAnchorChange(new Date(year, month - 1, 1))}
          className="rounded-md border border-charcoal-700 px-2 py-1 text-xs text-charcoal-300 hover:border-charcoal-600"
        >
          ‹
        </button>
        <p className="text-sm font-semibold text-charcoal-100">
          {anchor.toLocaleDateString("ko-KR", { year: "numeric", month: "long" })}
        </p>
        <button
          type="button"
          onClick={() => onAnchorChange(new Date(year, month + 1, 1))}
          className="rounded-md border border-charcoal-700 px-2 py-1 text-xs text-charcoal-300 hover:border-charcoal-600"
        >
          ›
        </button>
      </header>

      <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-semibold uppercase tracking-wider text-charcoal-500">
        {["월", "화", "수", "목", "금", "토", "일"].map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-0.5">
        {cells.map((d) => {
          const inMonth = d.getMonth() === month;
          const isToday = d.getTime() === today.getTime();
          const isSelected = selected && atDayStart(d).getTime() === selected.getTime();
          const hasOptions = byDay.has(dayKey(d));
          return (
            <button
              key={d.toISOString()}
              type="button"
              onClick={() => onSelect(atDayStart(d))}
              disabled={!hasOptions}
              className={`relative aspect-square text-xs font-medium transition-colors ${
                isSelected
                  ? "rounded-full bg-red-500 text-charcoal-950"
                  : hasOptions
                    ? "rounded-full text-charcoal-100 hover:bg-red-500/15"
                    : "text-charcoal-700"
              } ${!inMonth ? "opacity-40" : ""}`}
            >
              {d.getDate()}
              {hasOptions && !isSelected && (
                <span
                  className={`absolute inset-x-0 bottom-1 mx-auto h-1 w-1 rounded-full ${
                    isToday ? "bg-red-400" : "bg-red-400"
                  }`}
                />
              )}
              {isToday && !isSelected && !hasOptions && (
                <span className="absolute inset-0 m-auto h-1 w-1 rounded-full bg-red-400" />
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ConfirmBook({
  picked,
  hostName,
  loggedIn,
}: {
  picked: { slot: BookSlot; start_at: string; availability_id: string | null };
  hostName: string;
  loggedIn: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  const toast = useToast();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loggedIn && (!name.trim() || !email.trim())) {
      toast.error("이름과 이메일을 입력하세요.");
      return;
    }
    startTransition(async () => {
      const res = await bookSlot({
        slotId: picked.slot.id,
        availabilityId: picked.availability_id ?? undefined,
        startAt: picked.availability_id ? undefined : picked.start_at,
        message: message.trim() || undefined,
        guest_name: loggedIn ? undefined : name.trim(),
        guest_email: loggedIn ? undefined : email.trim(),
      });
      if (res.error) return toast.error(res.error);
      setDone(true);
      router.refresh();
    });
  };

  if (done) {
    return (
      <div className="rounded-2xl border border-emerald-700/40 bg-emerald-700/10 p-5 text-sm text-emerald-300">
        예약이 완료되었습니다. {hostName}의 캘린더에 이벤트가 추가되었고
        확인 메일이 발송됩니다.
      </div>
    );
  }

  const start = new Date(picked.start_at);
  return (
    <form
      onSubmit={submit}
      className="space-y-4 rounded-2xl border border-red-500/40 bg-red-500/5 p-5"
    >
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-red-300">
          선택된 시간
        </p>
        <p className="mt-1 text-base font-semibold text-charcoal-100">
          {picked.slot.title}
        </p>
        <p className="mt-0.5 text-sm text-charcoal-400">
          {start.toLocaleDateString("ko-KR", {
            month: "long",
            day: "numeric",
            weekday: "long",
          })}{" "}
          ·{" "}
          {start.toLocaleTimeString("ko-KR", {
            hour: "2-digit",
            minute: "2-digit",
          })}{" "}
          · {picked.slot.duration_min}분
          {picked.slot.location_detail && ` · ${picked.slot.location_detail}`}
        </p>
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
        rows={2}
        placeholder="호스트에게 한 마디 (선택)"
        className="w-full rounded-lg border border-charcoal-800/40 bg-charcoal-900/60 px-3 py-2 text-sm text-charcoal-100"
      />

      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-charcoal-100">
          {picked.slot.price_cents === 0
            ? "무료"
            : `₩${(picked.slot.price_cents / 100).toLocaleString("ko-KR")}`}
        </p>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-red-500 px-5 py-2 text-sm font-semibold text-charcoal-950 hover:bg-red-400 disabled:opacity-60"
        >
          {pending ? "예약 중…" : "예약 확정"}
        </button>
      </div>
    </form>
  );
}

function atDayStart(d: Date) {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
