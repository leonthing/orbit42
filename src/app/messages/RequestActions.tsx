"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/Toast";
import { buttonClasses } from "@/components/PendingButton";
import { dmAction } from "./dm-client";

/** 받은 대화 요청: 수락 · 거절 · 신고 · 차단 (모르는 사람의 첫 글이라 신고·차단도 바로 옆에) */
export function RequestActions({ conversationId, firstMessageId }: { conversationId: string; firstMessageId?: string }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const run = async (action: string, confirmText?: string, done?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    let extra: Record<string, unknown> = {};
    if (action === "report") {
      let mid = firstMessageId;
      if (!mid) {
        const r = await fetch(`/api/v1/dm/${conversationId}`, { cache: "no-store" }).then((x) => x.json()).catch(() => null);
        mid = r?.messages?.find((m: { mine: boolean }) => !m.mine)?.id;
      }
      if (!mid) {
        setBusy(false);
        toast.error("신고할 메시지를 찾지 못했어요.");
        return;
      }
      extra = { messageId: mid };
    }
    const r = await dmAction(conversationId, action, extra);
    setBusy(false);
    if (r.error) {
      toast.error(r.error);
      return;
    }
    if (done) toast.success(done);
    if (action === "accept") router.push(`/messages/${conversationId}`);
    router.refresh();
  };

  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={busy} onClick={() => run("accept")} className={buttonClasses({ variant: "primary", size: "sm" })}>
        수락
      </button>
      <button type="button" disabled={busy} onClick={() => run("decline", undefined, "거절했어요. 상대에게는 알리지 않아요.")} className={buttonClasses({ variant: "secondary", size: "sm" })}>
        거절
      </button>
      <button type="button" disabled={busy} onClick={() => run("report", "이 요청을 신고할까요? 신고하면 요청은 거절돼요.", "신고했어요. 확인 후 조치할게요.")} className={buttonClasses({ variant: "ghost", size: "sm" })}>
        신고
      </button>
      <button type="button" disabled={busy} onClick={() => run("block", "이 사람을 차단할까요? 차단하면 서로 대화할 수 없어요.", "차단했어요.")} className={buttonClasses({ variant: "ghost", size: "sm" })}>
        차단
      </button>
    </div>
  );
}
