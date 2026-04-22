"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { blockUser, unblockUser } from "@/lib/blocks";
import { useConfirm } from "@/components/ConfirmDialog";

export function BlockMenu({
  targetUsername,
  initiallyBlocked,
}: {
  targetUsername: string;
  initiallyBlocked: boolean;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [blocked, setBlocked] = useState(initiallyBlocked);
  const [pending, start] = useTransition();

  const toggle = async () => {
    if (blocked) {
      start(async () => {
        await unblockUser(targetUsername);
        setBlocked(false);
        setOpen(false);
        router.refresh();
      });
    } else {
      const ok = await confirm({
        title: `@${targetUsername}을(를) 차단할까요?`,
        body: "서로 팔로우가 해제되고 메시지도 더 이상 주고받을 수 없어요.",
        confirmLabel: "차단",
        danger: true,
      });
      if (!ok) return;
      start(async () => {
        await blockUser(targetUsername);
        setBlocked(true);
        setOpen(false);
        router.refresh();
      });
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="더보기"
        className="flex h-8 w-8 items-center justify-center rounded-full border border-charcoal-700/60 bg-charcoal-800/40 text-charcoal-400 hover:border-charcoal-600 hover:text-charcoal-100"
      >
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
          <circle cx="5" cy="12" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="19" cy="12" r="1.5" />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-1 w-40 rounded-xl border border-charcoal-800/60 bg-[rgb(var(--bg-surface))] p-1 shadow-2xl">
            <button
              type="button"
              onClick={toggle}
              disabled={pending}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-charcoal-300 hover:bg-charcoal-800/50 hover:text-red-400 disabled:opacity-50"
            >
              {blocked ? "차단 해제" : "차단하기"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
