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
import type { TimeSlot, Availability, SlotType } from "@/lib/slots";

type Row = { slot: TimeSlot; availabilities: Availability[] };

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
  const [windows, setWindows] = useState<string[]>([]);
  const [newWindow, setNewWindow] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return alert("제목을 입력하세요.");
    startTransition(async () => {
      const res = await createSlot({
        title: title.trim(),
        description: description.trim() || null,
        duration_min: duration,
        price_cents: Math.round(price) * 100,
        capacity,
        slot_type: slotType,
        location_detail: locationDetail.trim() || null,
        availability_starts: windows
          .filter(Boolean)
          .map((w) => new Date(w).toISOString()),
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
          <Link
            href={`/${username}/s/${row.slot.slug}`}
            className="mt-2 inline-block text-xs text-navy-400 hover:text-navy-300"
          >
            Public link → /{username}/s/{row.slot.slug}
          </Link>
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
    </div>
  );
}
