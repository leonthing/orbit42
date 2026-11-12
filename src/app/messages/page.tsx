import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { EmptyState } from "@/components/EmptyState";
import { currentUserId } from "@/lib/messages";
import { listDm, type DmSummary } from "@/lib/dm";
import { v190Open } from "@/lib/dm-flags";
import { DmClosed } from "./DmClosed";
import { RequestActions } from "./RequestActions";

export const dynamic = "force-dynamic";

function formatWhen(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const kst = (x: Date) => x.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
  if (kst(d) === kst(new Date())) {
    return d.toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false });
  }
  return d.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "short", day: "numeric" });
}

function Row({ c }: { c: DmSummary }) {
  const name = c.peer.display_name || c.peer.username;
  return (
    <Link href={`/messages/${c.id}`} className="flex items-center gap-3 p-3 hover:bg-charcoal-800/40">
      <Avatar url={c.peer.avatar_url} name={name} size={40} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium text-charcoal-100">{name}</span>
          <span className="shrink-0 text-2xs text-charcoal-500">{formatWhen(c.lastMessageAt)}</span>
        </div>
        <div className="flex items-center gap-2">
          <p className={`truncate text-xs ${c.unread ? "font-semibold text-charcoal-200" : "text-charcoal-500"}`}>
            {c.view === "pending" ? "요청을 보냈어요 · 아직 답이 없어요" : `${c.lastSenderIsMe ? "나: " : ""}${c.preview ?? ""}`}
          </p>
          {c.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-navy-400" />}
        </div>
      </div>
    </Link>
  );
}

export default async function MessagesPage() {
  if (!v190Open()) return <DmClosed />;
  const me = await currentUserId();
  const { items, requests } = me ? await listDm(me) : { items: [], requests: [] };

  return (
    <div className="max-w-2xl">
      <h1 className="max-md:hidden mb-4 text-xl font-semibold text-charcoal-100">메시지</h1>

      {requests.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-semibold text-charcoal-200">대화 요청 {requests.length}</h2>
          <ul className="divide-y divide-charcoal-800/40 overflow-hidden rounded-xl border border-navy-400/30 bg-[rgb(var(--bg-surface))]">
            {requests.map((c) => (
              <li key={c.id}>
                <Row c={c} />
                <div className="px-3 pb-3">
                  <RequestActions conversationId={c.id} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {items.length === 0 ? (
        <EmptyState
          title="아직 주고받은 메시지가 없어요"
          body="다른 사람 프로필에서 '대화' 버튼을 눌러 보세요. 서로 팔로우하거나 예약한 적이 있으면 바로, 아니면 대화 요청으로 시작해요."
          cta={{ label: "사람 둘러보기", href: "/explore" }}
        />
      ) : (
        <ul className="divide-y divide-charcoal-800/40 overflow-hidden rounded-xl border border-charcoal-800/60 bg-[rgb(var(--bg-surface))]">
          {items.map((c) => (
            <li key={c.id}>
              <Row c={c} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
