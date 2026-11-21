"use client";

// 일정·할 일·만족도를 iOS 1.10.0 과 같은 흐름으로(웹 묶음 1b, 11/21).
// - 만족도 ♥1~5: 완료한 일정만, 같은 하트를 다시 누르면 지움(나만 봐요)
// - 후속: 원래 일정 · 후속 일정 · 묶인 할 일, [후속 일정][할 일]
// - 메모 '-' 줄 → '할 일로 바꾸기 (n)'
// - 완료 뒤 '후속으로 할 일이 있나요?' (이 기기에서 끄기 — iOS 도 기기 설정)
// - 하루 보기 맨 위 할 일 띠

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/Toast";
import type { FollowUps, Todo } from "@/lib/todos";
import { addEventTodos, addTodo, dayTodosFor, followUpsFor, toggleTodo } from "@/lib/todos-actions";
import { setMyRating } from "@/lib/annotation-actions";

export const ASK_FOLLOW_UP_KEY = "orbit42.askFollowUpAfterCompletion";

/** 메모에서 '-'·'•'·'*'·'·' 로 시작하는 줄 (lib/todos bulletLines 와 같은 규칙) */
export function memoBullets(text: string | null | undefined): string[] {
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => /^[-•*·]\s*\S/.test(l))
    .map((l) => l.replace(/^[-•*·]\s*/, "").trim())
    .filter(Boolean);
}

export function Hearts({
  value,
  onPick,
  size = "md",
  toggle = true,
}: {
  value: number | null;
  onPick: (v: number | null) => void;
  size?: "md" | "lg";
  /** 같은 하트를 다시 누르면 지우기(상세). 체크 직후 하트 줄은 iOS 처럼 늘 그 값으로(false) */
  toggle?: boolean;
}) {
  const box = size === "lg" ? "h-11 w-11 text-2xl" : "h-11 w-10 text-xl";
  return (
    <div className="flex items-center" role="radiogroup" aria-label="만족도">
      {[1, 2, 3, 4, 5].map((n) => {
        const on = value != null && n <= value;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`만족도 ${n}`}
            onClick={() => onPick(toggle && value === n ? null : n)}
            className={`inline-flex ${box} items-center justify-center transition-transform active:scale-90 ${on ? "text-pink-500" : "text-charcoal-600"}`}
          >
            {on ? "♥" : "♡"}
          </button>
        );
      })}
    </div>
  );
}

/** 일정 상세 안 '만족도' 줄 — 완료한 일정에서만 보인다 */
export function RatingRow({
  eventId,
  value,
  onChange,
}: {
  eventId: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  const toast = useToast();
  const pick = async (v: number | null) => {
    const before = value;
    onChange(v);
    const r = await setMyRating(eventId, v);
    if ("error" in r) {
      onChange(before);
      toast.error(r.error);
    }
  };
  return (
    <div className="mt-4 flex items-center justify-between rounded-xl border border-charcoal-800/60 bg-charcoal-900/40 px-3 py-1" data-testid="ratingRow">
      <div>
        <p className="text-sm font-medium text-charcoal-200">만족도</p>
        <p className="text-xs text-charcoal-500">나만 봐요</p>
      </div>
      <Hearts value={value} onPick={pick} />
    </div>
  );
}

function fmtDue(d: string | null) {
  if (!d) return null;
  const [, m, day] = d.split("-").map(Number);
  return `${m}월 ${day}일`;
}

function fmtStart(iso: string, allDay: boolean) {
  const d = new Date(iso);
  return d.toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
    weekday: "short",
    ...(allDay ? {} : { hour: "2-digit", minute: "2-digit", hour12: false }),
  });
}

