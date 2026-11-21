/**
 * PC(lg 1024 이상) 대화 2단 — 왼쪽 대화 목록, 오른쪽 고른 대화(묶음 사, PO 11/22).
 * (lg 아래에선 칸이 h-full 이라 방 높이가 지금처럼 화면에 맞는다 — W900 입력칸 화면 밖 막음)
 * W900 에선 오른쪽 방이 300 남짓이라 좁아 lg 부터(PO 11/22 5번). 그 아래(휴대폰·태블릿)는 지금처럼 목록(예약 탭 '대화') → 방(/messages/{id}) 이동 그대로: 방에선 목록 칸을, 목록에선 빈 오른쪽 칸을 숨긴다.
 */
export function DmSplit({ list, children, inThread }: { list: React.ReactNode; children: React.ReactNode; inThread: boolean }) {
  return (
    <div className="h-full lg:grid lg:h-auto lg:min-h-0 lg:flex-1 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-4 xl:grid-cols-[340px_minmax(0,1fr)]" data-testid="dmSplit">
      <div className={inThread ? "max-lg:hidden lg:min-h-0" : "lg:min-h-0"}>{list}</div>
      <div className={inThread ? "h-full lg:min-h-0" : "max-lg:hidden lg:min-h-0"}>{children}</div>
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
