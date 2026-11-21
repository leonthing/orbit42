/**
 * PC(md 이상) 대화 2단 — 왼쪽 대화 목록, 오른쪽 고른 대화(묶음 사, PO 11/22).
 * 휴대폰은 지금처럼 목록(예약 탭 '대화') → 방(/messages/{id}) 이동 그대로: 방에선 목록 칸을, 목록에선 빈 오른쪽 칸을 숨긴다.
 */
export function DmSplit({ list, children, inThread }: { list: React.ReactNode; children: React.ReactNode; inThread: boolean }) {
  return (
    <div className="md:grid md:min-h-0 md:flex-1 md:grid-cols-[300px_minmax(0,1fr)] md:gap-4 lg:grid-cols-[340px_minmax(0,1fr)]" data-testid="dmSplit">
      <div className={inThread ? "max-md:hidden md:min-h-0" : "md:min-h-0"}>{list}</div>
      <div className={inThread ? "md:min-h-0" : "max-md:hidden md:min-h-0"}>{children}</div>
    </div>
  );
}

/** 방을 고르지 않았을 때 오른쪽 칸 — 대화를 저절로 열지 않는다(열면 상대에게 읽음으로 보인다) */
export function DmPickHint() {
  return (
    <div className="flex h-full min-h-[320px] flex-col items-center justify-center rounded-xl border border-dashed border-charcoal-800/60 px-6 text-center" data-testid="dmPickHint">
      <svg className="h-8 w-8 text-charcoal-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
      </svg>
      <p className="mt-3 text-sm font-medium text-charcoal-200">왼쪽에서 대화를 골라 주세요</p>
      <p className="mt-1 text-xs text-charcoal-500">새 대화는 상대 프로필의 &lsquo;대화&rsquo; 버튼으로 시작해요.</p>
    </div>
  );
}
