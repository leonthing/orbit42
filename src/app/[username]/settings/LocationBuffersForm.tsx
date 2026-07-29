"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createLocationBuffer,
  updateLocationBuffer,
  deleteLocationBuffer,
} from "@/lib/location-buffers";
import type { LocationBuffer } from "@/lib/location-buffers-types";
import { useConfirm } from "@/components/ConfirmDialog";

type Props = { initial: LocationBuffer[] };

export function LocationBuffersForm({ initial }: Props) {
  const [items, setItems] = useState(initial);
  const [showNew, setShowNew] = useState(initial.length === 0);
  const router = useRouter();

  const afterMutation = (next?: LocationBuffer[]) => {
    if (next) setItems(next);
    router.refresh();
  };

  return (
    <section className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/30">
      <div className="flex items-center justify-between border-b border-charcoal-800/40 px-5 py-3">
        <div>
          <h2 className="text-sm font-semibold text-charcoal-200">
            장소별 이동시간
          </h2>
          <p className="mt-1 text-xs text-charcoal-500">
            캘린더 일정의 <b>장소</b> 또는 <b>제목</b>에 아래 키워드가
            포함되면, 그 일정 앞뒤로 해당 버퍼를 자동 적용해요.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowNew((v) => !v)}
          className="shrink-0 whitespace-nowrap rounded-lg bg-navy-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-400"
        >
          {showNew ? "닫기" : "+ 추가"}
        </button>
      </div>

      {showNew && (
        <div className="border-b border-charcoal-800/40 px-5 py-4">
          <NewRow
            onDone={() => {
              setShowNew(false);
              afterMutation();
            }}
          />
        </div>
      )}

      <ul className="divide-y divide-charcoal-800/40">
        {items.map((item) => (
          <Row
            key={item.id}
            item={item}
            onChange={(next) =>
              afterMutation(items.map((x) => (x.id === item.id ? next : x)))
            }
            onDelete={() =>
              afterMutation(items.filter((x) => x.id !== item.id))
            }
          />
        ))}
        {items.length === 0 && !showNew && (
          <li className="px-5 py-6 text-center text-sm text-charcoal-500">
            아직 등록된 장소가 없어요. 자주 가는 지역부터 추가해보세요.
          </li>
        )}
      </ul>

      <div className="border-t border-charcoal-800/40 px-5 py-3 text-2xs text-charcoal-600">
        예) 이름{" "}
        <span className="font-mono text-charcoal-400">여의도</span>, 버퍼{" "}
        <span className="font-mono text-charcoal-400">60</span>, 별칭{" "}
        <span className="font-mono text-charcoal-400">여의도역, IFC</span>
      </div>
    </section>
  );
}

