import type { Metadata } from "next";
import { getFinanceSummary, getTransactions, getAssets } from "./actions";
import FinanceDashboard from "./FinanceDashboard";

export const metadata: Metadata = { title: "Finance" };

function formatWon(amount: number): string {
  return "₩" + amount.toLocaleString("ko-KR");
}

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

export default async function FinancePage() {
  const [summary, transactions, assets] = await Promise.all([
    getFinanceSummary(),
    getTransactions(),
    getAssets(),
  ]);

  const netIncome = summary.monthIncome - summary.monthExpense;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-charcoal-100">Finance</h1>
        <p className="mt-1 text-sm text-charcoal-500">재무 및 자산 관리</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard
          label="총 자산"
          value={formatWon(summary.totalAssets)}
          color="text-charcoal-200"
        />
        <MetricCard
          label="이번 달 수입"
          value={formatWon(summary.monthIncome)}
          color="text-emerald-400"
        />
        <MetricCard
          label="이번 달 지출"
          value={formatWon(summary.monthExpense)}
          color="text-red-400"
        />
        <MetricCard
          label="순이익"
          value={`${netIncome >= 0 ? "" : "-"}${formatWon(Math.abs(netIncome))}`}
          color="text-amber-400"
        />
      </div>

      {/* Dashboard */}
      <FinanceDashboard
        initialTransactions={transactions}
        initialAssets={assets}
      />
    </div>
  );
}
