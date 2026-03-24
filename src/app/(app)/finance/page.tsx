import type { Metadata } from "next";

export const metadata: Metadata = { title: "Finance" };

function MetricCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/40 p-5">
      <p className="text-xs font-medium uppercase tracking-wider text-charcoal-500">
        {label}
      </p>
      <p className={`mt-2 text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

export default function FinancePage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-charcoal-100">Finance</h1>
          <p className="mt-1 text-sm text-charcoal-500">재무 및 자산 관리</p>
        </div>
        <button className="rounded-lg bg-navy-600 px-4 py-2 text-sm font-medium text-white hover:bg-navy-500">
          + 거래 추가
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="총 자산" value="—" color="text-charcoal-200" />
        <MetricCard label="이번 달 수입" value="₩0" color="text-emerald-400" />
        <MetricCard label="이번 달 지출" value="₩0" color="text-red-400" />
        <MetricCard label="순이익" value="₩0" color="text-amber-400" />
      </div>

      {/* Sections */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Business Finance */}
        <div className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/40">
          <div className="border-b border-charcoal-800/40 px-5 py-3">
            <h2 className="text-sm font-semibold text-charcoal-200">사업 재무</h2>
          </div>
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-charcoal-600">사업체를 먼저 등록해주세요</p>
          </div>
        </div>

        {/* Personal Assets */}
        <div className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/40">
          <div className="border-b border-charcoal-800/40 px-5 py-3">
            <h2 className="text-sm font-semibold text-charcoal-200">개인 자산</h2>
          </div>
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-charcoal-600">등록된 자산이 없습니다</p>
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/40">
        <div className="border-b border-charcoal-800/40 px-5 py-3">
          <h2 className="text-sm font-semibold text-charcoal-200">최근 거래</h2>
        </div>
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-charcoal-600">등록된 거래가 없습니다</p>
        </div>
      </div>
    </div>
  );
}