function Row({
  item,
  onChange,
  onDelete,
}: {
  item: LocationBuffer;
  onChange: (next: LocationBuffer) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(item.name);
  const [buffer, setBuffer] = useState(String(item.buffer_min));
  const [aliases, setAliases] = useState(item.aliases.join(", "));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const confirm = useConfirm();

  const save = () => {
    setError(null);
    const bufNum = Number(buffer);
    if (!Number.isFinite(bufNum) || bufNum < 0 || bufNum > 720) {
      setError("버퍼는 0~720 사이 숫자여야 해요.");
      return;
    }
    startTransition(async () => {
      const res = await updateLocationBuffer(item.id, {
        name: name.trim(),
        buffer_min: bufNum,
        aliases: aliases
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      onChange({
        ...item,
        name: name.trim(),
        buffer_min: bufNum,
        aliases: aliases.split(",").map((s) => s.trim()).filter(Boolean),
      });
    });
  };

  const remove = async () => {
    const ok = await confirm({
      title: `"${item.name}" 을(를) 삭제할까요?`,
      confirmLabel: "삭제",
      danger: true,
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await deleteLocationBuffer(item.id);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      onDelete();
    });
  };

  return (
    <li className="space-y-2 px-5 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="강남"
          className="min-w-0 flex-[2] rounded-lg border border-charcoal-800/60 bg-charcoal-900/60 px-2.5 py-1.5 text-sm text-charcoal-100"
        />
        <div className="flex flex-1 items-center gap-1">
          <input
            type="number"
            inputMode="numeric"
            value={buffer}
            onChange={(e) => setBuffer(e.target.value.replace(/[^0-9]/g, ""))}
            className="w-full rounded-lg border border-charcoal-800/60 bg-charcoal-900/60 px-2.5 py-1.5 text-right text-sm text-charcoal-100"
          />
          <span className="shrink-0 text-xs text-charcoal-500">분</span>
        </div>
      </div>
      <input
        type="text"
        value={aliases}
        onChange={(e) => setAliases(e.target.value)}
        placeholder="별칭 (쉼표로 구분, 선택)"
        className="w-full rounded-lg border border-charcoal-800/60 bg-charcoal-900/60 px-2.5 py-1.5 text-xs text-charcoal-200 placeholder:text-charcoal-600"
      />
      {error && <p className="text-2xs text-red-400">{error}</p>}
      <div className="flex items-center justify-end gap-1.5">
        <button
          type="button"
          onClick={remove}
          className="rounded-lg border border-charcoal-800/60 px-2.5 py-1 text-2xs text-charcoal-500 hover:border-red-500/50 hover:text-red-400"
          disabled={pending}
        >
          삭제
        </button>
        <button
          type="button"
          onClick={save}
          className="rounded-lg bg-navy-500 px-2.5 py-1 text-2xs font-semibold text-white hover:bg-navy-400 disabled:opacity-50"
          disabled={pending}
        >
          {pending ? "저장 중…" : "저장"}
        </button>
      </div>
    </li>
  );
}

function NewRow({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [buffer, setBuffer] = useState("30");
  const [aliases, setAliases] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const bufNum = Number(buffer);
    if (!name.trim()) {
      setError("이름을 입력해주세요.");
      return;
    }
    if (!Number.isFinite(bufNum) || bufNum < 0 || bufNum > 720) {
      setError("버퍼는 0~720 사이 숫자여야 해요.");
      return;
    }
    startTransition(async () => {
      const res = await createLocationBuffer({
        name: name.trim(),
        buffer_min: bufNum,
        aliases: aliases
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      onDone();
    });
  };

  return (
    <form onSubmit={submit} className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="장소 이름 (예: 강남)"
          required
          className="min-w-0 flex-[2] rounded-lg border border-charcoal-800/60 bg-charcoal-900/60 px-2.5 py-1.5 text-sm text-charcoal-100"
        />
        <div className="flex flex-1 items-center gap-1">
          <input
            type="number"
            inputMode="numeric"
            value={buffer}
            onChange={(e) => setBuffer(e.target.value.replace(/[^0-9]/g, ""))}
            required
            className="w-full rounded-lg border border-charcoal-800/60 bg-charcoal-900/60 px-2.5 py-1.5 text-right text-sm text-charcoal-100"
          />
          <span className="shrink-0 text-xs text-charcoal-500">분</span>
        </div>
      </div>
      <input
        type="text"
        value={aliases}
        onChange={(e) => setAliases(e.target.value)}
        placeholder="별칭 (쉼표로 구분, 선택) — 예: 강남구, gangnam"
        className="w-full rounded-lg border border-charcoal-800/60 bg-charcoal-900/60 px-2.5 py-1.5 text-xs text-charcoal-200 placeholder:text-charcoal-600"
      />
      {error && <p className="text-2xs text-red-400">{error}</p>}
      <div className="flex justify-end gap-1.5">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-navy-500 px-3 py-1 text-xs font-semibold text-white hover:bg-navy-400 disabled:opacity-50"
        >
          {pending ? "추가 중…" : "추가"}
        </button>
      </div>
    </form>
  );
}
