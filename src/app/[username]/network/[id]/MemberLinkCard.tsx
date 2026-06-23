"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { useToast } from "@/components/Toast";
import type { LinkedMember } from "../actions";
import { matchContactByEmail, unlinkContactMember } from "../actions";
import { follow, unfollow } from "@/lib/follows";

export default function MemberLinkCard({
  contactId,
  member: initialMember,
  hasEmail,
  initialFollowing,
}: {
  contactId: string;
  member: LinkedMember | null;
  hasEmail: boolean;
  initialFollowing: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [member, setMember] = useState<LinkedMember | null>(initialMember);
  const [following, setFollowing] = useState(initialFollowing);
  const [busy, setBusy] = useState(false);

  async function handleFind() {
    setBusy(true);
    try {
      const { member: found } = await matchContactByEmail(contactId);
      if (found) {
        setMember(found);
        toast.success("orbit42 회원과 연결했습니다.");
        router.refresh();
      } else {
        toast.error("이 이메일과 일치하는 회원을 찾지 못했습니다.");
      }
    } catch {
      toast.error("회원 찾기에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function handleFollowToggle() {
    if (!member) return;
    setBusy(true);
    const prev = following;
    setFollowing(!prev); // optimistic
    try {
      const res = prev ? await unfollow(member.username) : await follow(member.username);
      if (res.error) {
        setFollowing(prev);
        toast.error(res.error);
      }
    } catch {
      setFollowing(prev);
      toast.error("요청에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function handleUnlink() {
    setBusy(true);
    try {
      await unlinkContactMember(contactId);
      setMember(null);
      router.refresh();
    } catch {
      toast.error("연결 해제에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  // No member and no email to match against → nothing to show.
  if (!member && !hasEmail) return null;

  if (!member) {
    return (
      <div className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/40 p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-charcoal-400">
            이 사람이 orbit42 회원인지 확인해보세요.
          </p>
          <button
            onClick={handleFind}
            disabled={busy}
            className="shrink-0 rounded-lg border border-charcoal-700 px-3 py-1.5 text-sm font-medium text-charcoal-200 hover:bg-charcoal-800 disabled:opacity-50"
          >
            {busy ? "확인 중..." : "orbit42에서 찾기"}
          </button>
        </div>
      </div>
    );
  }

  const memberName = member.display_name || member.username;

  return (
    <div className="rounded-xl border border-red-600/30 bg-red-600/[0.06] p-5">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-red-600/20 px-2 py-0.5 text-[11px] font-semibold text-red-400">
          <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
              clipRule="evenodd"
            />
          </svg>
          orbit42 회원
        </span>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <Avatar url={member.avatar_url} name={memberName} size={48} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-charcoal-100">{memberName}</p>
          <p className="truncate text-xs text-charcoal-500">@{member.username}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={`/${member.username}`}
          className="rounded-lg border border-charcoal-700 px-3 py-1.5 text-sm font-medium text-charcoal-200 hover:bg-charcoal-800"
        >
          프로필 보기
        </Link>
        <button
          onClick={handleFollowToggle}
          disabled={busy}
          className={
            following
              ? "rounded-lg border border-charcoal-700 px-3 py-1.5 text-sm font-medium text-charcoal-300 hover:bg-charcoal-800 disabled:opacity-50"
              : "rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
          }
        >
          {following ? "팔로잉" : "팔로우"}
        </button>
        <Link
          href={`/${member.username}/book`}
          className="rounded-lg border border-charcoal-700 px-3 py-1.5 text-sm font-medium text-charcoal-200 hover:bg-charcoal-800"
        >
          시간 예약
        </Link>
        <button
          onClick={handleUnlink}
          disabled={busy}
          className="ml-auto rounded-lg px-2 py-1.5 text-xs text-charcoal-500 hover:text-charcoal-300 disabled:opacity-50"
        >
          연결 해제
        </button>
      </div>
    </div>
  );
}
