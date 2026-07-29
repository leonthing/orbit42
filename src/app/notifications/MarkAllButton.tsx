"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { markAllNotificationsRead } from "@/lib/notifications";

export function MarkAllButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await markAllNotificationsRead();
          router.refresh();
        })
      }
      className="rounded-lg border border-charcoal-800/60 px-3 py-1.5 text-xs text-charcoal-300 hover:bg-charcoal-800/40"
    >
      {pending ? "처리 중…" : "모두 읽음"}
    </button>
  );
}
