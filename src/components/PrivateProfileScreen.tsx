/**
 * 비공개 프로필을 남·손님이 열었을 때 — 이름·사진·소개·링크를 하나도 그리지 않는다(lib/profile-privacy.ts).
 * HTTP 200 + noindex(메타는 PRIVATE_PROFILE_METADATA).
 */
export function PrivateProfileScreen() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-20 text-center" data-testid="privateProfile">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-charcoal-800/60 text-charcoal-400">
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
        </svg>
      </div>
      <h1 className="mt-4 text-lg font-semibold text-charcoal-100">비공개 프로필이에요</h1>
      <p className="mt-1 text-sm text-charcoal-500">이 사람이 프로필을 비공개로 해 두었어요. 직접 받은 예약 링크로는 예약할 수 있어요.</p>
    </div>
  );
}
