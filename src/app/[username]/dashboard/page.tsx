import type { Metadata } from "next";
import Link from "next/link";
import { getBusinesses } from "../business/actions";
import { getEvents } from "../calendar/actions";
import { getFinanceSummary } from "../finance/actions";
import { getContacts } from "../network/actions";
import { getNotes } from "../notes/actions";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

function formatWon(amount: number): string {
  if (amount === 0) return "₩0";
  return "₩" + amount.toLocaleString("ko-KR");
}

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
  href,
  children,
}: {
  title: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/40">
      <div className="flex items-center justify-between border-b border-charcoal-800/40 px-5 py-3">
        <h2 className="text-sm font-semibold text-charcoal-200">{title}</h2>
        <Link href={href} className="text-xs text-charcoal-500 hover:text-navy-400">
          더보기
        </Link>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-6">
      <p className="text-sm text-charcoal-600">{message}</p>
    </div>
  );
}

export default async function DashboardPage({
  params,
}: {
  params: { username: string };
}) {
  const u = params.username;

  // Fetch all data in parallel, with graceful fallbacks
  const [businesses, todayEvents, summary, contacts, notes] = await Promise.all([
    getBusinesses().catch(() => []),
    getEvents(new Date().getFullYear(), new Date().getMonth()).catch(() => []),
    getFinanceSummary().catch(() => ({ totalAssets: 0, monthIncome: 0, monthExpense: 0 })),
    getContacts().catch(() => []),
    getNotes().catch(() => []),
  ]);

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const todaysEvents = (todayEvents as Array<{ id: string; title: string; start_at: string; all_day: boolean }>).filter(
    (e) => e.start_at.startsWith(todayStr)
  );
  const activeBusinesses = (businesses as Array<{ status: string }>).filter((b) => b.status === "active");
  const recentNotes = (notes as Array<{ id: string; title: string; category: string; updated_at: string }>).slice(0, 5);

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
          value={String(activeBusinesses.length)}
          sub="운영 중"
          color="text-navy-400"
        />
        <StatCard
          label="오늘 일정"
          value={String(todaysEvents.length)}
          sub="건"
          color="text-emerald-400"
        />
        <StatCard
          label="총 자산"
          value={summary.totalAssets ? formatWon(summary.totalAssets) : "—"}
          color="text-amber-400"
        />
        <StatCard
          label="네트워크"
          value={String((contacts as Array<unknown>).length)}
          sub="명"
          color="text-violet-400"
        />
      </div>

      {/* Main Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="오늘의 일정" href={`/${u}/calendar`}>
          {todaysEvents.length === 0 ? (
            <EmptyState message="오늘 예정된 일정이 없습니다" />
          ) : (
            <ul className="space-y-2">
              {todaysEvents.map((e) => (
                <li key={e.id} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-charcoal-800/30">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-navy-400" />
                  <span className="text-charcoal-200">{e.title}</span>
                  {!e.all_day && (
                    <span className="ml-auto text-xs text-charcoal-500">
                      {new Date(e.start_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="사업 현황" href={`/${u}/business`}>
          {(businesses as Array<{ id: string; name: string; status: string; industry?: string }>).length === 0 ? (
            <EmptyState message="등록된 사업체가 없습니다" />
          ) : (
            <ul className="space-y-2">
              {(businesses as Array<{ id: string; name: string; status: string; industry?: string }>).slice(0, 5).map((b) => (
                <li key={b.id} className="flex items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-charcoal-800/30">
                  <span className="text-charcoal-200">{b.name}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${
                    b.status === "active" ? "bg-emerald-500/10 text-emerald-400" :
                    b.status === "paused" ? "bg-amber-500/10 text-amber-400" :
                    "bg-red-500/10 text-red-400"
                  }`}>
                    {b.status === "active" ? "운영 중" : b.status === "paused" ? "일시정지" : "종료"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="최근 노트" href={`/${u}/notes`}>
          {recentNotes.length === 0 ? (
            <EmptyState message="작성된 노트가 없습니다" />
          ) : (
            <ul className="space-y-2">
              {recentNotes.map((n) => (
                <li key={n.id}>
                  <Link
                    href={`/${u}/notes/${n.id}`}
                    className="flex items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-charcoal-800/30"
                  >
                    <span className="text-charcoal-200">{n.title}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${
                      n.category === "idea" ? "bg-violet-500/10 text-violet-400" :
                      n.category === "meeting" ? "bg-blue-500/10 text-blue-400" :
                      "bg-charcoal-500/10 text-charcoal-400"
                    }`}>
                      {n.category === "idea" ? "아이디어" : n.category === "meeting" ? "회의록" : "메모"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="이번 달 재무" href={`/${u}/finance`}>
          {summary.monthIncome === 0 && summary.monthExpense === 0 ? (
            <EmptyState message="등록된 거래가 없습니다" />
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-charcoal-400">수입</span>
                <span className="font-medium text-emerald-400">{formatWon(summary.monthIncome)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-charcoal-400">지출</span>
                <span className="font-medium text-red-400">{formatWon(summary.monthExpense)}</span>
              </div>
              <div className="border-t border-charcoal-800/40 pt-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-charcoal-300">순이익</span>
                  <span className={`font-bold ${summary.monthIncome - summary.monthExpense >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {formatWon(summary.monthIncome - summary.monthExpense)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
