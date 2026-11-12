import { notFound } from "next/navigation";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { currentUserId } from "@/lib/messages";
import { getDm } from "@/lib/dm";
import { v190OpenFor } from "@/lib/dm-flags";
import { DmClosed } from "../DmClosed";
import { RequestActions } from "../RequestActions";
import { MessageThread } from "./MessageThread";

export const dynamic = "force-dynamic";

export default async function ConversationPage({ params }: { params: { id: string } }) {
  const me = await currentUserId();
  if (!v190OpenFor(me)) return <DmClosed />;
  if (!me) notFound();
  const t = await getDm(me, params.id);
  if ("error" in t) notFound();
  const name = t.peer.display_name || t.peer.username;

  return (
    <div className="flex h-[calc(100dvh-5rem)] max-w-2xl flex-col">
      <header className="flex items-center gap-3 border-b border-charcoal-800/40 pb-3">
        <Link href="/messages" className="text-charcoal-500 hover:text-charcoal-200" aria-label="뒤로">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <Link href={`/${t.peer.username}`} className="flex min-w-0 flex-1 items-center gap-2 hover:opacity-80">
          <Avatar url={t.peer.avatar_url} name={name} size={32} />
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold text-charcoal-100">{name}</span>
            <span className="text-2xs text-charcoal-500">@{t.peer.username}</span>
          </div>
        </Link>
        <Link href={`/${t.peer.username}`} className="shrink-0 rounded-lg border border-charcoal-800/60 px-2.5 py-1 text-xs text-charcoal-300 hover:text-charcoal-100">
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
  );
}
