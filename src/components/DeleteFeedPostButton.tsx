"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteFeedPost } from "@/lib/feed-posts";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmDialog";

export function DeleteFeedPostButton({ id }: { id: string }) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [pending, startTransition] = useTransition();

  const onClick = async () => {
    const ok = await confirm({
      title: "이 글을 삭제할까요?",
      confirmLabel: "삭제",
      danger: true,
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await deleteFeedPost(id);
      if (res.error) return toast.error(res.error);
      router.refresh();
    });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      title="삭제"
      className="rounded-lg px-2 py-1 text-xs text-charcoal-500 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
    >
      {pending ? "…" : "삭제"}
    </button>
  );
}
