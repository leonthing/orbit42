import { notFound } from "next/navigation";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { currentUserId } from "@/lib/messages";
import { getDm } from "@/lib/dm";
import { v190OpenFor } from "@/lib/dm-flags";
import { DmClosed } from "../DmClosed";
import { RequestActions } from "../RequestActions";
import { MessageThread } from "./MessageThread";
import { DmList } from "../DmList";
import { DmSplit } from "../DmSplit";
import { Segmented } from "@/components/Segmented";
import { getSession } from "@/lib/auth";
import { bookingsTabs } from "@/app/[username]/bookings/tabs";

export const dynamic = "force-dynamic";

export default async function ConversationPage({ params }: { params: { id: string } }) {
  const me = await currentUserId();
  if (!v190OpenFor(me)) return <DmClosed />;
  if (!me) notFound();
  const t = await getDm(me, params.id);
  if ("error" in t) notFound();
  const name = t.peer.display_name || t.peer.username;

  const session = await getSession();

  // PC(lg 이상): 예약 탭 '대화'와 같은 틀 — 세그먼트 + 왼쪽 목록(이 방을 칠함) + 오른쪽 방. 휴대폰은 방만, 그대로(묶음 사).
  return (
    <div className="h-full lg:flex lg:min-h-0 lg:flex-col lg:gap-4">
      {session && (
        <div className="max-lg:hidden">
          <Segmented value="chats" items={bookingsTabs(session.username, true)} />
        </div>
      )}
      <DmSplit list={<DmList pane selectedId={t.id} />} inThread>
          <div
            data-chat-room
            // 휴대폰: 화면 높이에 맞춰 목록이 안에서 스크롤되고 입력칸이 아래에 붙게 높이를 정한다.
            // AppShell 이 휴대폰에서 내용만큼 늘어나게 바뀐(묶음 2) 뒤 h-full 만으로는 입력칸이 탭 막대 밑으로 밀렸다.
            // 제목 줄 48 + 위아래 여백 32 + 탭 막대 자리 92 = 172px
            className="flex h-full min-h-0 max-w-2xl flex-col md:mx-auto lg:mx-0 lg:max-w-none max-md:h-[calc(100dvh-172px-env(safe-area-inset-bottom))]"
          >
            <header className="flex items-center gap-3 border-b border-charcoal-800/40 pb-3">
              <Link href="/messages" className="flex shrink-0 items-center justify-center text-charcoal-500 hover:text-charcoal-200 max-md:-ml-3 max-md:h-11 max-md:w-11 lg:hidden" aria-label="뒤로">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                </svg>
              </Link>
              <Link href={`/${t.peer.username}`} className="flex min-w-0 flex-1 items-center gap-2 hover:opacity-80 max-md:min-h-11">
                <Avatar url={t.peer.avatar_url} name={name} size={32} />
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-semibold text-charcoal-100">{name}</span>
                  <span className="text-2xs text-charcoal-500">@{t.peer.username}</span>
                </div>
              </Link>
              <Link href={`/${t.peer.username}`} className="inline-flex shrink-0 items-center rounded-lg border border-charcoal-800/60 px-2.5 py-1 text-xs text-charcoal-300 hover:text-charcoal-100 max-md:min-h-11">
                예약 링크 보기
              </Link>
            </header>

            {t.view === "incoming" && (
              <div className="mt-3 rounded-xl border border-navy-400/30 bg-navy-400/10 p-3 text-sm text-charcoal-200">
                <p className="mb-2">{name}님이 대화를 요청했어요. 답장하거나 수락하면 대화가 열려요.</p>
                <RequestActions conversationId={t.id} firstMessageId={t.messages.find((m) => !m.mine)?.id} />
              </div>
            )}

            <MessageThread conversationId={t.id} initial={t.messages} canWrite={t.canWrite} reason={t.reason} peerName={name} />
          </div>
      </DmSplit>
    </div>
  );
}
