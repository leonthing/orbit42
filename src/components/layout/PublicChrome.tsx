import Link from "next/link";

export function PublicChrome({
  children,
  viewerUsername,
  /** 공개 프로필처럼 "사람"이 먼저 보여야 하는 화면은 상단 바 대신 하단 텍스트 링크. */
  navAtBottom = false,
}: {
  children: React.ReactNode;
  viewerUsername: string | null;
  navAtBottom?: boolean;
}) {
  if (navAtBottom) {
    // 배경은 페이지(테마)가 칠하므로 셸은 투명하게 두고, 링크만 아래에 얹는다.
    return (
      <div className="min-h-screen">
        <main className="mx-auto max-w-5xl px-4 py-8 md:px-8 md:py-10">
          {children}
        </main>
        <footer className="relative z-10 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 pb-8 text-[11px] text-charcoal-500">
          <Link href="/explore" className="hover:text-charcoal-300">
            둘러보기
          </Link>
          <span aria-hidden>·</span>
          {viewerUsername ? (
            <Link href={`/${viewerUsername}`} className="hover:text-charcoal-300">
              내 orbit
            </Link>
          ) : (
            <Link href="/?mode=signin#auth" className="hover:text-charcoal-300">
              로그인
            </Link>
          )}
          <span aria-hidden>·</span>
          <Link href="/terms" className="hover:text-charcoal-300">
            이용약관
          </Link>
          <span aria-hidden>·</span>
          <Link href="/privacy" className="hover:text-charcoal-300">
            개인정보처리방침
          </Link>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[rgb(var(--bg-base))]">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-charcoal-800/40 bg-[rgb(var(--bg-base))]/85 px-4 backdrop-blur md:px-8">
        <Link href="/" className="text-sm font-semibold tracking-tight text-charcoal-100">
          Orbit42
        </Link>

        <div className="flex items-center gap-2">
          <Link
            href="/explore"
            className="rounded-lg px-3 py-1.5 text-sm text-charcoal-300 hover:text-charcoal-100"
          >
            Explore
          </Link>
          {viewerUsername ? (
            <>
              <Link
                href="/feed"
                className="rounded-lg px-3 py-1.5 text-sm text-charcoal-300 hover:text-charcoal-100"
              >
                Feed
              </Link>
              <Link
                href={`/${viewerUsername}`}
                className="rounded-lg bg-navy-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-navy-400"
              >
                My Orbit
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/?mode=signin#auth"
                className="rounded-lg px-3 py-1.5 text-sm text-charcoal-300 hover:text-charcoal-100"
              >
                Sign in
              </Link>
              <Link
                href="/?mode=signup#auth"
                className="rounded-lg bg-navy-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-navy-400"
              >
                Get started
              </Link>
            </>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 md:px-8 md:py-10">{children}</main>
    </div>
  );
}