/** 일정 상세 '후속' + 메모 → 할 일 */
export function FollowUpSection({
  eventId,
  description,
  onNewFollowUpEvent,
  refreshKey = 0,
}: {
  eventId: string;
  description: string | null;
  /** [후속 일정] — 새 일정 폼을 열고 저장하면 이 일정의 후속으로 잇는다 */
  onNewFollowUpEvent?: () => void;
  refreshKey?: number;
}) {
  const toast = useToast();
  const [data, setData] = useState<FollowUps | null>(null);
  const [closed, setClosed] = useState(false);
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    const r = await followUpsFor(eventId);
    if ("error" in r) {
      // 1.9.0 시행 전·미리보기 밖 계정은 닫혀 있다 — 섹션째 숨긴다
      setClosed(true);
      return;
    }
    setData(r);
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  if (closed) return null;
  const bullets = memoBullets(description);
  const existingTodoTitles = new Set((data?.followUps ?? []).filter((f) => f.kind === "todo").map((f) => f.title));
  const newBullets = bullets.filter((b) => !existingTodoTitles.has(b));

  const add = async () => {
    const titles = text.split(/\r?\n/).map((t) => t.trim()).filter(Boolean);
    if (titles.length === 0 || busy) return;
    setBusy(true);
    const r = await addEventTodos(eventId, titles);
    setBusy(false);
    if ("error" in r) {
      toast.error(r.error);
      return;
    }
    setText("");
    setAdding(false);
    load();
  };

  const fromMemo = async () => {
    if (newBullets.length === 0 || busy) return;
    setBusy(true);
    const r = await addEventTodos(eventId, newBullets);
    setBusy(false);
    if ("error" in r) {
      toast.error(r.error);
      return;
    }
    toast.success(`할 일 ${r.todos.length}개를 만들었어요.`);
    load();
  };

  const toggle = async (id: string, cur: boolean) => {
    setDone((s) => ({ ...s, [id]: !cur }));
    const r = await toggleTodo(id, !cur);
    if ("error" in r) {
      setDone((s) => ({ ...s, [id]: cur }));
      toast.error(r.error);
    }
  };

  return (
    <div className="mt-4 space-y-3" data-testid="followUps">
      {newBullets.length > 0 && (
        <button
          type="button"
          onClick={fromMemo}
          disabled={busy}
          className="min-h-11 w-full rounded-xl border border-navy-500/40 px-3 text-sm font-medium text-navy-500 hover:bg-navy-500/5 disabled:opacity-40"
        >
          메모를 할 일로 바꾸기 ({newBullets.length})
        </button>
      )}
      <div className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/40 p-3">
        <p className="mb-2 text-sm font-medium text-charcoal-200">후속</p>
        {data?.source && (
          <p className="mb-2 text-xs text-charcoal-500">
            원래 일정 · {"missing" in data.source && data.source.missing ? "지워진 일정" : `${(data.source as { title: string }).title} · ${fmtStart((data.source as { start: string }).start, (data.source as { allDay: boolean }).allDay)}`}
          </p>
        )}
        {(data?.followUps ?? []).length > 0 && (
          <ul className="mb-2 divide-y divide-charcoal-800/40">
            {data!.followUps.map((f) =>
              f.kind === "todo" ? (
                <li key={f.id} className="flex items-center gap-2 py-1.5">
                  <input
                    type="checkbox"
                    checked={done[f.id] ?? f.done}
                    onChange={() => toggle(f.id, done[f.id] ?? f.done)}
                    aria-label={`${f.title} 완료`}
                    className="h-5 w-5 shrink-0 accent-[rgb(var(--accent,99_102_241))]"
                  />
                  <span className={`min-w-0 flex-1 truncate text-sm ${(done[f.id] ?? f.done) ? "text-charcoal-500 line-through" : "text-charcoal-200"}`}>{f.title}</span>
                  {fmtDue(f.dueDate) && <span className="shrink-0 text-xs text-charcoal-500">{fmtDue(f.dueDate)}</span>}
                </li>
              ) : (
                <li key={f.key} className="flex items-center gap-2 py-1.5">
                  <span aria-hidden className="text-charcoal-500">↳</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-charcoal-200">{f.title}</span>
                  <span className="shrink-0 text-xs text-charcoal-500">{fmtStart(f.start, f.allDay)}</span>
                </li>
              ),
            )}
          </ul>
        )}
        {adding ? (
          <div className="space-y-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={2}
              autoFocus
              placeholder="할 일 — 한 줄에 하나"
              aria-label="후속 할 일"
              className="w-full rounded-lg border border-charcoal-800/60 bg-transparent p-2 text-base text-charcoal-100 sm:text-sm"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setAdding(false)} className="min-h-11 px-3 text-sm text-charcoal-400">
                취소
              </button>
              <button type="button" onClick={add} disabled={busy || !text.trim()} className="min-h-11 rounded-lg bg-navy-500 px-4 text-sm font-medium text-white disabled:opacity-40">
                추가
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            {onNewFollowUpEvent && (
              <button type="button" onClick={onNewFollowUpEvent} className="min-h-11 flex-1 rounded-lg border border-charcoal-700 text-sm text-charcoal-200">
                + 후속 일정
              </button>
            )}
            <button type="button" onClick={() => setAdding(true)} className="min-h-11 flex-1 rounded-lg border border-charcoal-700 text-sm text-charcoal-200">
              + 할 일
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** 일정을 완료로 표시한 뒤 — '후속으로 할 일이 있나요?' */
export function AfterCompletionSheet({
  eventId,
  title,
  onClose,
  onNewFollowUpEvent,
}: {
  eventId: string;
  title: string;
  onClose: (created: number) => void;
  onNewFollowUpEvent?: () => void;
}) {
  const toast = useToast();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const titles = text.split(/\r?\n/).map((t) => t.trim()).filter(Boolean);
    if (titles.length === 0) return onClose(0);
    setBusy(true);
    const r = await addEventTodos(eventId, titles);
    setBusy(false);
    if ("error" in r) {
      toast.error(r.error);
      return;
    }
    toast.success(`할 일 ${r.todos.length}개를 만들었어요.`);
    onClose(r.todos.length);
  };
  const never = () => {
    try {
      localStorage.setItem(ASK_FOLLOW_UP_KEY, "0");
    } catch {}
    onClose(0);
  };
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 md:items-center md:p-4" onClick={() => onClose(0)}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="후속으로 할 일이 있나요?"
        data-testid="afterCompletion"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-2xl bg-[rgb(var(--bg-surface))] p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl md:rounded-2xl"
      >
        <p className="text-base font-semibold text-charcoal-100">후속으로 할 일이 있나요?</p>
        <p className="mt-1 truncate text-sm text-charcoal-500">{title}</p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          autoFocus
          placeholder="한 줄에 하나씩"
          aria-label="후속 할 일"
          className="mt-3 w-full rounded-lg border border-charcoal-800/60 bg-transparent p-2 text-base text-charcoal-100 sm:text-sm"
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {onNewFollowUpEvent && (
            <button type="button" onClick={onNewFollowUpEvent} className="min-h-11 rounded-lg border border-charcoal-700 px-3 text-sm text-charcoal-200">
              후속 일정 만들기
            </button>
          )}
          <button type="button" onClick={never} className="min-h-11 px-2 text-xs text-charcoal-500">
            다시 묻지 않기
          </button>
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={() => onClose(0)} className="min-h-11 px-3 text-sm text-charcoal-400">
              건너뛰기
            </button>
            <button type="button" onClick={save} disabled={busy} className="min-h-11 rounded-lg bg-navy-500 px-4 text-sm font-medium text-white disabled:opacity-40">
              저장
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** 하루 보기 맨 위 할 일 띠 — 접으면 '할 일 N · 지남 M' */
export function DayTodoStrip({ date }: { date: string }) {
  const toast = useToast();
  const [todos, setTodos] = useState<Todo[] | null>(null);
  const [overdue, setOverdue] = useState(0);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  const load = useCallback(async () => {
    const r = await dayTodosFor(date);
    if ("error" in r) {
      setTodos(null);
      return;
    }
    setTodos(r.todos);
    setOverdue(r.overdue);
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  if (todos === null) return null;
  const left = todos.filter((t) => !t.done).length;

  const toggle = async (t: Todo) => {
    setTodos((s) => (s ?? []).map((x) => (x.id === t.id ? { ...x, done: !t.done } : x)));
    const r = await toggleTodo(t.id, !t.done);
    if ("error" in r) {
      toast.error(r.error);
      load();
    }
  };
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    const r = await addTodo(text, date);
    if ("error" in r) {
      toast.error(r.error);
      return;
    }
    setText("");
    load();
  };

  return (
    <div className="rounded-xl border border-charcoal-800/60 bg-[rgb(var(--bg-surface))]" data-testid="dayTodoStrip">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex min-h-11 w-full items-center gap-2 px-3 text-left text-sm">
        <span className="font-medium text-charcoal-200">할 일 {left}</span>
        {overdue > 0 && <span className="text-red-500">· 지남 {overdue}</span>}
        <span className="ml-auto text-charcoal-500" aria-hidden>
          {open ? "▴" : "▾"}
        </span>
      </button>
      {open && (
        <div className="border-t border-charcoal-800/40 px-3 pb-2">
          <ul>
            {todos.map((t) => (
              <li key={t.id} className="flex items-center gap-2 py-1.5">
                <input type="checkbox" checked={t.done} onChange={() => toggle(t)} aria-label={`${t.title} 완료`} className="h-5 w-5 shrink-0 accent-[rgb(var(--accent,99_102_241))]" />
                <span className={`min-w-0 flex-1 truncate text-sm ${t.done ? "text-charcoal-500 line-through" : "text-charcoal-200"}`}>{t.title}</span>
                {t.dueDate && t.dueDate < date && <span className="shrink-0 text-xs text-red-500">{fmtDue(t.dueDate)}</span>}
              </li>
            ))}
          </ul>
          <form onSubmit={add} className="mt-1 flex gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="이날 할 일 추가"
              aria-label="이날 할 일 추가"
              maxLength={200}
              className="min-h-11 min-w-0 flex-1 rounded-lg border border-charcoal-800/60 bg-transparent px-2 text-base text-charcoal-100 sm:text-sm"
            />
            <button type="submit" disabled={!text.trim()} className="min-h-11 rounded-lg bg-navy-500 px-3 text-sm font-medium text-white disabled:opacity-40">
              추가
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
