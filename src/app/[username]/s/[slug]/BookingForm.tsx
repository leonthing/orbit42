"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { bookSlot, refreshBookableOptions } from "@/lib/slots";
import type { BookableOption } from "@/lib/slots";
import { SlotDatePicker } from "@/components/SlotDatePicker";
import { useToast } from "@/components/Toast";

type Stage = "form" | "payment" | "done";

export type BookingMenu = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  price_cents: number;
};

export default function BookingForm({
  slotId,
  options: initialOptions,
  loggedIn,
  priceCents,
  slotTitle,
  hostUsername,
  hostLabel,
  locations = [],
  paymentMethod = "offline",
  menus = [],
}: {
  slotId: string;
  options: BookableOption[];
  loggedIn: boolean;
  priceCents: number;
  slotTitle: string;
  hostUsername: string;
  hostLabel: string;
  locations?: string[];
  paymentMethod?: "online" | "offline";
  menus?: BookingMenu[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [stage, setStage] = useState<Stage>("form");
  const [options, setOptions] = useState<BookableOption[]>(initialOptions);
  const [selectedLocation, setSelectedLocation] = useState<string>(
    locations[0] ?? "",
  );
  const [locPending, setLocPending] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string>(() =>
    initialOptions[0] ? keyOf(initialOptions[0]) : "",
  );
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [selectedMenus, setSelectedMenus] = useState<string[]>([]);

  // When the guest switches location, re-request bookable options so
  // the buffer math reflects the new target.
  useEffect(() => {
    if (locations.length <= 1) return;
    if (!selectedLocation) return;
    if (selectedLocation === (locations[0] ?? "")) {
      // Initial value — initialOptions already matches this, skip refetch.
      setOptions(initialOptions);
      return;
    }
    let canceled = false;
    setLocPending(true);
    refreshBookableOptions(slotId, selectedLocation)
      .then((next) => {
        if (canceled) return;
        setOptions(next);
        setSelectedKey(next[0] ? keyOf(next[0]) : "");
      })
      .finally(() => {
        if (!canceled) setLocPending(false);
      });
    return () => {
      canceled = true;
    };
  }, [selectedLocation, slotId, locations, initialOptions]);

  const menuTotalCents = selectedMenus.reduce((sum, id) => {
    const m = menus.find((x) => x.id === id);
    return sum + (m?.price_cents ?? 0);
  }, 0);
  const totalCents = priceCents + menuTotalCents;

  const selectedOpt = options.find((o) => keyOf(o) === selectedKey) ?? null;
  const isPaid = totalCents > 0;

  const proceed = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOpt) return;
    if (!loggedIn && (!name.trim() || !email.trim())) {
      toast.error("이름과 이메일을 입력하세요.");
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
        selected_menu_ids: selectedMenus,
        selected_location: selectedLocation || undefined,
      });
      if (res.error) return toast.error(res.error);
      setStage("done");
      router.refresh();
    });
  };

  if (stage === "done") {
    const whenLabel = selectedOpt
      ? new Date(selectedOpt.start_at).toLocaleString("ko-KR", {
          timeZone: "Asia/Seoul",
          year: "numeric",
          month: "long",
          day: "numeric",
          weekday: "short",
          hour: "2-digit",
          minute: "2-digit",
        })
      : null;
    return (
      <div className="space-y-5">
        <div className="rounded-xl border border-emerald-700/40 bg-emerald-700/10 p-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-emerald-300">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
            예약이 완료됐어요
          </p>
          <p className="mt-2 text-sm text-charcoal-100">
            <strong>{slotTitle}</strong> · {hostLabel}
          </p>
          {whenLabel && (
            <p className="mt-0.5 text-xs text-charcoal-400">{whenLabel}</p>
          )}
          {selectedLocation && (
            <p className="mt-0.5 text-xs text-charcoal-400">📍 {selectedLocation}</p>
          )}
          <p className="mt-3 text-xs text-charcoal-500">
            등록하신 이메일로 확인 메일이 발송됐어요. 호스트의 캘린더에도 자동으로 일정이 추가됩니다.
          </p>
        </div>

        {!loggedIn && (
          <div className="rounded-2xl border border-red-500/30 bg-gradient-to-br from-red-600/10 to-charcoal-900/40 p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-red-400">
              Orbit42
            </p>
            <h3 className="mt-1 text-lg font-bold text-charcoal-50">
              @{hostUsername} 처럼 나만의 궤도 만들기
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-charcoal-300">
              시간을 공유하고 예약받는 나만의 페이지를 30초 만에 만들 수 있어요.
              지금 가입하면 @{hostUsername} 님과 자동으로 연결돼 첫 궤도가 생겨요.
            </p>
            <ul className="mt-4 space-y-1.5 text-xs text-charcoal-400">
              <li className="flex gap-2">
                <span className="text-red-400">◦</span> 구글 캘린더 연동 → 가능한 시간 자동 계산
              </li>
              <li className="flex gap-2">
                <span className="text-red-400">◦</span> 링크 하나로 예약받기 (무료/유료/경매)
              </li>
              <li className="flex gap-2">
                <span className="text-red-400">◦</span> 시간 인사이트 · 업무/개인 시간 분석
              </li>
            </ul>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <a
                href={`/?mode=signup&ref=${encodeURIComponent(hostUsername)}#auth`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500"
              >
                내 궤도 만들기 →
              </a>
              <a
                href="/explore"
                className="text-xs text-charcoal-500 hover:text-charcoal-300"
              >
                먼저 둘러보기
              </a>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (stage === "payment" && selectedOpt) {
    return (
      <PaymentStep
        priceCents={totalCents}
        slotTitle={slotTitle}
        when={selectedOpt.start_at}
        pending={pending}
        paymentMethod={paymentMethod}
        onCancel={() => setStage("form")}
        onPay={doBook}
      />
    );
  }

  return (
    <form onSubmit={proceed} className="space-y-5">
      {locations.length >= 1 && (
        <div className="rounded-lg border border-charcoal-800/60 bg-charcoal-900/40 p-4">
          <p className="mb-2 text-xs font-semibold text-charcoal-200">
            어디서 만날까요?
          </p>
          <div className="flex flex-wrap gap-1.5">
            {locations.map((loc) => {
              const active = selectedLocation === loc;
              return (
                <button
                  key={loc}
                  type="button"
                  onClick={() => setSelectedLocation(loc)}
                  disabled={locPending || locations.length === 1}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    active
                      ? "border-red-500 bg-red-500/15 text-red-700 dark:text-red-300"
                      : "border-charcoal-800/60 bg-charcoal-800/20 text-charcoal-300 hover:border-charcoal-700"
                  }`}
                >
                  📍 {loc}
                </button>
              );
            })}
          </div>
          {locations.length > 1 ? (
            <p className="mt-2 text-[11px] text-charcoal-500">
              선택한 위치에서 호스트 일정에 따라 가능한 시간만 보여져요.
              {locPending && " · 시간 다시 계산 중…"}
            </p>
          ) : (
            <p className="mt-2 text-[11px] text-charcoal-500">
              이 위치에서 만나요.
            </p>
          )}
        </div>
      )}

      {options.length === 0 ? (
        <p className="rounded-lg border border-charcoal-800/60 bg-charcoal-900/30 px-4 py-6 text-center text-sm text-charcoal-500">
          {selectedLocation
            ? `${selectedLocation} 에서 만날 수 있는 시간이 없어요. 다른 위치를 골라보세요.`
            : "예약 가능한 시간이 없어요."}
        </p>
      ) : (
        <SlotDatePicker
          options={options}
          selectedKey={selectedKey}
          onSelect={setSelectedKey}
          keyOf={keyOf}
        />
      )}

      {menus.length > 0 && (
        <BookingMenuPicker
          menus={menus}
          selected={selectedMenus}
          onChange={setSelectedMenus}
          baseCents={priceCents}
          totalCents={totalCents}
        />
      )}

      {!loggedIn && (
        <>
          <p className="-mb-1 rounded-md bg-charcoal-800/30 px-3 py-2 text-[11px] leading-relaxed text-charcoal-500">
            계정이 없어도 예약할 수 있어요. 입력한 이메일로 확인 메일이 가요.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
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
        </>
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
        {pending
          ? "예약 중…"
          : totalCents > 0
            ? `${(totalCents / 100).toLocaleString("ko-KR")}원 · 예약 진행`
            : "무료 예약하기"}
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
  paymentMethod,
  onCancel,
  onPay,
}: {
  priceCents: number;
  slotTitle: string;
  when: string;
  pending: boolean;
  paymentMethod: "online" | "offline";
  onCancel: () => void;
  onPay: () => void;
}) {
  const [acknowledged, setAcknowledged] = useState(false);
  return (
    <div className="space-y-4 rounded-xl border border-charcoal-800/60 bg-charcoal-900/40 p-5">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-charcoal-500">
          결제 확인
        </p>
        <p className="mt-2 text-sm text-charcoal-200">{slotTitle}</p>
        <p className="mt-1 text-xs text-charcoal-500">
          {new Date(when).toLocaleString("ko-KR", {
            timeZone: "Asia/Seoul",
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

      {paymentMethod === "offline" ? (
        <div className="rounded-lg border border-charcoal-700 bg-charcoal-800/40 p-3 text-xs leading-relaxed text-charcoal-300">
          <p className="font-semibold text-charcoal-100">
            만나서 호스트에게 직접 결제
          </p>
          <p className="mt-1">
            예약을 먼저 확정하고, 호스트가 별도로 결제 안내를 드려요. 약속
            장소에서 현장 결제하시면 돼요.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-amber-600/40 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">
          온라인 결제 기능은 아직 준비 중이에요. 지금은 예약을 먼저
          확정하고, 호스트가 결제 안내를 드려요.
        </div>
      )}

      <label className="flex items-start gap-2 text-xs text-charcoal-400">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => setAcknowledged(e.target.checked)}
          className="mt-0.5 accent-red-500"
        />
        <span>
          {paymentMethod === "offline"
            ? "호스트와 만나서 직접 결제한다는 점에 동의하고 예약을 확정합니다."
            : "호스트와 직접 결제를 진행한다는 점에 동의하고 예약을 확정합니다."}
        </span>
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
          className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-charcoal-800 disabled:text-charcoal-500"
        >
          {pending ? "예약 중…" : "예약 확정"}
        </button>
      </div>
    </div>
  );
}

function keyOf(o: BookableOption): string {
  return o.availability_id ?? o.start_at;
}

function BookingMenuPicker({
  menus,
  selected,
  onChange,
  baseCents,
  totalCents,
}: {
  menus: BookingMenu[];
  selected: string[];
  onChange: (ids: string[]) => void;
  baseCents: number;
  totalCents: number;
}) {
  const toggle = (id: string) => {
    onChange(
      selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id],
    );
  };
  const grouped = new Map<string, BookingMenu[]>();
  for (const m of menus) {
    const key = m.category?.trim() || "메뉴";
    const list = grouped.get(key) ?? [];
    list.push(m);
    grouped.set(key, list);
  }
  return (
    <div className="space-y-3 rounded-lg border border-charcoal-800/60 bg-charcoal-900/40 p-4">
      <p className="text-xs font-semibold text-charcoal-100">서비스 선택</p>
      {Array.from(grouped.entries()).map(([cat, items]) => (
        <div key={cat}>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-charcoal-500">
            {cat}
          </p>
          <ul className="space-y-1.5">
            {items.map((m) => {
              const active = selected.includes(m.id);
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => toggle(m.id)}
                    className={`flex w-full items-start justify-between gap-3 rounded-md border px-3 py-2 text-left transition-colors ${
                      active
                        ? "border-red-500 bg-red-500/10"
                        : "border-charcoal-800/60 bg-charcoal-800/10 hover:border-charcoal-700"
                    }`}
                  >
                    <span className="flex min-w-0 items-start gap-2">
                      <span
                        aria-hidden
                        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                          active ? "border-red-500 bg-red-500" : "border-charcoal-600"
                        }`}
                      >
                        {active && (
                          <span className="h-1.5 w-1.5 rounded-full bg-white" />
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-charcoal-100">
                          {m.name}
                        </span>
                        {m.description && (
                          <span className="mt-0.5 block text-xs text-charcoal-500">
                            {m.description}
                          </span>
                        )}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-semibold text-charcoal-300">
                      {m.price_cents === 0
                        ? "Free"
                        : `+ ₩${(m.price_cents / 100).toLocaleString("ko-KR")}`}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      <div className="flex items-center justify-between border-t border-charcoal-800/60 pt-3 text-xs">
        <span className="text-charcoal-500">
          기본 ₩{(baseCents / 100).toLocaleString("ko-KR")}
          {selected.length > 0 && (
            <>
              {" "}· 메뉴 ₩
              {((totalCents - baseCents) / 100).toLocaleString("ko-KR")}
            </>
          )}
        </span>
        <span className="text-sm font-semibold text-charcoal-100">
          총 ₩{(totalCents / 100).toLocaleString("ko-KR")}
        </span>
      </div>
    </div>
  );
}
