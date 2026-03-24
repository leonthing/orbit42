import type { Metadata } from "next";

export const metadata: Metadata = { title: "Dashboard" };

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/40 p-5">
      <p className="text-xs font-medium uppercase tracking-wider text-charcoal-500">
        {label}
      </p>
      <p className={`mt-2 text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-charcoal-500">{sub}</p>}
    </div>
  );
}

function SectionCard({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/40">
      <div className="flex items-center justify-between border-b border-charcoal-800/40 px-5 py-3">
        <h2 className="text-sm font-semibold text-charcoal-200">{title}</h2>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-8">
      <p className="text-sm text-charcoal-600">{message}</p>
    </div>
  );
}

export default function DashboardPage() {
  const today = new Date();
  const greeting =
    today.getHours() < 12
      ? "Good morning"
      : today.getHours() < 18
        ? "Good afternoon"
        : "Good evening";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-charcoal-100">{greeting}</h1>
        <p className="mt-1 text-sm text-charcoal-500">
          {today.toLocaleDateString("ko-KR", {
            year: "numeric",
            month: "long",
            day: "numeric",
            weekday: "long",
          })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="사업체"
          value="0"
          sub="운영 중"
          color="text-navy-400"
        />
        <StatCard
          label="오늘 일정"
          value="0"
          sub="건"
          color="text-emerald-400"
        />
        <StatCard
          label="총 자산"
          value="—"
          color="text-amber-400"
        />
        <StatCard
          label="네트워크"
          value="0"
          sub="명"
          color="text-violet-400"
        />
      </div>

      {/* Main Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="오늘의 일정">
          <EmptyState message="오늘 예정된 일정이 없습니다" />
        </SectionCard>

        <SectionCard title="사업 현황">
          <EmptyState message="등록된 사업체가 없습니다" />
        </SectionCard>

        <SectionCard title="최근 노트">
          <EmptyState message="작성된 노트가 없습니다" />
        </SectionCard>

        <SectionCard title="이번 달 재무">
          <EmptyState message="등록된 거래가 없습니다" />
        </SectionCard>
      </div>
    </div>
  );
}
