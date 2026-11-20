"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/Toast";
import type { Todo } from "@/lib/todos";
import { editTodo, removeTodo, toggleTodo } from "@/lib/todos-actions";

function fmtDue(d: string | null) {
  if (!d) return null;
  const [, m, day] = d.split("-").map(Number);
  return `${m}월 ${day}일`;
}

export function TodoChecklist({ items }: { items: Todo[] }) {
  const toast = useToast();
  const router = useRouter();
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [busy, setBusy] = useState(false);

  const isDone = (t: Todo) => done[t.id] ?? t.done;

  const toggle = async (t: Todo) => {
    const next = !isDone(t);
    setDone((s) => ({ ...s, [t.id]: next }));
    const r = await toggleTodo(t.id, next);
    if ("error" in r) {
      setDone((s) => ({ ...s, [t.id]: !next }));
      toast.error(r.error);
    }
  };

  const startEdit = (t: Todo) => {
    setEditing(t.id);
    setTitle(t.title);
    setDue(t.dueDate ?? "");
  };

  const save = async (t: Todo) => {
    if (!title.trim() || busy) return;
    setBusy(true);
    const r = await editTodo(t.id, title, due || null);
    setBusy(false);
    if ("error" in r) {
      toast.error(r.error);
      return;
    }
    setEditing(null);
    router.refresh();
  };

  const remove = async (t: Todo) => {
    if (busy) return;
    setBusy(true);
    const r = await removeTodo(t.id);
    setBusy(false);
    if ("error" in r) {
      toast.error(r.error);
      return;
    }
    setEditing(null);
    toast.success("지웠어요.");
    router.refresh();
  };

  return (
    <ul className="divide-y divide-charcoal-800/40 overflow-hidden rounded-xl border border-charcoal-800/60 bg-[rgb(var(--bg-surface))]">
      {items.map((t) => {
        const checked = isDone(t);
        if (editing === t.id) {
          return (
            <li key={t.id} className="space-y-2 p-3" data-testid="todoEdit">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                aria-label="할 일 제목"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") save(t);
                  if (e.key === "Escape") setEditing(null);
                }}
                className="min-h-11 w-full rounded-lg border border-charcoal-800/60 bg-transparent px-2 text-base text-charcoal-100 focus:outline-none sm:text-sm"
              />
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  value={due}
                  onChange={(e) => setDue(e.target.value)}
                  aria-label="기한"
                  className="min-h-11 rounded-lg border border-charcoal-800/60 bg-transparent px-2 text-sm text-charcoal-300"
                />
                {due && (
                  <button type="button" onClick={() => setDue("")} className="min-h-11 px-2 text-xs text-charcoal-500 hover:text-charcoal-300">
                    기한 없음
                  </button>
                )}
                <div className="ml-auto flex gap-2">
                  <button type="button" onClick={() => remove(t)} disabled={busy} className="min-h-11 rounded-lg border border-red-500/40 px-3 text-sm text-red-400 disabled:opacity-40">
                    삭제
                  </button>
                  <button type="button" onClick={() => setEditing(null)} className="min-h-11 rounded-lg px-3 text-sm text-charcoal-400">
                    취소
                  </button>
                  <button type="button" onClick={() => save(t)} disabled={!title.trim() || busy} className="min-h-11 rounded-lg bg-navy-500 px-4 text-sm font-medium text-white disabled:opacity-40">
                    저장
                  </button>
                </div>
              </div>
            </li>
          );
        }
        return (
          <li key={t.id} className="flex items-start gap-3 p-3 hover:bg-charcoal-800/30">
            <input
              type="checkbox"
              checked={checked}
              onChange={() => toggle(t)}
              aria-label={`${t.title} 완료`}
              className="mt-0.5 h-5 w-5 shrink-0 accent-[rgb(var(--accent,99_102_241))]"
            />
            <button type="button" onClick={() => startEdit(t)} aria-label={`${t.title} 고치기`} className="min-w-0 flex-1 text-left">
              <p className={`text-sm ${checked ? "text-charcoal-500 line-through" : "text-charcoal-100"}`}>{t.title}</p>
              <p className="mt-0.5 flex flex-wrap gap-x-2 text-2xs text-charcoal-500">
                {fmtDue(t.dueDate) && <span>{fmtDue(t.dueDate)}</span>}
                {t.sourceTitle && <span>← {t.sourceTitle}</span>}
              </p>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
