"use client";

import { useState, useTransition } from "react";
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
        type="button"
        onClick={() => setPickerOpen((v) => !v)}
        className={`inline-flex items-center gap-1 rounded-full border border-dashed border-charcoal-800/60 ${
          sm ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"
        } text-charcoal-500 hover:border-charcoal-600 hover:text-charcoal-300`}
      >
        + 반응
      </button>

      {pickerOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setPickerOpen(false)}
          />
          <div className="absolute left-0 top-full z-50 mt-1 flex gap-1 rounded-xl border border-charcoal-800/60 bg-[rgb(var(--bg-surface))] p-1.5 shadow-2xl">
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
        </>
      )}
    </div>
  );
}
