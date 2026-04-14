import Link from "next/link";

export function PublicChrome({
  children,
  viewerUsername,
}: {
  children: React.ReactNode;
  viewerUsername: string | null;
}) {
  return (
    <div className="min-h-screen bg-[rgb(var(--bg-base))]">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-charcoal-800/40 bg-[rgb(var(--bg-base))]/85 px-4 backdrop-blur md:px-8">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-600/20">
            <span className="text-xs font-bold text-red-400">O</span>
          </div>
          <span className="text-sm font-semibold text-charcoal-100">Orbit42</span>
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
                className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500"
              >
                My Orbit
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-lg px-3 py-1.5 text-sm text-charcoal-300 hover:text-charcoal-100"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500"
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
