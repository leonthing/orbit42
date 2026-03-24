import Link from "next/link";

export default function BusinessDetailPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/business"
          className="rounded-lg p-1.5 text-charcoal-500 hover:bg-charcoal-800/50 hover:text-charcoal-300"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
        </Link>
        <h1 className="text-2xl font-bold text-charcoal-100">사업체 상세</h1>
      </div>

      <div className="flex items-center justify-center rounded-xl border border-dashed border-charcoal-700 py-20">
        <p className="text-sm text-charcoal-600">사업체를 찾을 수 없습니다 (ID: {params.id})</p>
      </div>
    </div>
  );
}
