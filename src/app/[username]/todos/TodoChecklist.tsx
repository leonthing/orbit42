"use client";

import { useState } from "react";
import { useToast } from "@/components/Toast";
import type { Todo } from "@/lib/todos";
import { toggleTodo } from "@/lib/todos-actions";

function fmtDue(d: string | null) {
  if (!d) return null;
  const [, m, day] = d.split("-").map(Number);
  return `${m}월 ${day}일`;
}

export function TodoChecklist({ items }: { items: Todo[] }) {
  const toast = useToast();
  const [done, setDone] = useState<Record<string, boolean>>(() => Object.fromEntries(items.map((t) => [t.id, t.done])));

  const toggle = async (t: Todo) => {
    const next = !done[t.id];
    setDone((s) => ({ ...s, [t.id]: next }));
    const r = await toggleTodo(t.id, next);
    if ("error" in r) {
      setDone((s) => ({ ...s, [t.id]: !next }));
      toast.error(r.error);
    }
  };

  return (
    <ul className="divide-y divide-charcoal-800/40 overflow-hidden rounded-xl border border-charcoal-800/60 bg-[rgb(var(--bg-surface))]">
      {items.map((t) => {
        const checked = !!done[t.id];
        return (
          <li key={t.id}>
            <label className="flex cursor-pointer items-start gap-3 p-3 hover:bg-charcoal-800/30">
              <input type="checkbox" checked={checked} onChange={() => toggle(t)} className="mt-0.5 h-4 w-4 accent-[rgb(var(--accent,99_102_241))]" />
              <div className="min-w-0 flex-1">
                <p className={`text-sm ${checked ? "text-charcoal-500 line-through" : "text-charcoal-100"}`}>{t.title}</p>
                <p className="mt-0.5 flex flex-wrap gap-x-2 text-2xs text-charcoal-500">
                  {fmtDue(t.dueDate) && <span>{fmtDue(t.dueDate)}</span>}
                  {t.sourceTitle && <span>← {t.sourceTitle}</span>}
                </p>
              </div>
            </label>
          </li>
        );
      })}
    </ul>
  );
}
