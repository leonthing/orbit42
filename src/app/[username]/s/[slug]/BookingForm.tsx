"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { bookSlot, refreshBookableOptions } from "@/lib/slots";
import { funnelVia, reportFunnel } from "@/lib/funnel-client";
import type { BookableOption } from "@/lib/slots";
import { findMyConflicts } from "@/lib/mutual-availability";
import { SlotDatePicker } from "@/components/SlotDatePicker";
import { useToast } from "@/components/Toast";

type Stage = "form" | "done";

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
  const [awaitingHost, setAwaitingHost] = useState(false);
  const [payment, setPayment] = useState<{ instructions: string; amountCents: number; dueAt: string } | null>(null);
  const [copiedPay, setCopiedPay] = useState(false);
  const [options, setOptions] = useState<BookableOption[]>(initialOptions);
  const [selectedLocation, setSelectedLocation] = useState<string>(
    locations[0] ?? "",
  );
  const [locPending, setLocPending] = useState(false);
  // 첫 시간을 미리 고르지 않는다 — 방문자가 직접 고른 것만 '시간 고름'으로 센다 (개선-41)
  const [selectedKey, setSelectedKey] = useState<string>("");
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [selectedMenus, setSelectedMenus] = useState<string[]>([]);
  // 방문 흐름 ③ 시간 고름 — 방문자가 직접 시간을 누른 첫 번째만 (개선-32)
  const [reportedPick, setReportedPick] = useState(false);
  const pickTime = (key: string) => {
    setSelectedKey(key);
    if (!reportedPick) {
      setReportedPick(true);
      reportFunnel(slotId, "time_picked");
    }
  };
  // Mutual free-time: viewer's own busy times, fetched on demand.
  const [onlyMyFree, setOnlyMyFree] = useState(false);
  const [myConflicts, setMyConflicts] = useState<Set<string> | null>(null);
  const [conflictsLoading, setConflictsLoading] = useState(false);

  useEffect(() => {
    if (!onlyMyFree || myConflicts !== null) return;
    let canceled = false;
    setConflictsLoading(true);
    findMyConflicts(
      options.map((o) => ({ start_at: o.start_at, end_at: o.end_at })),
    )
      .then((list) => {
        if (canceled) return;
        setMyConflicts(new Set(list ?? []));
      })
      .finally(() => {
        if (!canceled) setConflictsLoading(false);
      });
    return () => {
      canceled = true;
    };
  }, [onlyMyFree, myConflicts, options]);

  // Location change recomputes options — stale conflicts must refetch.
  useEffect(() => {
    setMyConflicts(null);
  }, [selectedLocation]);

  const visibleOptions =
    onlyMyFree && myConflicts
      ? options.filter((o) => !myConflicts.has(o.start_at))
      : options;

  // If the filter hides the currently selected time, move to the first
  // visible one so the submit button never points at a hidden option.
  useEffect(() => {
    if (!onlyMyFree || !myConflicts) return;
    const cur = options.find((o) => keyOf(o) === selectedKey);
    if (cur && myConflicts.has(cur.start_at)) {
      const next = options.find((o) => !myConflicts.has(o.start_at));
      setSelectedKey(next ? keyOf(next) : "");
    }
  }, [onlyMyFree, myConflicts, options, selectedKey]);

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
        setSelectedKey("");
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
    // 유료도 동의 체크 단계 없이 한 번에 — 결제 안내는 버튼 위 한 줄 (개선-41)
    doBook();
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
        funnelVia: funnelVia(slotId) ?? null,
      });
      if (res.error) return toast.error(res.error);
      setAwaitingHost("status" in res && res.status === "pending");
      setPayment("payment" in res && res.payment ? res.payment : null);
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
        <div
          className={`rounded-xl border p-5 ${
            awaitingHost ? "border-amber-500/40 bg-amber-500/10" : "border-emerald-600/40 bg-emerald-600/10"
          }`}
        >
          <p
            className={`flex items-center gap-2 text-sm font-semibold ${
              awaitingHost ? "text-amber-600 dark:text-amber-300" : "text-emerald-600 dark:text-emerald-300"
            }`}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              {awaitingHost ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              )}
            </svg>
            {payment ? "입금하시면 예약이 확정돼요" : awaitingHost ? "예약 요청을 보냈어요" : "예약이 완료됐어요"}
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
            {payment
              ? "아래 안내대로 입금하면 호스트가 확인 후 확정 메일을 보내드려요. 같은 안내를 메일로도 보냈어요."
              : awaitingHost
              ? "호스트가 확인하면 확정 메일을 보내드려요. 그 전까지는 일정이 확정되지 않아요."
              : "등록하신 이메일로 확인 메일이 발송됐어요. 호스트의 캘린더에도 자동으로 일정이 추가됩니다."}
          </p>
        </div>

        {payment && (
          <div className="rounded-xl border border-charcoal-800/60 bg-[rgb(var(--bg-surface))] p-5">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-semibold text-charcoal-100">입금 안내</p>
              <p className="text-lg font-bold text-charcoal-50">
                {Math.round(payment.amountCents / 100).toLocaleString("ko-KR")}원
              </p>
            </div>
            <p className="mt-3 whitespace-pre-wrap rounded-lg bg-charcoal-800/40 px-3 py-2.5 text-sm text-charcoal-100">
              {payment.instructions}
            </p>
            <div className="mt-3 flex items-center justify-between gap-2">
              <p className="text-xs text-charcoal-500">
                {new Date(payment.dueAt).toLocaleString("ko-KR", {
                  timeZone: "Asia/Seoul",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                까지 입금해 주세요. 지나면 자동으로 취소돼요.
              </p>
              <button
                type="button"
                className="shrink-0 rounded-lg border border-charcoal-700 px-3 py-1.5 text-xs font-semibold text-charcoal-200 hover:border-charcoal-500"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(payment.instructions);
                    setCopiedPay(true);
                    setTimeout(() => setCopiedPay(false), 2000);
                  } catch {
                    /* 클립보드 권한이 없으면 사용자가 직접 복사 */
                  }
                }}
              >
                {copiedPay ? "복사됨" : "안내 복사"}
              </button>
            </div>
          </div>
        )}

        <p className="text-center text-xs text-charcoal-500">
          {loggedIn ? "예약 확인 메일을 보냈어요." : "예약 확인·변경 링크를 메일로 보냈어요. 로그인 없이 보고 취소하거나 다른 시간으로 바꿀 수 있어요."}
        </p>
        {/* 나도 내 예약 링크 만들기 — 담담하게 한 줄 (1.6.0 ②) */}
        <p className="text-center text-xs text-charcoal-500">
          나도 이런 예약 링크를 만들 수 있어요 ·{" "}
          <a href={`/signup?ref=${encodeURIComponent(hostUsername)}`} className="text-charcoal-300 underline underline-offset-2">
            Orbit42에서 만들기
          </a>
        </p>
      </div>
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
                      ? "border-navy-400 bg-navy-400/15 text-navy-600 dark:text-navy-300"
                      : "border-charcoal-800/60 bg-charcoal-800/20 text-charcoal-300 hover:border-charcoal-700"
                  }`}
                >
                  📍 {loc}
                </button>
              );
            })}
          </div>
          {locations.length > 1 ? (
            <p className="mt-2 text-2xs text-charcoal-500">
              선택한 위치에서 호스트 일정에 따라 가능한 시간만 보여져요.
              {locPending && " · 시간 다시 계산 중…"}
            </p>
          ) : (
            <p className="mt-2 text-2xs text-charcoal-500">
              이 위치에서 만나요.
            </p>
          )}
        </div>
      )}

      {loggedIn && options.length > 0 && (
        <label className="flex w-fit cursor-pointer items-center gap-2 text-xs text-charcoal-400">
          <input
            type="checkbox"
            checked={onlyMyFree}
            onChange={(e) => setOnlyMyFree(e.target.checked)}
            className="h-3.5 w-3.5 accent-navy-400"
          />
          내가 비는 시간만 보기
          {conflictsLoading && (
            <span className="text-charcoal-600">· 내 캘린더 확인 중…</span>
          )}
          {onlyMyFree && myConflicts && !conflictsLoading && (
            <span className="text-charcoal-600">
              · 둘 다 가능한 시간 {visibleOptions.length}개
            </span>
          )}
        </label>
      )}

      {options.length === 0 ? (
        <p className="rounded-lg border border-charcoal-800/60 bg-charcoal-900/30 px-4 py-6 text-center text-sm text-charcoal-500">
          {selectedLocation
            ? `${selectedLocation} 에서 만날 수 있는 시간이 없어요. 다른 위치를 골라보세요.`
            : "예약 가능한 시간이 없어요."}
        </p>
      ) : visibleOptions.length === 0 ? (
        <p className="rounded-lg border border-charcoal-800/60 bg-charcoal-900/30 px-4 py-6 text-center text-sm text-charcoal-500">
          겹치는 빈 시간이 없네요. 필터를 끄거나 호스트에게 시간을 요청해보세요.
        </p>
      ) : (
        <SlotDatePicker
          options={visibleOptions}
          selectedKey={selectedKey}
          onSelect={pickTime}
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
          <p className="-mb-1 rounded-lg bg-charcoal-800/30 px-3 py-2 text-2xs leading-relaxed text-charcoal-500">
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

      {isPaid && (
        <p className="text-xs leading-relaxed text-charcoal-400">
          {paymentMethod === "offline"
            ? "예약하면 호스트의 결제 안내(계좌이체 등)를 보여 드리고 메일로도 보내 드려요. 결제는 호스트와 직접 해요."
            : "온라인 결제는 준비 중이라, 예약 후 호스트가 결제 방법을 안내해 드려요."}
        </p>
      )}
      {!selectedKey && options.length > 0 && (
        <p className="text-center text-xs text-charcoal-500">위에서 시간을 먼저 골라 주세요</p>
      )}
      <button
        type="submit"
        disabled={pending || !selectedKey}
        className="w-full rounded-lg bg-navy-500 px-4 py-3 text-sm font-medium text-white hover:bg-navy-400 disabled:opacity-60"
      >
        {pending
          ? "예약 중…"
          : totalCents > 0
            ? `${(totalCents / 100).toLocaleString("ko-KR")}원 · 예약하기`
            : "무료 예약하기"}
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
          <p className="mb-1.5 text-2xs font-semibold uppercase tracking-wider text-charcoal-500">
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
                    className={`flex w-full items-start justify-between gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${
                      active
                        ? "border-navy-400 bg-navy-400/10"
                        : "border-charcoal-800/60 bg-charcoal-800/10 hover:border-charcoal-700"
                    }`}
                  >
                    <span className="flex min-w-0 items-start gap-2">
                      <span
                        aria-hidden
                        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                          active ? "border-navy-400 bg-navy-400" : "border-charcoal-600"
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
                        ? "무료"
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
