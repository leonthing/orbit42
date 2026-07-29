"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleFeedbackResolved } from "@/lib/feedback";

export function ResolveButton({
  id,
  resolved,
}: {
  id: string;
  resolved: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await toggleFeedbackResolved(id, !resolved);
          router.refresh();
        })
      }
      className={`rounded-lg px-2 py-1 text-2xs font-medium ${
        resolved
          ? "border border-charcoal-800/60 text-charcoal-500 hover:text-charcoal-200"
          : "bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
      }`}
    >
      {resolved ? "되돌리기" : "해결"}
    </button>
  );
}
