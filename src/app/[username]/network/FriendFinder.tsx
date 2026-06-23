"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { useToast } from "@/components/Toast";
import type { ContactMatch } from "./actions";
import { findMembersFromContacts } from "./actions";
import { follow, unfollow } from "@/lib/follows";

/**
 * "연락처로 친구 찾기" — matches the user's Google contacts against orbit42
 * members without ever storing the address book. Shows matches to follow.
 */
export default function FriendFinder({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scanned, setScanned] = useState(0);
  const [matches, setMatches] = useState<ContactMatch[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await findMembersFromContacts();
        if (cancelled) return;
        if (res.error) setError(res.error);
        setScanned(res.scanned);
        setMatches(res.matches);
      } catch {
        if (!cancelled) setError("failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggleFollow(m: ContactMatch) {
    const u = m.member.username;
    setBusy(u);
    const prev = m.isFollowing;
    setMatches((list) =>
      list.map((x) =>
        x.member.id === m.member.id ? { ...x, isFollowing: !prev } : x,
      ),
    );
    try {
      const res = prev ? await unfollow(u) : await follow(u);
      if (res.error) {
        setMatches((list) =>
          list.map((x) =>
            x.member.id === m.member.id ? { ...x, isFollowing: prev } : x,
          ),
        );
        toast.error(res.error);
      }
    } catch {
      setMatches((list) =>
        list.map((x) =>
          x.member.id === m.member.id ? { ...x, isFollowing: prev } : x,
        ),
      );
      toast.error("요청에 실패했습니다.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-charcoal-800/60 bg-[rgb(var(--bg-base))]">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-charcoal-800/50 p-5">
          <div>
            <h2 className="text-lg font-semibold text-charcoal-100">
              연락처로 친구 찾기
            </h2>
            <p className="mt-1 text-xs text-charcoal-500">
              내 Google 연락처 중 orbit42에 있는 사람을 찾아드려요.
              주소록은 저장하지 않아요.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="shrink-0 rounded-lg p-1.5 text-charcoal-500 hover:bg-charcoal-800/60 hover:text-charcoal-200"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
              <span className="h-7 w-7 animate-spin rounded-full border-2 border-charcoal-700 border-t-red-500" />
              <p className="text-sm text-charcoal-400">연락처를 확인하는 중…</p>
              <p className="text-xs text-charcoal-600">
                연락처가 많으면 잠시 걸릴 수 있어요.
              </p>
            </div>
          ) : error === "google_not_connected" ? (
            <div className="py-12 text-center">
              <p className="text-sm font-medium text-charcoal-200">
                Google 연결이 필요해요
              </p>
              <p className="mt-1.5 text-xs text-charcoal-500">
                연락처를 읽으려면 Google 계정을 연결해주세요.
              </p>
              <a
                href="/api/google?return=network"
                className="mt-4 inline-block rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500"
              >
                Google 연결하기
              </a>
            </div>
          ) : error ? (
            <p className="py-12 text-center text-sm text-charcoal-500">
              연락처를 불러오지 못했어요. 잠시 후 다시 시도해주세요.
            </p>
          ) : matches.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm font-medium text-charcoal-200">
                아직 일치하는 회원이 없어요
              </p>
              <p className="mt-1.5 text-xs text-charcoal-500">
                연락처 {scanned.toLocaleString("ko-KR")}개를 확인했어요.
                지인이 가입하면 여기에 나타나요.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {matches.map((m) => (
                <li
                  key={m.member.id}
                  className="flex items-center gap-3 rounded-xl border border-charcoal-800/60 bg-charcoal-900/40 p-3"
                >
                  <Link href={`/${m.member.username}`} className="shrink-0">
                    <Avatar
                      url={m.member.avatar_url}
                      name={m.member.display_name || m.member.username}
                      size={40}
                    />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/${m.member.username}`}
                      className="block truncate text-sm font-medium text-charcoal-100 hover:text-red-400"
                    >
                      {m.member.display_name || m.member.username}
                    </Link>
                    <p className="truncate text-xs text-charcoal-500">
                      @{m.member.username}
                      {m.contactName ? ` · 내 연락처: ${m.contactName}` : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => toggleFollow(m)}
                    disabled={busy === m.member.username}
                    className={
                      m.isFollowing
                        ? "shrink-0 rounded-lg border border-charcoal-700 px-3 py-1.5 text-xs font-medium text-charcoal-300 hover:bg-charcoal-800 disabled:opacity-50"
                        : "shrink-0 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-500 disabled:opacity-50"
                    }
                  >
                    {m.isFollowing ? "팔로잉" : "팔로우"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        {!loading && !error && matches.length > 0 && (
          <div className="border-t border-charcoal-800/50 px-5 py-3 text-center text-[11px] text-charcoal-600">
            연락처 {scanned.toLocaleString("ko-KR")}개 중 {matches.length}명을
            찾았어요 · 주소록은 저장되지 않았어요
          </div>
        )}
      </div>
    </div>
  );
}
