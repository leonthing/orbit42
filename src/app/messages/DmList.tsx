import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { EmptyState } from "@/components/EmptyState";
import { currentUserId } from "@/lib/messages";
import { listDm, type DmSummary } from "@/lib/dm";
import { v190OpenFor } from "@/lib/dm-flags";
import { DmClosed } from "./DmClosed";
import { RequestActions } from "./RequestActions";

function formatWhen(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const kst = (x: Date) => x.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
  if (kst(d) === kst(new Date())) {
    return d.toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false });
  }
  return d.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "short", day: "numeric" });
}

function Row({ c, selected }: { c: DmSummary; selected?: boolean }) {
  const name = c.peer.display_name || c.peer.username;
  return (
    <Link
      href={`/messages/${c.id}`}
      aria-current={selected ? "page" : undefined}
      className={`flex items-center gap-3 p-3 hover:bg-charcoal-800/40 ${selected ? "md:bg-charcoal-800/60" : ""}`}
    >
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

/**
 * 1:1 대화 목록 — 예약 탭 '대화' 세그먼트(iOS 와 같은 자리)에서 보여 준다.
 * pane: PC(md 이상) 2단의 왼쪽 칸으로 쓸 때 — 칸 높이 안에서 스크롤, 고른 대화(selectedId)를 칠한다. 휴대폰 모양은 그대로.
 */
export async function DmList({ selectedId, pane }: { selectedId?: string; pane?: boolean } = {}) {
  const me = await currentUserId();
  if (!v190OpenFor(me)) return <DmClosed />;
  const { items, requests } = me ? await listDm(me) : { items: [], requests: [] };

  return (
    <div className={pane ? "max-w-2xl md:h-full md:max-w-none md:overflow-y-auto" : "max-w-2xl"} data-testid={pane ? "dmPane" : undefined}>
      {requests.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-semibold text-charcoal-200">대화 요청 {requests.length}</h2>
          <ul className="divide-y divide-charcoal-800/40 overflow-hidden rounded-xl border border-navy-400/30 bg-[rgb(var(--bg-surface))]">
            {requests.map((c) => (
              <li key={c.id}>
                <Row c={c} selected={c.id === selectedId} />
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
              <Row c={c} selected={c.id === selectedId} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
