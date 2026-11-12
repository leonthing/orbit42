import { EmptyState } from "@/components/EmptyState";
import { WEB_DM_CLOSED_MESSAGE } from "@/lib/dm-flags";

/** 웹 1:1 메시지를 1.9.0 전까지 막아 둔 동안 /messages·/messages/<id> 에 보이는 안내 */
export function DmClosed() {
  return (
    <div className="max-w-2xl">
      <EmptyState
        title="1:1 메시지 준비 중"
        body={`${WEB_DM_CLOSED_MESSAGE} 예약 관련 대화는 예약 화면의 대화에서 이어 가실 수 있어요.`}
        cta={{ label: "사람 둘러보기", href: "/explore" }}
      />
    </div>
  );
}
