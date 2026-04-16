import Link from "next/link";
import { listNotifications } from "@/lib/notifications";
import { Avatar } from "@/components/Avatar";
import { MarkAllButton } from "./MarkAllButton";

export const dynamic = "force-dynamic";

function when(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default async function NotificationsPage() {
  const items = await listNotifications(100);
  const hasUnread = items.some((n) => !n.read_at);
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-charcoal-100">알림</h1>
        {hasUnread && <MarkAllButton />}
      </div>
      {items.length === 0 ? (
        <div className="rounded-xl border border-charcoal-800/60 bg-[rgb(var(--bg-surface))] p-10 text-center text-sm text-charcoal-500">
          아직 알림이 없어요.
        </div>
      ) : (
        <ul className="divide-y divide-charcoal-800/40 overflow-hidden rounded-xl border border-charcoal-800/60 bg-[rgb(var(--bg-surface))]">
          {items.map((n) => (
            <li key={n.id}>
              <Link
                href={n.link ?? "#"}
                className={`flex items-start gap-3 p-4 hover:bg-charcoal-800/40 ${
                  !n.read_at ? "bg-red-600/5" : ""
                }`}
              >
                {n.actor ? (
                  <Avatar
                    url={n.actor.avatar_url}
                    name={n.actor.display_name || n.actor.username}
                    size={36}
                  />
                ) : (
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-600/15 text-red-400">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31" />
                    </svg>
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-charcoal-100">{n.title}</p>
                  {n.body && (
                    <p className="mt-0.5 text-xs text-charcoal-400 line-clamp-2">
                      {n.body}
                    </p>
                  )}
                  <p className="mt-1 text-[11px] text-charcoal-600">
                    {when(n.created_at)}
                  </p>
                </div>
                {!n.read_at && (
                  <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-red-500" />
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
