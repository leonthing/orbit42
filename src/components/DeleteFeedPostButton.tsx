"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteFeedPost } from "@/lib/feed-posts";

export function DeleteFeedPostButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const onClick = () => {
    if (!confirm("이 글을 삭제할까요?")) return;
    startTransition(async () => {
      const res = await deleteFeedPost(id);
      if (res.error) return alert(res.error);
      router.refresh();
    });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      title="삭제"
      className="rounded-md px-2 py-1 text-xs text-charcoal-500 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
    >
      {pending ? "…" : "삭제"}
    </button>
  );
}
