import { notFound } from "next/navigation";
import Link from "next/link";
import { getConversation, markRead } from "@/lib/messages";
import { Avatar } from "@/components/Avatar";
import { MessageThread } from "./MessageThread";

export const dynamic = "force-dynamic";

export default async function ConversationPage({
  params,
}: {
  params: { id: string };
}) {
  const res = await getConversation(params.id);
  if ("error" in res) notFound();
  if (!res.other) notFound();

  // Mark this conversation as read when the thread is opened.
  await markRead(params.id);

  return (
    <div className="mx-auto flex h-[calc(100vh-5rem)] max-w-2xl flex-col">
      <header className="flex items-center gap-3 border-b border-charcoal-800/40 pb-3">
        <Link
          href="/messages"
          className="text-charcoal-500 hover:text-charcoal-200"
          aria-label="뒤로"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <Link
          href={`/${res.other.username}`}
          className="flex items-center gap-2 hover:opacity-80"
        >
          <Avatar
            url={res.other.avatar_url}
            name={res.other.display_name || res.other.username}
            size={32}
          />
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-charcoal-100">
              {res.other.display_name || res.other.username}
            </span>
            <span className="text-[11px] text-charcoal-500">
              @{res.other.username}
            </span>
          </div>
        </Link>
      </header>

      <MessageThread
        conversationId={params.id}
        me={res.me}
        initial={res.messages}
      />
    </div>
  );
}
