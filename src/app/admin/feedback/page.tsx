import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { listFeedback } from "@/lib/feedback";
import { Avatar } from "@/components/Avatar";
import { ResolveButton } from "./ResolveButton";
import { EmptyState } from "@/components/EmptyState";

export const metadata: Metadata = { title: "Feedback · Admin · Orbit42" };
export const dynamic = "force-dynamic";

export default async function AdminFeedbackPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/");

  const items = await listFeedback();
  const unresolved = items.filter((i) => !i.resolved_at);

  return (
    <div className="min-h-screen bg-[rgb(var(--bg-base))]">
      <div className="mx-auto max-w-4xl px-5 py-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xs font-semibold uppercase tracking-[0.18em] text-charcoal-500">
              Admin · Feedback
            </p>
            <h1 className="mt-1 text-2xl font-bold text-charcoal-100">
              사용자 피드백
            </h1>
            <p className="mt-1 text-xs text-charcoal-500">
              전체 {items.length}건 · 미해결 {unresolved.length}건
            </p>
          </div>
          <Link
            href="/admin"
            className="text-xs text-charcoal-500 hover:text-charcoal-200"
          >
            ← 대시보드
          </Link>
        </div>

        {items.length === 0 ? (
          <div className="mt-12">
            <EmptyState
              icon={
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z"
                  />
                </svg>
              }
              title="아직 피드백이 없어요"
              body="사이드바의 '피드백 보내기' 로 사용자가 의견을 남기면 여기 쌓여요."
            />
          </div>
        ) : (
          <ul className="mt-6 space-y-3">
            {items.map((f) => {
              const when = new Date(f.created_at).toLocaleString("ko-KR", {
                timeZone: "Asia/Seoul",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              });
              return (
                <li
                  key={f.id}
                  className={`rounded-xl border p-5 ${
                    f.resolved_at
                      ? "border-charcoal-800/40 bg-charcoal-900/20 opacity-70"
                      : "border-charcoal-800/60 bg-charcoal-900/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      {f.user ? (
                        <>
                          <Avatar
                            url={f.user.avatar_url}
                            name={f.user.display_name || f.user.username}
                            size={28}
                          />
                          <div className="min-w-0">
                            <Link
                              href={`/${f.user.username}`}
                              className="truncate text-sm font-semibold text-charcoal-100 hover:text-navy-400"
                            >
                              {f.user.display_name || f.user.username}
                            </Link>
                            <p className="truncate text-2xs text-charcoal-500">
                              @{f.user.username}
                              {f.email ? ` · ${f.email}` : ""}
                            </p>
                          </div>
                        </>
                      ) : (
                        <div>
                          <p className="text-sm font-semibold text-charcoal-300">
                            익명
                          </p>
                          <p className="text-2xs text-charcoal-500">
                            {f.email ?? "회신 주소 없음"}
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2 text-2xs text-charcoal-500">
                      <span>{when}</span>
                      <ResolveButton
                        id={f.id}
                        resolved={!!f.resolved_at}
                      />
                    </div>
                  </div>

                  <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-charcoal-100">
                    {f.body}
                  </p>

                  {(f.path || f.user_agent) && (
                    <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-2xs text-charcoal-600">
                      {f.path && <span>📍 {f.path}</span>}
                      {f.user_agent && (
                        <span className="truncate">🖥 {f.user_agent}</span>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
