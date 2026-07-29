"use client";

import Link from "next/link";
import { slotTypeLabel } from "@/lib/constants";
import { createPortal } from "react-dom";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { getSlotPanelData, type SlotPanelData } from "@/lib/slot-panel";
import BookingForm from "@/app/[username]/s/[slug]/BookingForm";
import { SlotDatePreview } from "@/components/SlotDatePicker";

type OpenArgs = { slug: string; startAt?: string };

type Ctx = {
  open: (args: OpenArgs) => void;
  close: () => void;
  current: OpenArgs | null;
};

const SlotPanelContext = createContext<Ctx | null>(null);

export function useSlotPanel(): Ctx | null {
  return useContext(SlotPanelContext);
}

export function SlotPanelProvider({
  username,
  children,
}: {
  username: string;
  children: ReactNode;
}) {
  const [current, setCurrent] = useState<OpenArgs | null>(null);

  const open = useCallback((args: OpenArgs) => setCurrent(args), []);
  const close = useCallback(() => setCurrent(null), []);

  useEffect(() => {
    if (!current) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [current, close]);

  return (
    <SlotPanelContext.Provider value={{ open, close, current }}>
      {children}
      {current && (
        <SlotPanelDrawer
          username={username}
          slug={current.slug}
          startAt={current.startAt}
          onClose={close}
        />
      )}
    </SlotPanelContext.Provider>
  );
}

function SlotPanelDrawer({
  username,
  slug,
  startAt,
  onClose,
}: {
  username: string;
  slug: string;
  startAt?: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<SlotPanelData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    getSlotPanelData(username, slug)
      .then((res) => {
        if (cancelled) return;
        if ("error" in res) setError(res.error);
        else setData(res);
      })
      .catch(() => !cancelled && setError("불러오기에 실패했어요."));
    return () => {
      cancelled = true;
    };
  }, [username, slug]);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex">
      <button
        type="button"
        aria-label="Close panel"
        onClick={onClose}
        className="flex-1 bg-black/60 backdrop-blur-sm"
      />
      <aside
        role="dialog"
        aria-modal="true"
        className="relative flex h-full w-[min(480px,100vw)] flex-col overflow-hidden border-l border-charcoal-800/60 bg-[rgb(var(--bg-surface))] shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-charcoal-800/40 px-5 py-3.5">
          <Link
            href={`/${username}/s/${slug}${startAt ? `?t=${encodeURIComponent(startAt)}` : ""}`}
            className="text-2xs font-medium text-charcoal-500 hover:text-charcoal-200"
          >
            전체 페이지에서 보기 ↗
          </Link>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 flex h-7 w-7 items-center justify-center rounded-lg text-charcoal-500 hover:bg-charcoal-800/40 hover:text-charcoal-100"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 6l12 12M6 18L18 6" />
            </svg>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {!data && !error && (
            <div className="space-y-3">
              <div className="h-7 w-2/3 animate-pulse rounded-lg bg-charcoal-800/60" />
              <div className="h-4 w-1/2 animate-pulse rounded-lg bg-charcoal-800/40" />
              <div className="mt-6 h-28 animate-pulse rounded-xl bg-charcoal-800/30" />
            </div>
          )}
          {error && (
            <p className="rounded-lg border border-red-700/40 bg-red-700/10 p-4 text-sm text-red-200">
              {error}
            </p>
          )}
          {data && (
            <SlotPanelBody
              data={data}
              username={username}
              slug={slug}
              startAt={startAt}
            />
          )}
        </div>
      </aside>
    </div>,
    document.body,
  );
}

function SlotPanelBody({
  data,
  username,
  slug,
  startAt,
}: {
  data: SlotPanelData;
  username: string;
  slug: string;
  startAt?: string;
}) {
  const { slot, host, isAuction, isOwner, loggedIn, options, menus } = data;

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-baseline gap-2">
          <h2 className="text-xl font-bold text-charcoal-100">{slot.title}</h2>
          {!slot.active && (
            <span className="rounded-full bg-charcoal-700/40 px-2 py-0.5 text-2xs font-semibold text-charcoal-500">
              OFF
            </span>
          )}
        </div>
        <p className="mt-2 text-sm text-charcoal-400">
          {slot.duration_min}분 ·{" "}
          {isAuction
            ? `시작가 ₩${((slot.reserve_price_cents ?? 0) / 100).toLocaleString("ko-KR")}`
            : slot.price_cents === 0
              ? "Free"
              : `₩${(slot.price_cents / 100).toLocaleString("ko-KR")}`}
          {" · "}
          {slotTypeLabel(slot.slot_type)}
          {slot.location_detail && ` · ${slot.location_detail}`}
        </p>
        {slot.description && (
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-charcoal-300">
            {slot.description}
          </p>
        )}
        {menus.length > 0 && (
          <div className="mt-4 space-y-1.5 border-t border-charcoal-800/40 pt-4">
            <p className="text-2xs font-semibold uppercase tracking-wider text-charcoal-500">
              포함되는 서비스
            </p>
            <ul className="space-y-1">
              {menus.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="text-charcoal-200">{m.name}</span>
                  <span className="shrink-0 text-xs font-semibold text-charcoal-400">
                    {m.price_cents === 0
                      ? "Free"
                      : `+ ₩${(m.price_cents / 100).toLocaleString("ko-KR")}`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {isAuction ? (
        <div className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/30 p-5 text-sm text-charcoal-300">
          <p>이 슬롯은 경매 방식이에요.</p>
          <Link
            href={`/${username}/s/${slug}`}
            className="mt-3 inline-flex rounded-lg bg-navy-500 px-4 py-2 text-sm font-medium text-white hover:bg-navy-400"
          >
            경매 참여하기 →
          </Link>
        </div>
      ) : (
        <section className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/30 p-5">
          <h3 className="text-sm font-semibold text-charcoal-200">예약 가능한 시간</h3>
          {!slot.active ? (
            <p className="mt-3 text-sm text-charcoal-500">
              현재 예약을 받지 않는 슬롯이에요.
            </p>
          ) : options.length === 0 ? (
            <p className="mt-3 text-sm text-charcoal-500">
              예약 가능한 시간이 없어요. 잠시 후 다시 확인해주세요.
            </p>
          ) : isOwner ? (
            <div className="mt-4 space-y-3">
              <p className="text-xs text-charcoal-500">
                본인은 예약할 수 없지만, 게스트에게 노출되는 시간을 미리 확인할 수 있어요.
              </p>
              <SlotDatePreview options={options} />
            </div>
          ) : (
            <div className="mt-4">
              <BookingForm
                slotId={slot.id}
                options={
                  startAt
                    ? sortWithPreferred(options, startAt)
                    : options
                }
                loggedIn={loggedIn}
                priceCents={slot.price_cents}
                slotTitle={slot.title}
                hostUsername={host.username}
                hostLabel={host.display_name || host.username}
                locations={
                  slot.locations && slot.locations.length > 0
                    ? slot.locations
                    : slot.location_detail
                      ? [slot.location_detail]
                      : []
                }
                paymentMethod={slot.payment_method}
                menus={menus.map((m) => ({
                  id: m.id,
                  name: m.name,
                  category: m.category,
                  description: m.description,
                  price_cents: m.price_cents,
                }))}
              />
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function sortWithPreferred<T extends { start_at: string }>(
  options: T[],
  preferred: string,
): T[] {
  const idx = options.findIndex((o) => o.start_at === preferred);
  if (idx <= 0) return options;
  const copy = [...options];
  const [picked] = copy.splice(idx, 1);
  copy.unshift(picked);
  return copy;
}
