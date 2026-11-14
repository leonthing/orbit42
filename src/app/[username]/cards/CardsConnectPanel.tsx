"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/ConfirmDialog";
import { disconnectCardsAction } from "./cards-actions";

export function CardsConnectPanel({ connected, email }: { connected: boolean; email: string | null }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, start] = useTransition();

  const disconnect = async (revokeAll: boolean) => {
    const ok = await confirm(
      revokeAll
        ? {
            title: "Google 권한까지 모두 회수할까요?",
            body: "Google은 orbit42의 권한을 한꺼번에 회수해요. 명함뿐 아니라 캘린더 연결도 끊겨서, 캘린더를 쓰려면 다시 연결해야 해요.",
            confirmLabel: "모두 회수",
            danger: true,
          }
        : {
            title: "명함 연결을 해제할까요?",
            body: "orbit42에 있는 명함용 연결만 지워요. 캘린더 연결은 그대로예요. 이미 저장한 연락처와 Drive 사진은 그대로 남아요.",
            confirmLabel: "해제",
            danger: true,
          },
    );
    if (!ok) return;
    start(async () => {
      await disconnectCardsAction(revokeAll);
      router.refresh();
    });
  };

  return (
    <section className="mt-5 rounded-xl border border-charcoal-800/60 bg-charcoal-900/30">
      <div className="flex items-center justify-between gap-3 border-b border-charcoal-800/40 px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-charcoal-200">Google 연락처 연결</h2>
          <p className="mt-1 truncate text-xs text-charcoal-500" data-testid="cardsStatus">
            {connected ? `연결됨 · ${email ?? "계정 확인 중"}` : "연결 안 됨"}
          </p>
        </div>
        {!connected && (
          <a
            href="/api/cards/connect"
            className="shrink-0 whitespace-nowrap rounded-lg bg-navy-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-400 max-md:min-h-11 max-md:inline-flex max-md:items-center"
          >
            Google 연결
          </a>
        )}
      </div>
      <ul className="space-y-1 px-5 py-3 text-xs text-charcoal-400">
        {[
          "명함 글자는 휴대폰 안에서 읽어요 — 사진과 글자를 외부 AI로 보내지 않아요",
          "'저장'을 눌러야만 Google 연락처에 써요. 같은 사람이 있으면 갱신할지 먼저 물어요",
          "명함 사진은 내 Drive 'Orbit42 명함' 폴더에만 두고, orbit42 서버에는 남기지 않아요",
          "권한은 연락처와, orbit42가 만든 Drive 파일뿐이에요",
        ].map((t) => (
          <li key={t} className="flex gap-2">
            <span aria-hidden>·</span>
            <span>{t}</span>
          </li>
        ))}
      </ul>
      {connected && (
        <div className="flex flex-wrap gap-2 border-t border-charcoal-800/40 px-5 py-3">
          <button
            type="button"
            disabled={pending}
            onClick={() => disconnect(false)}
            className="rounded-lg border border-charcoal-700 px-3 py-1.5 text-xs text-charcoal-300 hover:bg-charcoal-800 disabled:opacity-50 max-md:min-h-11"
          >
            연결 해제
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => disconnect(true)}
            className="rounded-lg border border-red-500/40 px-3 py-1.5 text-xs text-red-500 hover:bg-red-500/10 disabled:opacity-50 max-md:min-h-11"
          >
            Google 권한까지 모두 회수(캘린더도 끊김)
          </button>
        </div>
      )}
    </section>
  );
}
