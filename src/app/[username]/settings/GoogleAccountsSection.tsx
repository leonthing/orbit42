"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { disconnectExtraAccount } from "@/lib/google-accounts";
import { disconnectGoogleCalendar } from "@/app/[username]/calendar/actions";

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

  const disconnect = (id: string) => {
    if (!confirm("이 Google 계정 연결을 해제할까요?")) return;
    startTransition(async () => {
      await disconnectExtraAccount(id);
      router.refresh();
    });
  };

  const disconnectPrimary = () => {
    if (
      !confirm(
        "기본 Google 계정 연결을 해제할까요? 이 계정에서 가져오던 캘린더 이벤트가 더 이상 표시되지 않아요.",
      )
    )
      return;
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
        <a
          href="/api/google?return=settings&add=1"
          className="shrink-0 whitespace-nowrap rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500"
        >
          + 계정 추가
        </a>
      </div>
      <ul className="divide-y divide-charcoal-800/40">
        <li className="flex items-center justify-between px-5 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-charcoal-100">
              {primaryConnected ? primaryEmail ?? "Primary account" : "연결되지 않음"}
              {primaryConnected && (
                <span className="ml-2 rounded-full bg-red-600/25 px-2 py-0.5 text-[10px] font-semibold text-red-300">
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
              className="shrink-0 whitespace-nowrap rounded-lg border border-charcoal-700 px-3 py-1.5 text-xs text-charcoal-400 hover:border-red-500/60 hover:text-red-500"
            >
              해제
            </button>
          ) : (
            <a
              href="/api/google?return=settings"
              className="shrink-0 rounded-lg border border-charcoal-700 px-3 py-1.5 text-xs text-charcoal-200 hover:border-charcoal-600"
            >
              연결
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
              className="rounded-lg border border-charcoal-700 px-3 py-1.5 text-xs text-charcoal-400 hover:border-red-500/60 hover:text-red-400"
            >
              해제
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
