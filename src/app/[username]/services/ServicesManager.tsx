"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Menu } from "@/lib/menus";
import { createMenu, updateMenu, deleteMenu } from "@/lib/menus";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmDialog";

const INPUT =
  "w-full rounded-lg border border-charcoal-800/60 bg-charcoal-900/40 px-3 py-2 text-sm text-charcoal-100 placeholder:text-charcoal-600 focus:border-red-500/60 focus:outline-none focus:ring-1 focus:ring-red-500/40";

export default function ServicesManager({ initial }: { initial: Menu[] }) {
  const router = useRouter();
  const [showNew, setShowNew] = useState(initial.length === 0);

  const grouped = useMemo(() => {
    const by = new Map<string, Menu[]>();
    for (const m of initial) {
      const key = m.category?.trim() || "기타";
      const list = by.get(key) ?? [];
      list.push(m);
      by.set(key, list);
    }
    return Array.from(by.entries());
  }, [initial]);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-charcoal-100">서비스</h1>
          <p className="mt-1 text-sm text-charcoal-500">
            슬롯에 연결할 수 있는 항목을 관리하세요. 예약할 때 게스트가 선택해요.
          </p>
          <p className="mt-1 text-xs text-charcoal-600">
            팁: 서비스를 만든 뒤에는 <b>Timeslots</b>에서 각 슬롯의{" "}
            <b>수정</b>을 눌러 연결해야 게스트에게 노출돼요.
          </p>
        </div>
        {!showNew && (
          <button
            type="button"
            onClick={() => setShowNew(true)}
            className="shrink-0 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500"
          >
            새 서비스 추가
          </button>
        )}
      </header>

      {showNew && (
        <NewMenuForm
          onCancel={() => setShowNew(false)}
          onSaved={() => {
            setShowNew(false);
            router.refresh();
          }}
        />
      )}

      {initial.length === 0 && !showNew ? (
        <div className="rounded-2xl border border-dashed border-charcoal-800/60 bg-charcoal-900/20 p-12 text-center">
          <p className="text-base font-semibold text-charcoal-200">
            아직 등록된 항목이 없어요
          </p>
          <p className="mt-2 text-sm text-charcoal-500">
            첫 항목을 추가해보세요.
          </p>
          <button
            type="button"
            onClick={() => setShowNew(true)}
            className="mt-5 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500"
          >
            첫 서비스 추가하기
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([cat, items]) => (
            <section key={cat} className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-charcoal-500">
                {cat}
              </h2>
              <ul className="space-y-2">
                {items.map((m) => (
                  <MenuRow
                    key={m.id}
                    menu={m}
                    onChanged={() => router.refresh()}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function NewMenuForm({
  onSaved,
  onCancel,
}: {
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState(0);
  const toast = useToast();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("이름을 입력해주세요.");
    startTransition(async () => {
      const res = await createMenu({
        name,
        category: category || null,
        description: description || null,
        price_cents: Math.round(price) * 100,
      });
      if (res.error) return toast.error(res.error);
      onSaved();
    });
  };

  return (
    <form
      onSubmit={submit}
      className="space-y-4 rounded-2xl border border-charcoal-800/60 bg-charcoal-900/30 p-6"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-charcoal-100">새 메뉴</h3>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Close"
          className="flex h-7 w-7 items-center justify-center rounded-md text-charcoal-500 hover:bg-charcoal-800/40 hover:text-charcoal-100"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 6l12 12M6 18L18 6" />
          </svg>
        </button>
      </div>
      <Field label="이름">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={INPUT}
          required
        />
      </Field>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="카테고리 (선택)">
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={INPUT}
          />
        </Field>
        <Field label="가격 (KRW)">
          <input
            type="number"
            min={0}
            step={1000}
            value={price}
            onChange={(e) => setPrice(Number(e.target.value))}
            className={INPUT}
          />
        </Field>
      </div>
      {price > 0 && <PaymentNote />}
      <Field label="설명 (선택)">
        <textarea
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={INPUT}
        />
      </Field>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-charcoal-700 px-4 py-2 text-sm text-charcoal-300 hover:border-charcoal-600 hover:text-charcoal-100"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
        >
          {pending ? "저장 중…" : "추가"}
        </button>
      </div>
    </form>
  );
}

function MenuRow({ menu, onChanged }: { menu: Menu; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();

  const toggleActive = () =>
    startTransition(async () => {
      await updateMenu(menu.id, { active: !menu.active });
      onChanged();
    });

  const remove = async () => {
    const ok = await confirm({
      title: `"${menu.name}" 서비스를 삭제할까요?`,
      confirmLabel: "삭제",
      danger: true,
    });
    if (!ok) return;
    startTransition(async () => {
      await deleteMenu(menu.id);
      onChanged();
    });
  };

  if (editing) {
    return (
      <li className="rounded-xl border border-charcoal-800/60 bg-charcoal-950/40 p-4">
        <EditMenuForm
          menu={menu}
          onCancel={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            onChanged();
          }}
        />
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-charcoal-800/60 bg-charcoal-900/30 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold text-charcoal-100">
            {menu.name}
          </p>
          {!menu.active && (
            <span className="rounded-full bg-charcoal-700/40 px-2 py-0.5 text-[10px] font-semibold text-charcoal-500">
              OFF
            </span>
          )}
          <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-bold text-red-800 ring-1 ring-red-500/30 dark:text-red-200 dark:ring-0">
            {menu.price_cents === 0
              ? "Free"
              : `₩${(menu.price_cents / 100).toLocaleString("ko-KR")}`}
          </span>
        </div>
        {menu.description && (
          <p className="mt-1 line-clamp-2 text-xs text-charcoal-400">
            {menu.description}
          </p>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap gap-1">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded-md border border-charcoal-800 px-2.5 py-1.5 text-xs text-charcoal-400 hover:border-charcoal-700 hover:text-charcoal-100"
        >
          수정
        </button>
        <button
          type="button"
          onClick={toggleActive}
          disabled={pending}
          className="rounded-md border border-charcoal-800 px-2.5 py-1.5 text-xs text-charcoal-400 hover:border-charcoal-700 hover:text-charcoal-100"
        >
          {menu.active ? "Pause" : "활성화"}
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          className="rounded-md border border-charcoal-800 px-2.5 py-1.5 text-xs text-charcoal-500 hover:border-red-500/60 hover:text-red-400"
        >
          삭제
        </button>
      </div>
    </li>
  );
}

function EditMenuForm({
  menu,
  onSaved,
  onCancel,
}: {
  menu: Menu;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(menu.name);
  const [category, setCategory] = useState(menu.category ?? "");
  const [description, setDescription] = useState(menu.description ?? "");
  const [price, setPrice] = useState(menu.price_cents / 100);
  const toast = useToast();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("이름을 입력해주세요.");
    startTransition(async () => {
      const res = await updateMenu(menu.id, {
        name: name.trim(),
        category: category.trim() || null,
        description: description.trim() || null,
        price_cents: Math.round(price) * 100,
      });
      if (res.error) return toast.error(res.error);
      onSaved();
    });
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <Field label="이름">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={INPUT}
          required
        />
      </Field>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="카테고리 (선택)">
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={INPUT}
          />
        </Field>
        <Field label="가격 (KRW)">
          <input
            type="number"
            min={0}
            step={1000}
            value={price}
            onChange={(e) => setPrice(Number(e.target.value))}
            className={INPUT}
          />
        </Field>
      </div>
      {price > 0 && <PaymentNote />}
      <Field label="설명 (선택)">
        <textarea
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={INPUT}
        />
      </Field>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-charcoal-700 px-4 py-2 text-sm text-charcoal-300 hover:border-charcoal-600 hover:text-charcoal-100"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
        >
          {pending ? "저장 중…" : "저장"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-charcoal-400">
        {label}
      </span>
      {children}
    </label>
  );
}

function PaymentNote() {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-charcoal-800/60 bg-charcoal-800/30 px-3 py-2.5 text-xs leading-relaxed text-charcoal-400">
      <svg className="mt-0.5 h-4 w-4 shrink-0 text-charcoal-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path d="M2 10h20" />
      </svg>
      <span>
        유료 서비스는 예약 시 <b className="text-charcoal-200">호스트에게 직접 결제</b>로
        진행돼요. 예약을 먼저 확정하고 만난 자리에서 결제받으시면 됩니다.
        <span className="text-charcoal-600"> (온라인 결제는 준비 중)</span>
      </span>
    </div>
  );
}
