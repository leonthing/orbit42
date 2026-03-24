import type { Metadata } from "next";

export const metadata: Metadata = { title: "Network" };

export default function NetworkPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-charcoal-100">Network</h1>
          <p className="mt-1 text-sm text-charcoal-500">인적 네트워크 관리</p>
        </div>
        <button className="rounded-lg bg-navy-600 px-4 py-2 text-sm font-medium text-white hover:bg-navy-500">
          + 연락처 추가
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
        <input
          type="text"
          placeholder="이름, 회사, 태그로 검색..."
          className="w-full rounded-lg border border-charcoal-800 bg-charcoal-900/40 py-2.5 pl-10 pr-4 text-sm text-charcoal-200 placeholder:text-charcoal-600 focus:border-navy-500 focus:outline-none focus:ring-1 focus:ring-navy-500/50"
        />
      </div>

      {/* Empty State */}
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-charcoal-700 py-20">
        <svg className="h-12 w-12 text-charcoal-700" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
        </svg>
        <p className="mt-4 text-sm text-charcoal-500">등록된 연락처가 없습니다</p>
        <p className="mt-1 text-xs text-charcoal-600">네트워크를 구축해보세요</p>
      </div>
    </div>
  );
}
