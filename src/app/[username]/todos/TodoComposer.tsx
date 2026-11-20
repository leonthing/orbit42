"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/Toast";
import { addTodo } from "@/lib/todos-actions";

/** 할 일 만들기(웹, 묶음 B) — 제목 + 기한(선택). 만든 뒤 서버 목록을 다시 받아 묶음에 맞게 놓는다. */
export function TodoComposer() {
  const router = useRouter();
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || busy) return;
    setBusy(true);
    const r = await addTodo(title, due || null);
    setBusy(false);
    if ("error" in r) {
      toast.error(r.error);
      return;
    }
    setTitle("");
    setDue("");
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="mb-6 flex flex-wrap items-center gap-2 rounded-xl border border-charcoal-800/60 bg-[rgb(var(--bg-surface))] p-2" data-testid="todoComposer">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="할 일 추가"
        maxLength={200}
        aria-label="새 할 일"
        className="min-h-11 min-w-0 flex-1 basis-48 rounded-lg bg-transparent px-2 text-base text-charcoal-100 placeholder:text-charcoal-500 focus:outline-none sm:text-sm"
      />
      <input
        type="date"
        value={due}
        onChange={(e) => setDue(e.target.value)}
        aria-label="기한(선택)"
        className="min-h-11 rounded-lg border border-charcoal-800/60 bg-transparent px-2 text-sm text-charcoal-300"
      />
      <button
        type="submit"
        disabled={!title.trim() || busy}
        className="min-h-11 rounded-lg bg-navy-500 px-4 text-sm font-medium text-white hover:bg-navy-400 disabled:opacity-40"
      >
        추가
      </button>
    </form>
  );
}
