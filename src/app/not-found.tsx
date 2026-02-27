import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <h1 className="text-6xl font-bold text-charcoal-300 dark:text-charcoal-700">
        404
      </h1>
      <p className="mt-4 text-lg text-charcoal-600 dark:text-charcoal-400">
        페이지를 찾을 수 없습니다.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-lg bg-navy-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-navy-700 dark:bg-navy-500 dark:hover:bg-navy-600"
      >
        홈으로 돌아가기
      </Link>
    </div>
  );
}
