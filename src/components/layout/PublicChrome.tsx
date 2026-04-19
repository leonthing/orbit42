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
                className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500"
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
