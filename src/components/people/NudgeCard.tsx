"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { buttonClasses } from "@/components/PendingButton";
import { useToast } from "@/components/Toast";
import { logMeetingAction, updatePersonAction } from "@/app/[username]/people/actions";
import type { OrbitPerson } from "@/lib/people-types";
import { PersonAvatar } from "./PersonAvatar";
import { CheckInButton } from "./CheckInButton";

/**
 * 안부 넛지 — 두 번 이상 만난 사이인데 3주 넘게 못 본 사람.
 * 오르빗 화면과 캘린더 상단에서 함께 쓴다.
 */
export function NudgeCard({
  person: p,
  days,
  username,
}: {
  person: OrbitPerson;
  days: number;
  username: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [gone, setGone] = useState(false);
  const [pending, start] = useTransition();
  if (gone) return null;

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, msg?: string) =>
    start(async () => {
      const r = await fn();
      if (r.ok) {
        setGone(true);
        if (msg) toast.success(msg);
        router.refresh();
      } else toast.error(r.error ?? "처리하지 못했어요.");
    });


  return (
    <div className="flex items-start gap-3 rounded-2xl border border-charcoal-800/50 bg-[rgb(var(--bg-surface))] p-4">
      <PersonAvatar person={p} size={36} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-charcoal-100">
          {p.name}님과 마지막으로 만난 지 {days}일이 지났어요
        </p>
        <p className="mt-0.5 text-xs text-charcoal-400">짧은 안부나 시간 제안으로 다시 가까워져 볼까요?</p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          <CheckInButton person={p} username={username} className={buttonClasses({ variant: "secondary", size: "sm" })}>
            안부 보내기
          </CheckInButton>
          {p.member && (
            // 회원이면 그 사람 프로필(열린 슬롯·시간 요청)로
            <a href={`/${p.member.username}`} className={buttonClasses({ variant: "ghost", size: "sm" })}>
              시간 제안하기
            </a>
          )}
          <button
            type="button"
            disabled={pending}
            className={buttonClasses({ variant: "ghost", size: "sm" })}
            onClick={() => act(() => logMeetingAction(p.id, {}), "만남을 남겼어요")}
          >
            만났어요
          </button>
        </div>
      </div>
      <button
        type="button"
        aria-label="닫기"
        disabled={pending}
        onClick={() => act(() => updatePersonAction(p.id, { dismissNudge: true }))}
        className="rounded-full p-1 text-charcoal-500 hover:bg-charcoal-800/50 hover:text-charcoal-200"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
    </div>
  );
}
