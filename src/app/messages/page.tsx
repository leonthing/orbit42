import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { listConversations } from "@/lib/messages";

export const dynamic = "force-dynamic";

function formatWhen(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString("ko-KR", {
      timeZone: "Asia/Seoul",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }
  return d.toLocaleDateString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "short",
    day: "numeric",
  });
}

export default async function MessagesPage() {
  const conversations = await listConversations();

  return (
    <div className="max-w-2xl">
      <h1 className="mb-4 text-xl font-semibold text-charcoal-100">Messages</h1>

      {conversations.length === 0 ? (
        <div className="rounded-xl border border-charcoal-800/60 bg-[rgb(var(--bg-surface))] p-8 text-center text-sm text-charcoal-500">
          아직 주고받은 메시지가 없어요.
          <br />
          다른 사람 프로필에서 <span className="text-charcoal-300">메시지</span> 버튼을 눌러 대화를 시작해보세요.
        </div>
      ) : (
        <ul className="divide-y divide-charcoal-800/40 overflow-hidden rounded-xl border border-charcoal-800/60 bg-[rgb(var(--bg-surface))]">
          {conversations.map((c) => (
            <li key={c.id}>
              <Link
                href={`/messages/${c.id}`}
                className="flex items-center gap-3 p-3 hover:bg-charcoal-800/40"
              >
                <Avatar
                  url={c.other.avatar_url}
                  name={c.other.display_name || c.other.username}
                  size={40}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-charcoal-100">
                      {c.other.display_name || c.other.username}
                    </span>
                    <span className="shrink-0 text-[11px] text-charcoal-500">
                      {formatWhen(c.last_message_at)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <p
                      className={`truncate text-xs ${
                        c.unread
                          ? "font-semibold text-charcoal-200"
                          : "text-charcoal-500"
                      }`}
                    >
                      {c.last_sender_is_me ? "나: " : ""}
                      {c.last_message_preview || "대화를 시작해보세요"}
                    </p>
                    {c.unread && (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" />
                    )}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
