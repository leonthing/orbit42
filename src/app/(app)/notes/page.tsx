import type { Metadata } from "next";

export const metadata: Metadata = { title: "Notes" };

export default function NotesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-charcoal-100">Notes</h1>
          <p className="mt-1 text-sm text-charcoal-500">아이디어 및 메모</p>
        </div>
        <button className="rounded-lg bg-navy-600 px-4 py-2 text-sm font-medium text-white hover:bg-navy-500">
          + 새 노트
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {["전체", "아이디어", "회의록", "메모"].map((tab, i) => (
          <button
            key={tab}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
              i === 0
                ? "bg-navy-600/15 text-navy-400"
                : "text-charcoal-500 hover:bg-charcoal-800/50 hover:text-charcoal-300"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Empty State */}
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-charcoal-700 py-20">
        <svg className="h-12 w-12 text-charcoal-700" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
        </svg>
        <p className="mt-4 text-sm text-charcoal-500">작성된 노트가 없습니다</p>
        <p className="mt-1 text-xs text-charcoal-600">첫 번째 아이디어를 기록해보세요</p>
      </div>
    </div>
  );
}
