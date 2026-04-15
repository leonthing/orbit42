import Link from "next/link";

export const metadata = { title: "접근 권한 없음" };

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[rgb(var(--bg-base))] px-4 py-12">
      <Link href="/" className="mb-10 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-red-600 to-red-500">
          <span className="text-sm font-bold text-white">O</span>
        </div>
        <span className="text-base font-semibold text-charcoal-100">Orbit42</span>
      </Link>

      <div className="max-w-sm text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-700 dark:text-amber-400">
          403
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-charcoal-100 sm:text-4xl">
          접근 권한이 없어요
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-charcoal-400">
          이 페이지는 본인만 볼 수 있어요. 로그인 상태를 확인하거나 홈으로
          돌아가주세요.
        </p>
        <div className="mt-7 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-red-500"
          >
            홈으로
          </Link>
          <Link
            href="/feed"
            className="rounded-lg border border-charcoal-700 bg-charcoal-900/30 px-5 py-2.5 text-sm font-medium text-charcoal-100 hover:border-charcoal-600 hover:bg-charcoal-900/60"
          >
            피드 보기
          </Link>
        </div>
      </div>
    </div>
  );
}
