"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { TimeRequestRow } from "@/lib/time-requests";
import { acceptTimeRequest, declineTimeRequest } from "@/lib/time-requests";
import { Avatar } from "@/components/Avatar";
import { useToast } from "@/components/Toast";

/** Pending "open your time for me" requests, shown above host bookings. */
export function TimeRequestsInbox({ requests }: { requests: TimeRequestRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [pickedTime, setPickedTime] = useState("");
  const [pending, startTransition] = useTransition();

  if (requests.length === 0) return null;

  const accept = (id: string) => {
    if (!pickedTime) return;
    startTransition(async () => {
      const res = await acceptTimeRequest(id, new Date(pickedTime).toISOString());
      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("수락했어요. 예약이 확정됐습니다.");
      setAcceptingId(null);
      setPickedTime("");
      router.refresh();
    });
  };

  const decline = (id: string) => {
    startTransition(async () => {
      const res = await declineTimeRequest(id);
      if ("error" in res && res.error) toast.error(res.error);
      router.refresh();
    });
  };

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-navy-400">
          시간 요청
        </h2>
        <span className="text-xs text-charcoal-500">{requests.length}</span>
      </div>
      <ul className="space-y-2">
        {requests.map((r) => (
          <li
            key={r.id}
            className="rounded-xl border border-navy-400/30 bg-navy-400/5 p-4"
          >
            <div className="flex items-start gap-3">
              {r.requester && (
                <Link href={`/${r.requester.username}`} className="shrink-0">
                  <Avatar
                    url={r.requester.avatar_url}
                    name={r.requester.display_name || r.requester.username}
                    size={36}
                  />
                </Link>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-charcoal-100">
                  {r.requester?.display_name || r.requester?.username || "익명"}
                  <span className="ml-2 text-xs font-normal text-charcoal-500">
                    {r.duration_min}분
                    {r.budget_cents
                      ? ` · ₩${(r.budget_cents / 100).toLocaleString("ko-KR")} 제안`
                      : ""}
                  </span>
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-charcoal-300">
                  {r.message}
                </p>
                {r.preferred_times && (
                  <p className="mt-1 text-xs text-charcoal-500">
                    희망 시간대: {r.preferred_times}
                  </p>
                )}

                {acceptingId === r.id ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <input
                      type="datetime-local"
                      value={pickedTime}
                      onChange={(e) => setPickedTime(e.target.value)}
                      className="rounded-lg border border-charcoal-800/60 bg-[rgb(var(--bg-surface))] px-3 py-1.5 text-xs text-charcoal-100 focus:border-charcoal-600 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => accept(r.id)}
                      disabled={!pickedTime || pending}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {pending ? "확정 중…" : "이 시간으로 확정"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAcceptingId(null)}
                      className="text-xs text-charcoal-500 hover:text-charcoal-300"
                    >
                      취소
                    </button>
                  </div>
                ) : (
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setAcceptingId(r.id)}
                      disabled={pending}
                      className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                    >
                      시간 정해서 수락
                    </button>
                    <button
                      type="button"
                      onClick={() => decline(r.id)}
                      disabled={pending}
                      className="rounded-lg border border-charcoal-700 px-3 py-1 text-xs text-charcoal-400 hover:border-navy-400/60 hover:text-navy-400 disabled:opacity-50"
                    >
                      거절
                    </button>
                  </div>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
