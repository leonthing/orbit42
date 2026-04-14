"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createSlot,
  deleteSlot,
  addAvailability,
  removeAvailability,
  updateSlot,
} from "@/lib/slots";
import type {
  TimeSlot,
  Availability,
  SlotType,
  SlotMode,
  PricingModel,
} from "@/lib/slots";
import type { WorkingHours } from "@/lib/slot-availability";

type Row = { slot: TimeSlot; availabilities: Availability[] };
const DAYS = [
  { key: "mon", label: "월" },
  { key: "tue", label: "화" },
  { key: "wed", label: "수" },
  { key: "thu", label: "목" },
  { key: "fri", label: "금" },
  { key: "sat", label: "토" },
  { key: "sun", label: "일" },
] as const;

export default function SlotsManager({
  username,
  initial,
}: {
  username: string;
  initial: Row[];
}) {
  const router = useRouter();
  const [showNew, setShowNew] = useState(initial.length === 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-charcoal-100">Slots</h1>
          <p className="mt-1 text-sm text-charcoal-500">
            팔거나 나눠줄 시간을 슬롯으로 만들어 공유하세요.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowNew((s) => !s)}
          className="rounded-lg bg-navy-600 px-4 py-2 text-sm font-medium text-white hover:bg-navy-500"
        >
          {showNew ? "닫기" : "+ New slot"}
        </button>
      </div>

      {showNew && (
        <NewSlotForm
          onSaved={() => {
            setShowNew(false);
            router.refresh();
          }}
        />
      )}

      {initial.length === 0 && !showNew && (
        <div className="rounded-xl border border-dashed border-charcoal-800/60 p-10 text-center">
          <p className="text-sm font-semibold text-charcoal-200">아직 슬롯이 없어요</p>
          <p className="mt-2 text-sm text-charcoal-500">
            첫 슬롯을 만들어 누군가의 궤도에 올려보세요.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {initial.map((row) => (
          <SlotCard key={row.slot.id} row={row} username={username} />
        ))}
      </div>
    </div>
  );
}

function NewSlotForm({ onSaved }: { onSaved: () => void }) {
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState(30);
  const [price, setPrice] = useState(0);
  const [capacity, setCapacity] = useState(1);
  const [slotType, setSlotType] = useState<SlotType>("1on1");
  const [locationDetail, setLocationDetail] = useState("");
  const [mode, setMode] = useState<SlotMode>("manual");
  const [pricingModel, setPricingModel] = useState<PricingModel>("fixed");

  // Auction
  const [reservePrice, setReservePrice] = useState(10000);
  const [auctionEndsAt, setAuctionEndsAt] = useState("");

  // Manual
  const [windows, setWindows] = useState<string[]>([]);
  const [newWindow, setNewWindow] = useState("");

  // Auto
  const [workingHours, setWorkingHours] = useState<WorkingHours>({
    mon: [{ start: "10:00", end: "18:00" }],
    tue: [{ start: "10:00", end: "18:00" }],
    wed: [{ start: "10:00", end: "18:00" }],
    thu: [{ start: "10:00", end: "18:00" }],
    fri: [{ start: "10:00", end: "18:00" }],
  });
  const [slotInterval, setSlotInterval] = useState(30);
  const [minNotice, setMinNotice] = useState(4);
  const [maxAdvance, setMaxAdvance] = useState(30);
  const [buffer, setBuffer] = useState(0);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return alert("제목을 입력하세요.");
    if (pricingModel === "auction") {
      if (windows.length === 0) return alert("경매는 시간 한 개를 지정해야 해요.");
      if (!auctionEndsAt) return alert("경매 종료 시간을 정해주세요.");
      const ends = new Date(auctionEndsAt);
      const slotTime = new Date(windows[0]);
      if (ends >= slotTime)
        return alert("경매 종료 시간은 슬롯 시간보다 앞이어야 합니다.");
    }
    startTransition(async () => {
      const res = await createSlot({
        title: title.trim(),
        description: description.trim() || null,
        duration_min: duration,
        price_cents: pricingModel === "auction" ? 0 : Math.round(price) * 100,
        capacity,
        slot_type: slotType,
        location_detail: locationDetail.trim() || null,
        mode: pricingModel === "auction" ? "manual" : mode,
        pricing_model: pricingModel,
        ...(pricingModel === "auction"
          ? {
              reserve_price_cents: Math.round(reservePrice) * 100,
              auction_ends_at: new Date(auctionEndsAt).toISOString(),
              availability_starts: [new Date(windows[0]).toISOString()],
            }
          : mode === "manual"
            ? {
                availability_starts: windows
                  .filter(Boolean)
                  .map((w) => new Date(w).toISOString()),
              }
            : {
                working_hours: workingHours,
                slot_interval_min: slotInterval,
                min_notice_hours: minNotice,
                max_advance_days: maxAdvance,
                buffer_min: buffer,
              }),
      });
      if (res.error) return alert(res.error);
      onSaved();
    });
  };

  return (
    <form
      onSubmit={submit}
      className="space-y-4 rounded-xl border border-charcoal-800/60 bg-charcoal-900/30 p-5"
    >
      <Field label="Title">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="예: 30분 1:1 커피챗"
          className="input"
          required
        />
      </Field>
      <Field label="Description">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="이 시간에는 무엇을 함께하나요?"
          className="input"
        />
      </Field>
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Duration (min)">
          <input
            type="number"
            min={5}
            step={5}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="input"
          />
        </Field>
        <Field label="Price (KRW)">
          <input
            type="number"
            min={0}
            step={1000}
            value={price}
            onChange={(e) => setPrice(Number(e.target.value))}
            className="input"
          />
        </Field>
        <Field label="Capacity">
          <input
            type="number"
            min={1}
            value={capacity}
            onChange={(e) => setCapacity(Number(e.target.value))}
            className="input"
          />
        </Field>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Type">
          <select
            value={slotType}
            onChange={(e) => setSlotType(e.target.value as SlotType)}
            className="input"
          >
            <option value="1on1">1:1</option>
            <option value="companion">동행</option>
            <option value="group">그룹</option>
          </select>
        </Field>
        <Field label="Location (optional)">
          <input
            type="text"
            value={locationDetail}
            onChange={(e) => setLocationDetail(e.target.value)}
            placeholder="예: 성수동 / Zoom"
            className="input"
          />
        </Field>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-charcoal-400">가격 모델</p>
        <div className="flex gap-2">
          <PricingButton
            current={pricingModel}
            value="fixed"
            onClick={() => setPricingModel("fixed")}
          >
            Fixed price
            <span className="block text-[10px] font-normal text-charcoal-500">
              정해진 가격으로 예약
            </span>
          </PricingButton>
          <PricingButton
            current={pricingModel}
            value="auction"
            onClick={() => setPricingModel("auction")}
          >
            Auction
            <span className="block text-[10px] font-normal text-charcoal-500">
              경매로 최고가 낙찰
            </span>
          </PricingButton>
        </div>
      </div>

      {pricingModel === "fixed" && (
        <div>
          <p className="mb-2 text-xs font-medium text-charcoal-400">시간 선택 방식</p>
          <div className="flex gap-2">
            <ModeButton current={mode} value="manual" onClick={() => setMode("manual")}>
              Manual
              <span className="block text-[10px] font-normal text-charcoal-500">
                내가 직접 시간을 추가
              </span>
            </ModeButton>
            <ModeButton current={mode} value="auto" onClick={() => setMode("auto")}>
              Auto (Google)
              <span className="block text-[10px] font-normal text-charcoal-500">
                빈 시간 자동 계산
              </span>
            </ModeButton>
          </div>
        </div>
      )}

      {pricingModel === "auction" && (
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="시작가 (KRW)">
            <input
              type="number"
              min={0}
              step={1000}
              value={reservePrice}
              onChange={(e) => setReservePrice(Number(e.target.value))}
              className="input"
            />
          </Field>
          <Field label="경매 종료 시간">
            <input
              type="datetime-local"
              value={auctionEndsAt}
              onChange={(e) => setAuctionEndsAt(e.target.value)}
              className="input"
              required
            />
          </Field>
        </div>
      )}

      {pricingModel === "auction" ? (
        <ManualWindows
          windows={windows}
          setWindows={(w) => {
            const next = typeof w === "function" ? w(windows) : w;
            setWindows(next.slice(-1)); // auction: only one time
          }}
          newWindow={newWindow}
          setNewWindow={setNewWindow}
        />
      ) : mode === "manual" ? (
        <ManualWindows
          windows={windows}
          setWindows={setWindows}
          newWindow={newWindow}
          setNewWindow={setNewWindow}
        />
      ) : (
        <AutoConfig
          workingHours={workingHours}
          setWorkingHours={setWorkingHours}
          slotInterval={slotInterval}
          setSlotInterval={setSlotInterval}
          minNotice={minNotice}
          setMinNotice={setMinNotice}
          maxAdvance={maxAdvance}
          setMaxAdvance={setMaxAdvance}
          buffer={buffer}
          setBuffer={setBuffer}
        />
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-navy-600 px-4 py-2 text-sm font-medium text-white hover:bg-navy-500 disabled:opacity-60"
        >
          {pending ? "저장 중…" : "Create slot"}
        </button>
      </div>

      <style jsx>{`
        .input {
          width: 100%;
          border-radius: 0.5rem;
          background-color: rgba(31, 31, 35, 0.5);
          border: 1px solid rgb(63 63 70 / 0.4);
          color: rgb(229 229 229);
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          outline: none;
        }
        .input:focus {
          border-color: rgb(59 130 246 / 0.5);
        }
      `}</style>
    </form>
  );
}

function PricingButton({
  current,
  value,
  onClick,
  children,
}: {
  current: PricingModel;
  value: PricingModel;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const active = current === value;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-lg border px-4 py-2 text-left text-sm font-medium ${
        active
          ? "border-amber-500/50 bg-amber-500/10 text-amber-200"
          : "border-charcoal-800/60 bg-charcoal-800/20 text-charcoal-300 hover:border-charcoal-700"
      }`}
    >
      {children}
    </button>
  );
}

function ModeButton({
  current,
  value,
  onClick,
  children,
}: {
  current: SlotMode;
  value: SlotMode;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const active = current === value;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-lg border px-4 py-2 text-left text-sm font-medium ${
        active
          ? "border-navy-500 bg-navy-600/15 text-charcoal-100"
          : "border-charcoal-800/60 bg-charcoal-800/20 text-charcoal-300 hover:border-charcoal-700"
      }`}
    >
      {children}
    </button>
  );
}

function ManualWindows({
  windows,
  setWindows,
  newWindow,
  setNewWindow,
}: {
  windows: string[];
  setWindows: (w: string[] | ((w: string[]) => string[])) => void;
  newWindow: string;
  setNewWindow: (v: string) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-charcoal-400">
        가능한 시간 (여러 개 추가 가능)
      </p>
      <div className="flex gap-2">
        <input
          type="datetime-local"
          value={newWindow}
          onChange={(e) => setNewWindow(e.target.value)}
          className="input flex-1"
        />
        <button
          type="button"
          onClick={() => {
            if (!newWindow) return;
            setWindows((w) => [...w, newWindow]);
            setNewWindow("");
          }}
          className="rounded-lg border border-charcoal-700 px-3 py-2 text-sm text-charcoal-200 hover:border-charcoal-600"
        >
          추가
        </button>
      </div>
      {windows.length > 0 && (
        <ul className="mt-2 space-y-1">
          {windows.map((w, i) => (
            <li
              key={i}
              className="flex items-center justify-between rounded-md bg-charcoal-800/30 px-3 py-1.5 text-xs text-charcoal-300"
            >
              <span>{new Date(w).toLocaleString("ko-KR")}</span>
              <button
                type="button"
                onClick={() => setWindows((arr) => arr.filter((_, j) => j !== i))}
                className="text-charcoal-500 hover:text-red-400"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AutoConfig({
  workingHours,
  setWorkingHours,
  slotInterval,
  setSlotInterval,
  minNotice,
  setMinNotice,
  maxAdvance,
  setMaxAdvance,
  buffer,
  setBuffer,
}: {
  workingHours: WorkingHours;
  setWorkingHours: (w: WorkingHours) => void;
  slotInterval: number;
  setSlotInterval: (n: number) => void;
  minNotice: number;
  setMinNotice: (n: number) => void;
  maxAdvance: number;
  setMaxAdvance: (n: number) => void;
  buffer: number;
  setBuffer: (n: number) => void;
}) {
  const toggleDay = (key: (typeof DAYS)[number]["key"]) => {
    const next = { ...workingHours };
    if (next[key]?.length) {
      delete next[key];
    } else {
      next[key] = [{ start: "10:00", end: "18:00" }];
    }
    setWorkingHours(next);
  };

  const updateRange = (
    key: (typeof DAYS)[number]["key"],
    side: "start" | "end",
    val: string,
  ) => {
    const next = { ...workingHours };
    const cur = next[key]?.[0] ?? { start: "10:00", end: "18:00" };
    next[key] = [{ ...cur, [side]: val }];
    setWorkingHours(next);
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-xs font-medium text-charcoal-400">Working hours</p>
        <div className="space-y-2">
          {DAYS.map((d) => {
            const range = workingHours[d.key];
            const enabled = !!range && range.length > 0;
            return (
              <div
                key={d.key}
                className="flex items-center gap-3 rounded-md bg-charcoal-800/30 px-3 py-2"
              >
                <button
                  type="button"
                  onClick={() => toggleDay(d.key)}
                  className={`flex h-7 w-9 shrink-0 items-center justify-center rounded text-xs font-bold ${
                    enabled
                      ? "bg-navy-600 text-white"
                      : "bg-charcoal-700/50 text-charcoal-500"
                  }`}
                >
                  {d.label}
                </button>
                {enabled && range && (
                  <div className="flex flex-1 items-center gap-2 text-xs text-charcoal-300">
                    <input
                      type="time"
                      value={range[0]?.start ?? "10:00"}
                      onChange={(e) => updateRange(d.key, "start", e.target.value)}
                      className="rounded border border-charcoal-800/40 bg-charcoal-900/60 px-2 py-1 text-charcoal-100"
                    />
                    <span>—</span>
                    <input
                      type="time"
                      value={range[0]?.end ?? "18:00"}
                      onChange={(e) => updateRange(d.key, "end", e.target.value)}
                      className="rounded border border-charcoal-800/40 bg-charcoal-900/60 px-2 py-1 text-charcoal-100"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Field label="Slot interval (min)">
          <input
            type="number"
            min={5}
            step={5}
            value={slotInterval}
            onChange={(e) => setSlotInterval(Number(e.target.value))}
            className="input"
          />
        </Field>
        <Field label="Min notice (hr)">
          <input
            type="number"
            min={0}
            value={minNotice}
            onChange={(e) => setMinNotice(Number(e.target.value))}
            className="input"
          />
        </Field>
        <Field label="Max advance (days)">
          <input
            type="number"
            min={1}
            max={365}
            value={maxAdvance}
            onChange={(e) => setMaxAdvance(Number(e.target.value))}
            className="input"
          />
        </Field>
        <Field label="Buffer (min)">
          <input
            type="number"
            min={0}
            value={buffer}
            onChange={(e) => setBuffer(Number(e.target.value))}
            className="input"
          />
        </Field>
      </div>

      <p className="text-xs text-charcoal-500">
        Auto 모드는 Google Calendar의 빈 시간을 읽어와 working hours 안에서
        자동으로 예약 가능 시간을 생성합니다. 캘린더 연결이 필요해요.
      </p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-charcoal-400">{label}</span>
      {children}
    </label>
  );
}

function SlotCard({ row, username }: { row: Row; username: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [newWindow, setNewWindow] = useState("");
  const [copied, setCopied] = useState(false);

  const publicUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/${username}/s/${row.slot.slug}`
      : `/${username}/s/${row.slot.slug}`;

  const toggleActive = () =>
    startTransition(async () => {
      await updateSlot(row.slot.id, { active: !row.slot.active });
      router.refresh();
    });

  const remove = () => {
    if (!confirm("이 슬롯을 삭제할까요?")) return;
    startTransition(async () => {
      await deleteSlot(row.slot.id);
      router.refresh();
    });
  };

  const addWindow = () => {
    if (!newWindow) return;
    startTransition(async () => {
      const res = await addAvailability(row.slot.id, new Date(newWindow).toISOString());
      if (res.error) return alert(res.error);
      setNewWindow("");
      router.refresh();
    });
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <div className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/30 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-base font-semibold text-charcoal-100">
              {row.slot.title}
            </h2>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                row.slot.active
                  ? "bg-emerald-600/20 text-emerald-400"
                  : "bg-charcoal-700/40 text-charcoal-500"
              }`}
            >
              {row.slot.active ? "ACTIVE" : "OFF"}
            </span>
            <span className="rounded-full bg-charcoal-800/60 px-2 py-0.5 text-[10px] font-medium uppercase text-charcoal-400">
              {row.slot.mode}
            </span>
          </div>
          <p className="mt-1 text-xs text-charcoal-500">
            {row.slot.duration_min}분 ·{" "}
            {row.slot.price_cents === 0
              ? "Free"
              : `${(row.slot.price_cents / 100).toLocaleString("ko-KR")}원`}
            {" · "}
            {row.slot.slot_type}
            {row.slot.location_detail && ` · ${row.slot.location_detail}`}
          </p>
          {row.slot.description && (
            <p className="mt-2 text-sm text-charcoal-300">{row.slot.description}</p>
          )}
          <div className="mt-2 flex items-center gap-2">
            <Link
              href={`/${username}/s/${row.slot.slug}`}
              className="text-xs text-navy-400 hover:text-navy-300"
            >
              /{username}/s/{row.slot.slug} ↗
            </Link>
            <button
              type="button"
              onClick={copy}
              className="rounded-md border border-charcoal-700 px-2 py-0.5 text-[10px] text-charcoal-300 hover:border-charcoal-600"
            >
              {copied ? "Copied!" : "Copy share link"}
            </button>
          </div>
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={toggleActive}
            disabled={pending}
            className="rounded-md border border-charcoal-700 px-2.5 py-1 text-xs text-charcoal-300 hover:border-charcoal-600"
          >
            {row.slot.active ? "Pause" : "Activate"}
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="rounded-md border border-charcoal-700 px-2.5 py-1 text-xs text-charcoal-400 hover:border-red-500/60 hover:text-red-400"
          >
            Delete
          </button>
        </div>
      </div>

      {row.slot.mode === "manual" ? (
        <div className="mt-4 border-t border-charcoal-800/40 pt-4">
          <p className="mb-2 text-xs font-medium text-charcoal-400">
            예약 가능한 시간 ({row.availabilities.length})
          </p>
          <div className="flex gap-2">
            <input
              type="datetime-local"
              value={newWindow}
              onChange={(e) => setNewWindow(e.target.value)}
              className="flex-1 rounded-md border border-charcoal-800/40 bg-charcoal-900/60 px-3 py-1.5 text-sm text-charcoal-200"
            />
            <button
              type="button"
              onClick={addWindow}
              disabled={pending}
              className="rounded-md border border-charcoal-700 px-3 py-1.5 text-xs text-charcoal-200 hover:border-charcoal-600"
            >
              +
            </button>
          </div>
          {row.availabilities.length > 0 && (
            <ul className="mt-2 space-y-1">
              {row.availabilities.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between rounded-md bg-charcoal-800/30 px-3 py-1.5 text-xs"
                >
                  <span className="text-charcoal-300">
                    {new Date(a.start_at).toLocaleString("ko-KR")}
                    <span className="ml-2 text-charcoal-500">
                      {a.booked_count}/{a.capacity}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      startTransition(async () => {
                        await removeAvailability(a.id);
                        router.refresh();
                      })
                    }
                    className="text-charcoal-500 hover:text-red-400"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="mt-4 border-t border-charcoal-800/40 pt-4 text-xs text-charcoal-500">
          Auto 모드 — Google Calendar 빈 시간을 읽어와 예약 가능 시간이 자동으로
          만들어집니다. Working hours는 Settings → Calendar visibility에서 곧
          편집할 수 있도록 추가될 예정입니다. (지금은 슬롯을 새로 만들 때 설정)
        </div>
      )}
    </div>
  );
}
