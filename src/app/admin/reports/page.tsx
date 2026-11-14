import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { listReports } from "@/lib/admin-reports";
import { ReportButtons } from "./ReportButtons";

export const metadata: Metadata = { title: "Reports · Admin · Orbit42" };
export const dynamic = "force-dynamic";

const ACTION_LABEL = { block: "차단", hide: "숨김", ignore: "무시" } as const;

function kst(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function who(u: { id: string | null; username: string | null }) {
  if (u.username) return <Link href={`/${u.username}`} className="text-charcoal-100 hover:text-navy-400">@{u.username}</Link>;
  return <span className="text-charcoal-500">{u.id ? "지워진 계정" : "알 수 없음"}</span>;
}

export default async function AdminReportsPage() {
  const items = await listReports();
  if (!items) redirect("/");
  const open = items.filter((i) => !i.handledAt);
  const now = Date.now();
  const overdue = open.filter((i) => now - new Date(i.createdAt).getTime() > 24 * 3600e3).length;

  return (
    <div className="min-h-screen bg-[rgb(var(--bg-base))]">
      <div className="mx-auto max-w-4xl px-5 py-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xs font-semibold uppercase tracking-[0.18em] text-charcoal-500">Admin · Reports</p>
            <h1 className="mt-1 text-2xl font-bold text-charcoal-100">대화 신고</h1>
            <p className="mt-1 text-xs text-charcoal-500">
              미처리 {open.length}건{overdue > 0 ? <span className="text-red-400"> · 24시간 넘김 {overdue}건</span> : null} · 전체 {items.length}건 · 접수 후 24시간 안에 처리
            </p>
          </div>
          <Link href="/admin" className="text-xs text-charcoal-500 hover:text-charcoal-200">← 대시보드</Link>
        </div>

        {items.length === 0 ? (
          <p className="mt-12 text-center text-sm text-charcoal-500">들어온 신고가 없어요.</p>
        ) : (
          <ul className="mt-6 space-y-3">
            {items.map((r) => {
              const hours = Math.floor((now - new Date(r.createdAt).getTime()) / 3600e3);
              const late = !r.handledAt && hours >= 24;
              return (
                <li
                  key={r.id}
                  className={`rounded-xl border p-5 ${
                    r.handledAt
                      ? "border-charcoal-800/40 bg-charcoal-900/20 opacity-70"
                      : late
                        ? "border-red-500/50 bg-red-500/5"
                        : "border-charcoal-800/60 bg-charcoal-900/40"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1 text-xs text-charcoal-400">
                      <p>
                        <span className="mr-2 rounded bg-charcoal-800/60 px-1.5 py-0.5 text-2xs text-charcoal-300">
                          {r.kind === "post" ? "글·사진" : r.kind === "dm" ? "1:1 대화" : "예약 대화"}
                        </span>
                        {kst(r.createdAt)} 접수{!r.handledAt && <span className={late ? "text-red-400" : ""}> · {hours}시간 지남</span>}
                      </p>
                      <p>신고한 사람 {who(r.reporter)} → 신고된 사람 {who(r.reported)}</p>
                      {r.reason && <p>사유: <span className="text-charcoal-200">{r.reason}</span></p>}
                    </div>
                    {r.handledAt ? (
                      <p className="text-2xs text-charcoal-500">
                        {r.action ? ACTION_LABEL[r.action] : "처리"} · {kst(r.handledAt)}
                        {r.handledBy ? ` · ${r.handledBy}` : ""}
                      </p>
                    ) : (
                      <ReportButtons id={r.id} canHide={r.messageLive} />
                    )}
                  </div>
                  <div className="mt-3 space-y-1.5 rounded-lg bg-charcoal-950/40 p-3">
                    {r.lines.length === 0 && <p className="text-2xs text-charcoal-600">사본 없음</p>}
                    {r.lines.map((l, i) => {
                      const side = l.role === "reporter" ? "신고자" : l.role === "reported" ? "신고된 사람" : l.role === "host" ? "호스트" : "게스트";
                      return (
                        <p key={i} className={`text-xs ${l.reported ? "font-semibold text-red-300" : "text-charcoal-300"}`}>
                          <span className="mr-2 text-2xs text-charcoal-600">{side} · {kst(l.at)}</span>
                          <span className="whitespace-pre-wrap">{l.body}</span>
                        </p>
                      );
                    })}
                    {r.photos.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {r.photos.map((u, i) => (
                          // 비공개 버킷 서명 주소(1시간) — 처리 전 확인용
                          // eslint-disable-next-line @next/next/no-img-element
                          <a key={i} href={u} target="_blank" rel="noreferrer"><img src={u} alt="" className="h-20 w-20 rounded object-cover" /></a>
                        ))}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
