"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { toggleReaction } from "@/lib/reactions";
import {
  REACTION_EMOJIS,
  type ReactionTarget,
  type ReactionSummary,
} from "@/lib/reactions-types";

export function ReactionStrip({
  target_type,
  target_id,
  initial,
  loggedIn,
  size = "md",
}: {
  target_type: ReactionTarget;
  target_id: string;
  initial: ReactionSummary[];
  loggedIn: boolean;
  size?: "sm" | "md";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [optimistic, setOptimistic] = useState<ReactionSummary[]>(initial);
  const addBtnRef = useRef<HTMLButtonElement>(null);
  const [pickerPos, setPickerPos] = useState<{ left: number; top: number } | null>(null);

  // Position the portalled picker below the "+" button, clamped to viewport.
  useEffect(() => {
    if (!pickerOpen) {
      setPickerPos(null);
      return;
    }
    const update = () => {
      const el = addBtnRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const pickerWidth = 8 * 36 + 12; // rough: 6-8 emojis * 36px + padding
      const pad = 8;
      let left = rect.left;
      if (left + pickerWidth + pad > window.innerWidth) {
        left = Math.max(pad, window.innerWidth - pickerWidth - pad);
      }
      const top = rect.bottom + 4;
      setPickerPos({ left, top });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [pickerOpen]);

  const tap = (emoji: string) => {
    if (!loggedIn) {
      window.location.href = "/login";
      return;
    }
    // Optimistic update
    setOptimistic((prev) => {
      const next = [...prev];
      const idx = next.findIndex((r) => r.emoji === emoji);
      if (idx >= 0) {
        const r = next[idx];
        const newCount = r.by_me ? r.count - 1 : r.count + 1;
        if (newCount <= 0) next.splice(idx, 1);
        else next[idx] = { ...r, count: newCount, by_me: !r.by_me };
      } else {
        next.push({ emoji, count: 1, by_me: true });
      }
      return next;
    });
    setPickerOpen(false);
    startTransition(async () => {
      await toggleReaction(target_type, target_id, emoji);
      router.refresh();
    });
  };

  const sm = size === "sm";

  return (
    <div className="relative inline-flex flex-wrap items-center gap-1.5">
      {optimistic.map((r) => (
        <button
          key={r.emoji}
          type="button"
          onClick={() => tap(r.emoji)}
          disabled={pending}
          className={`inline-flex items-center gap-1 rounded-full border ${
            sm ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"
          } transition-colors ${
            r.by_me
              ? "border-red-500/60 bg-red-600/20 text-red-200"
              : "border-charcoal-800/60 bg-charcoal-800/40 text-charcoal-300 hover:border-charcoal-700"
          }`}
        >
          <span>{r.emoji}</span>
          <span className="font-medium">{r.count}</span>
        </button>
      ))}
      <button
        ref={addBtnRef}
        type="button"
        onClick={() => setPickerOpen((v) => !v)}
        className={`inline-flex items-center gap-1 rounded-full border border-dashed border-charcoal-800/60 ${
          sm ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"
        } text-charcoal-500 hover:border-charcoal-600 hover:text-charcoal-300`}
      >
        + 반응
      </button>

      {pickerOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setPickerOpen(false)}
            />
            <div
              className="fixed z-50 flex gap-1 rounded-xl border border-charcoal-800/60 bg-[rgb(var(--bg-surface))] p-1.5 shadow-2xl"
              style={{
                left: pickerPos?.left ?? 0,
                top: pickerPos?.top ?? 0,
                visibility: pickerPos ? "visible" : "hidden",
              }}
            >
              {REACTION_EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => tap(e)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-base hover:bg-charcoal-800/60"
                >
                  {e}
                </button>
              ))}
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}
