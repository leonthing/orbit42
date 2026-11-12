import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { userIdOf } from "@/lib/dm";
import { listTodos } from "@/lib/todos";
import { v190OpenFor } from "@/lib/dm-flags";
import { EmptyState } from "@/components/EmptyState";
import { TodoChecklist } from "./TodoChecklist";

export const metadata: Metadata = { title: "할 일" };
export const dynamic = "force-dynamic";

/** 할 일 (1.9.0, 웹은 목록과 체크만 — 만들기·고치기는 앱에서) */
export default async function TodosPage({ params }: { params: { username: string } }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.username !== params.username) notFound();
  const me = await userIdOf(session.username);
  if (!me || !v190OpenFor(me)) notFound();
  const r = await listTodos(me);
  if ("error" in r) notFound();
  const groups = [
    { key: "overdue", title: "기한 지남", items: r.overdue },
    { key: "today", title: "오늘", items: r.today },
    { key: "upcoming", title: "예정", items: r.upcoming },
    { key: "someday", title: "기한 없음", items: r.someday },
    { key: "done", title: "완료 (최근 30일)", items: r.done },
  ].filter((g) => g.items.length > 0);

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 text-xl font-semibold text-charcoal-100">할 일</h1>
      <p className="mb-5 text-xs text-charcoal-500">할 일 만들기·고치기는 앱에서 할 수 있어요. 여기서는 체크만 해요.</p>
      {groups.length === 0 ? (
        <EmptyState title="할 일이 없어요" body="앱의 일정 상세에서 '+ 할 일'을 누르거나, 일정을 완료로 표시하면 후속 할 일을 적을 수 있어요." />
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <section key={g.key}>
              <h2 className={`mb-2 text-sm font-semibold ${g.key === "overdue" ? "text-red-400" : "text-charcoal-200"}`}>
                {g.title} <span className="text-charcoal-500">{g.items.length}</span>
              </h2>
              <TodoChecklist items={g.items} />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
