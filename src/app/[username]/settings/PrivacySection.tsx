"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { setProfilePrivate } from "./privacy-actions";
import { unblockUser } from "@/lib/blocks-actions";

type Blocked = { username: string; displayName: string | null };

/**
 * 개인정보·안전 — iOS 설정 '계정' 묶음과 같은 내용(11/21 묶음 다).
 * 프로필 비공개 토글(문구는 iOS 와 같게) + 차단한 사용자 목록·해제.
 */
export function PrivacySection({ initialPrivate, initialBlocked }: { initialPrivate: boolean; initialBlocked: Blocked[] }) {
  const [isPrivate, setIsPrivate] = useState(initialPrivate);
  const [blocked, setBlocked] = useState(initialBlocked);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const toggle = () => {
    const next = !isPrivate;
    setIsPrivate(next);
    setMsg(null);
    start(async () => {
      const r = await setProfilePrivate(next);
      if ("error" in r) {
        setIsPrivate(!next);
        setMsg(r.error ?? "저장에 실패했어요.");
      }
    });
  };

  const unblock = (username: string) => {
    setMsg(null);
    start(async () => {
      const r = await unblockUser(username);
      if (r && "error" in r) setMsg(r.error ?? "해제에 실패했어요.");
      else setBlocked((list) => list.filter((u) => u.username !== username));
    });
  };

  return (
    <section className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/40">
      <div className="border-b border-charcoal-800/40 px-5 py-3">
        <h2 className="text-sm font-semibold text-charcoal-200">개인정보·안전</h2>
      </div>
      <div className="space-y-5 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-charcoal-100" id="private-label">프로필 비공개</p>
            <p className="mt-1 text-xs text-charcoal-500">
              프로필 비공개를 켜면 검색과 프로필 조회, 다른 사람의 오르빗에서 숨겨져요. 직접 공유한 예약 링크는 계속 동작해요.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={isPrivate}
            aria-labelledby="private-label"
            onClick={toggle}
            disabled={pending}
            data-testid="privateToggle"
            className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${
              isPrivate ? "bg-navy-500" : "bg-charcoal-700"
            }`}
          >
            <span
              className={`inline-block h-6 w-6 rounded-full bg-white shadow transition-transform ${
                isPrivate ? "translate-x-[22px]" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>

        <div>
          <p className="text-sm font-medium text-charcoal-100">차단 관리</p>
          {blocked.length === 0 ? (
            <p className="mt-1 text-xs text-charcoal-500" data-testid="blockedEmpty">차단한 사용자가 없어요</p>
          ) : (
            <ul className="mt-2 divide-y divide-charcoal-800/40 rounded-lg border border-charcoal-800/60" data-testid="blockedList">
              {blocked.map((u) => (
                <li key={u.username} className="flex items-center justify-between gap-3 px-3 py-2">
                  <Link href={`/${u.username}`} className="min-w-0">
                    <p className="truncate text-sm text-charcoal-100">{u.displayName || u.username}</p>
                    <p className="truncate text-xs text-charcoal-500">@{u.username}</p>
                  </Link>
                  <button
                    type="button"
                    onClick={() => unblock(u.username)}
                    disabled={pending}
                    className="shrink-0 rounded-lg border border-charcoal-700 px-3 py-1 text-xs text-charcoal-300 hover:text-charcoal-100 disabled:opacity-60 max-md:min-h-11"
                  >
                    해제
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {msg && <p role="alert" className="text-xs text-red-500">{msg}</p>}
      </div>
    </section>
  );
}
