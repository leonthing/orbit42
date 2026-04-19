import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { getAdminClient } from "@/lib/supabase";
import { Avatar } from "@/components/Avatar";
import { DeleteUserButton } from "./DeleteUserButton";

export const metadata: Metadata = { title: "Admin · Orbit42" };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/");

  const db = getAdminClient();

  const [usersRes, slotsRes, bookingsRes, messagesRes] = await Promise.all([
    db
      .from("users")
      .select("id, username, display_name, email, email_verified, avatar_url, created_at, invited_by_user_id")
      .order("created_at", { ascending: false })
      .limit(500),
    db.from("time_slots").select("id", { count: "exact", head: true }),
    db.from("bookings").select("id", { count: "exact", head: true }),
    db.from("messages").select("id", { count: "exact", head: true }),
  ]);

  const users = usersRes.data ?? [];

  const inviterByUser = new Map<string, string>();
  for (const u of users) {
    if (u.invited_by_user_id) {
      inviterByUser.set(u.id as string, u.invited_by_user_id as string);
    }
  }
  const usernameById = new Map<string, string>(
    users.map((u) => [u.id as string, u.username as string]),
  );

  const totalReferred = inviterByUser.size;

  return (
    <div className="min-h-screen bg-[rgb(var(--bg-base))]">
      <div className="mx-auto max-w-6xl px-5 py-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-charcoal-500">
              Admin
            </p>
            <h1 className="mt-1 text-2xl font-bold text-charcoal-100">대시보드</h1>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <Link
              href="/admin/feedback"
              className="rounded-md border border-charcoal-800/60 px-2.5 py-1 text-charcoal-400 hover:border-charcoal-700 hover:text-charcoal-100"
            >
              피드백
            </Link>
            <Link
              href="/admin/email-preview"
              className="rounded-md border border-charcoal-800/60 px-2.5 py-1 text-charcoal-400 hover:border-charcoal-700 hover:text-charcoal-100"
            >
              이메일 미리보기
            </Link>
            <Link
              href="/feed"
              className="text-charcoal-500 hover:text-charcoal-200"
            >
              ← 돌아가기
            </Link>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Stat label="가입자" value={users.length} />
          <Stat label="슬롯" value={slotsRes.count ?? 0} />
          <Stat label="예약" value={bookingsRes.count ?? 0} />
          <Stat label="메시지" value={messagesRes.count ?? 0} />
          <Stat label="추천 가입" value={totalReferred} />
        </div>

        <div className="mt-8 overflow-hidden rounded-xl border border-charcoal-800/60 bg-charcoal-900/30">
          <div className="border-b border-charcoal-800/40 px-5 py-3">
            <h2 className="text-sm font-semibold text-charcoal-200">가입자</h2>
            <p className="text-xs text-charcoal-500">최신순 · 최대 500명</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-charcoal-800/40 text-left text-[11px] uppercase tracking-wider text-charcoal-500">
                  <th className="px-5 py-2 font-semibold">사용자</th>
                  <th className="px-3 py-2 font-semibold">이메일</th>
                  <th className="px-3 py-2 font-semibold">추천인</th>
                  <th className="px-3 py-2 font-semibold">가입일</th>
                  <th className="px-3 py-2 font-semibold" />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const inviterId = inviterByUser.get(u.id as string);
                  const inviterName = inviterId
                    ? usernameById.get(inviterId) ?? "—"
                    : "—";
                  const created = new Date(u.created_at as string).toLocaleString(
                    "ko-KR",
                    {
                      timeZone: "Asia/Seoul",
                      year: "2-digit",
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    },
                  );
                  return (
                    <tr
                      key={u.id as string}
                      className="border-b border-charcoal-800/30 last:border-b-0 hover:bg-charcoal-800/20"
                    >
                      <td className="px-5 py-2.5">
                        <Link
                          href={`/${u.username}`}
                          className="flex items-center gap-2.5"
                        >
                          <Avatar
                            url={u.avatar_url as string | null}
                            name={(u.display_name as string) || (u.username as string)}
                            size={24}
                          />
                          <div className="min-w-0">
                            <p className="truncate text-charcoal-100">
                              {u.display_name || u.username}
                            </p>
                            <p className="truncate text-[11px] text-charcoal-500">
                              @{u.username}
                            </p>
                          </div>
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 text-charcoal-400">
                        {(u.email as string) || "—"}
                        {u.email_verified ? (
                          <span className="ml-1.5 rounded bg-emerald-500/10 px-1 py-0.5 text-[9px] uppercase text-emerald-400">
                            verified
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2.5 text-charcoal-400">
                        {inviterId ? (
                          <Link
                            href={`/${inviterName}`}
                            className="hover:text-charcoal-100"
                          >
                            @{inviterName}
                          </Link>
                        ) : (
                          <span className="text-charcoal-600">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-charcoal-500">{created}</td>
                      <td className="px-3 py-2.5 text-right">
                        <DeleteUserButton
                          userId={u.id as string}
                          username={u.username as string}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/30 px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-charcoal-500">
        {label}
      </p>
      <p className="mt-1 text-xl font-bold text-charcoal-100">{value}</p>
    </div>
  );
}
