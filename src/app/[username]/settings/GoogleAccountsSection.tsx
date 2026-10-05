"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { disconnectExtraAccount } from "@/lib/google-accounts";
import { disconnectGoogleCalendar } from "@/app/[username]/calendar/actions";
import { useConfirm } from "@/components/ConfirmDialog";

type Account = {
  id: string;
  email: string | null;
  created_at: string;
};

export function GoogleAccountsSection({
  primaryEmail,
  primaryConnected,
  extras,
}: {
  primaryEmail: string | null;
  primaryConnected: boolean;
  extras: Account[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();

  const disconnect = async (id: string) => {
    const ok = await confirm({
      title: "이 Google 계정 연결을 해제할까요?",
      confirmLabel: "해제",
      danger: true,
    });
    if (!ok) return;
    startTransition(async () => {
      await disconnectExtraAccount(id);
      router.refresh();
    });
  };

  const disconnectPrimary = async () => {
    const ok = await confirm({
      title: "기본 Google 계정을 해제할까요?",
      body: "이 계정에서 가져오던 캘린더 이벤트가 더 이상 표시되지 않아요.",
      confirmLabel: "해제",
      danger: true,
    });
    if (!ok) return;
    startTransition(async () => {
      await disconnectGoogleCalendar();
      router.refresh();
    });
  };

  return (
    <section className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/30">
      <div className="flex items-center justify-between border-b border-charcoal-800/40 px-5 py-3">
        <div>
          <h2 className="text-sm font-semibold text-charcoal-200">Google 계정</h2>
          <p className="mt-1 text-xs text-charcoal-500">
            여러 계정을 연결하면 각 계정의 캘린더를 한번에 볼 수 있어요.
          </p>
        </div>
        {primaryConnected && (
          <a
            href="/api/google?return=settings&add=1"
            className="shrink-0 whitespace-nowrap rounded-lg bg-navy-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-400"
          >
            + 계정 추가
          </a>
        )}
      </div>
      {/* 연결 버튼을 누르기 직전이 가장 불안한 순간이라, 무엇을 하고 안 하는지를 여기서 바로 말한다. */}
      <ul className="space-y-1 border-b border-charcoal-800/40 bg-charcoal-900/20 px-5 py-3 text-xs text-charcoal-400">
        {[
          "구글 일정은 orbit42에 복사해 두지 않아요 — 볼 때마다 읽기만 해요 (직접 켜는 오르빗 사람 찾기 제외)",
          "캘린더는 기본 비공개 — 다른 사람에게는 비어 있는 시간만 보여요",
          "예약이 확정될 때만 내 캘린더에 일정을 추가해요",
          "언제든 여기서 연결을 해제할 수 있어요",
        ].map((t) => (
          <li key={t} className="flex gap-2">
            <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
            {t}
          </li>
        ))}
      </ul>
      <ul className="divide-y divide-charcoal-800/40">
        <li className="flex items-center justify-between px-5 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-charcoal-100">
              {primaryConnected ? primaryEmail ?? "Primary account" : "연결되지 않음"}
              {primaryConnected && (
                <span className="ml-2 rounded-full bg-navy-500/25 px-2 py-0.5 text-2xs font-semibold text-navy-300">
                  PRIMARY
                </span>
              )}
            </p>
            {!primaryConnected && (
              <p className="text-xs text-charcoal-500">
                첫 Google Calendar를 먼저 연결해주세요.
              </p>
            )}
          </div>
          {primaryConnected ? (
            <button
              type="button"
              onClick={disconnectPrimary}
              disabled={pending}
              className="shrink-0 whitespace-nowrap rounded-lg border border-charcoal-700 px-3 py-1.5 text-xs text-charcoal-400 hover:border-navy-400/60 hover:text-navy-400"
            >
              해제
            </button>
          ) : (
            <a
              href="/api/google?return=settings"
              className="shrink-0 whitespace-nowrap rounded-lg bg-navy-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-400"
            >
              Google 캘린더 연결
            </a>
          )}
        </li>
        {extras.map((acc) => (
          <li key={acc.id} className="flex items-center justify-between px-5 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm text-charcoal-100">
                {acc.email || "(이메일 미확인)"}
              </p>
              <p className="text-xs text-charcoal-500">
                {new Date(acc.created_at).toLocaleDateString("ko-KR", {
                  timeZone: "Asia/Seoul",
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}{" "}
                연결
              </p>
            </div>
            <button
              type="button"
              onClick={() => disconnect(acc.id)}
              disabled={pending}
              className="rounded-lg border border-charcoal-700 px-3 py-1.5 text-xs text-charcoal-400 hover:border-navy-400/60 hover:text-navy-400"
            >
              해제
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
