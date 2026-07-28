import Link from "next/link";

export function PublicChrome({
  children,
  viewerUsername,
  /** 공개 프로필처럼 "사람"이 먼저 보여야 하는 화면은 네비를 아래로 내린다. */
  navAtBottom = false,
  /** 배경을 자식(테마)이 직접 칠할 때 — 셸 배경/여백을 비운다. */
  bare = false,
}: {
  children: React.ReactNode;
  viewerUsername: string | null;
  navAtBottom?: boolean;
  bare?: boolean;
}) {
  const nav = (
      <header
        className={`flex h-14 items-center justify-between px-4 backdrop-blur md:px-8 ${
          navAtBottom
            ? "border-t border-charcoal-800/40 bg-[rgb(var(--bg-base))]/85"
            : "sticky top-0 z-30 border-b border-charcoal-800/40 bg-[rgb(var(--bg-base))]/85"
        }`}
      >
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
  );

  return (
    <div className={bare ? "min-h-screen" : "min-h-screen bg-[rgb(var(--bg-base))]"}>
      {!navAtBottom && nav}
      <main className={bare ? "" : "mx-auto max-w-5xl px-4 py-8 md:px-8 md:py-10"}>
        {children}
      </main>
      {navAtBottom && nav}
    </div>
  );
}
