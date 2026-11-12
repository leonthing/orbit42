"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/Toast";
import { buttonClasses } from "@/components/PendingButton";
import { DM_MAX_LEN } from "@/lib/dm-limits";

export type DmButtonState = "open" | "request" | "pending" | "incoming" | null;

/**
 * 프로필의 '대화' 버튼 (1.9.0). 바로 대화 조건(서로 팔로우·확정 예약)이면 방을 열고,
 * 아니면 '대화 요청' — 첫 글을 적어 보낸다. 요청을 보냈으면 '요청 보냄'.
 */
export function MessageButton({
  targetUsername,
  loggedIn,
  state,
}: {
  targetUsername: string;
  loggedIn: boolean;
  state: DmButtonState;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [composing, setComposing] = useState(false);
  const [text, setText] = useState("");
  const [sent, setSent] = useState(state === "pending");

  if (loggedIn && state === null) return null;

  const start = async (body?: string) => {
    setPending(true);
    try {
      const res = await fetch("/api/v1/dm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: targetUsername, body }),
      });
      const data = (await res.json()) as { id?: string; view?: string; error?: string; needsRequest?: boolean };
      if (data.needsRequest) {
        setComposing(true);
        return;
      }
      if (!res.ok || !data.id) {
        toast.error(data.error ?? "대화를 열 수 없어요.");
        return;
      }
      if (data.view === "pending") {
        setSent(true);
        setComposing(false);
        setText("");
        toast.success("대화를 요청했어요.", "상대가 수락하면 이어서 대화할 수 있어요.");
        return;
      }
      router.push(`/messages/${data.id}`);
    } finally {
      setPending(false);
    }
  };

  const onClick = () => {
    if (!loggedIn) {
      router.push("/login");
      return;
    }
    if (state === "request") setComposing(true);
    else start();
  };

  const label = sent ? "요청 보냄" : state === "request" ? "대화 요청" : state === "incoming" ? "받은 요청 보기" : "대화";

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        disabled={pending || sent}
        className={buttonClasses({ variant: "secondary", size: "md" })}
      >
        {pending ? "여는 중…" : label}
      </button>
      {composing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center" onClick={() => setComposing(false)}>
          <div className="w-full max-w-md rounded-2xl bg-[rgb(var(--bg-surface))] p-4" onClick={(e) => e.stopPropagation()}>
            <p className="text-base font-semibold text-charcoal-100">대화 요청</p>
            <p className="mt-1 text-xs text-charcoal-500">
              첫 메시지와 함께 요청해요. 상대가 수락하면 대화가 열려요. 하루 5명까지 요청할 수 있어요.
            </p>
            <textarea
              value={text}
              maxLength={DM_MAX_LEN}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              autoFocus
              placeholder="어떤 일로 연락하는지 적어 주세요."
              className="mt-3 w-full resize-none rounded-xl border border-charcoal-800/60 bg-[rgb(var(--bg-base))] px-3 py-2 text-sm text-charcoal-100 placeholder-charcoal-600 focus:outline-none"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" onClick={() => setComposing(false)} className={buttonClasses({ variant: "ghost", size: "md" })}>
                취소
              </button>
              <button
                type="button"
                disabled={pending || !text.trim()}
                onClick={() => start(text.trim())}
                className={buttonClasses({ variant: "primary", size: "md" })}
              >
                {pending ? "보내는 중…" : "요청 보내기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
