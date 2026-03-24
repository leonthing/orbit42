import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-charcoal-600">404</h1>
        <p className="mt-4 text-charcoal-400">페이지를 찾을 수 없습니다</p>
        <Link
          href="/dashboard"
          className="mt-6 inline-block rounded-lg bg-navy-600 px-4 py-2 text-sm font-medium text-white hover:bg-navy-500"
        >
          대시보드로 돌아가기
        </Link>
      </div>
    </div>
  );
}
