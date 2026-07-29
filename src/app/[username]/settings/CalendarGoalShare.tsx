"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateCalendar } from "@/lib/calendars";
import { useToast } from "@/components/Toast";
import type { Calendar } from "@/lib/calendars-types";

/**
 * 캘린더의 "목표"와 "함께 쓰기(공유)" — iOS 캘린더 편집 시트와 같은 구성.
 * 목표를 정하면 그 캘린더에 쌓이는 시간이 달성률로 계산되고(시간 자산 페이지),
 * 초대한 사람은 같은 캘린더에 일정을 함께 기록할 수 있다.
 */
export function CalendarGoalShare({ calendar }: { calendar: Calendar }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-charcoal-800/50 bg-charcoal-900/20">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-left"
      >
        <span className="text-xs font-medium text-charcoal-300">
          목표 · 함께 쓰기
          {calendar.goal_title && (
            <span className="ml-2 rounded-full bg-navy-500/15 px-2 py-0.5 text-2xs font-semibold text-navy-400">
              {calendar.goal_title}
            </span>
          )}
        </span>
        <span className="text-xs text-charcoal-600">{open ? "접기" : "펼치기"}</span>
      </button>
      {open && (
        <div className="space-y-4 border-t border-charcoal-800/50 px-3 py-3">
          <GoalForm calendar={calendar} />
          {calendar.source === "native" && <ShareBox calendar={calendar} />}
        </div>
      )}
    </div>
  );
}

// MARK: - 목표

function GoalForm({ calendar }: { calendar: Calendar }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState(calendar.goal_title ?? "");
  const [targetHours, setTargetHours] = useState(
    calendar.goal_target_hours != null ? String(calendar.goal_target_hours) : "",
  );
  const [deadline, setDeadline] = useState(calendar.goal_deadline ?? "");

  const save = () => {
    const trimmed = title.trim();
    const hours = Number(targetHours);
    startTransition(async () => {
      await updateCalendar(calendar.id, {
        goal_title: trimmed || null,
        goal_target_hours: Number.isFinite(hours) && hours > 0 ? hours : null,
        goal_deadline: deadline || null,
        // 목표를 새로 붙이면 그 시점부터 집계, 해제하면 시작점도 비운다.
        goal_started_at: trimmed
          ? (calendar.goal_started_at ?? new Date().toISOString())
          : null,
      });
      toast.success(trimmed ? "목표를 저장했어요" : "목표를 해제했어요");
      router.refresh();
    });
  };

  return (
    <div className="space-y-2">
      <p className="text-2xs text-charcoal-500">
        목표를 정하면 이 캘린더에 쌓이는 시간이 달성률로 계산돼요. 학습·사이드
        프로젝트·운동 캘린더에 좋아요.
      </p>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="목표 (예: 토익 900점, 앱 출시)"
        className="w-full rounded-lg border border-charcoal-800/60 bg-charcoal-900/40 px-3 py-2 text-sm text-charcoal-100 placeholder:text-charcoal-600 focus:border-navy-500/60 focus:outline-none"
      />
      {title.trim() && (
        <div className="flex gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-charcoal-800/60 bg-charcoal-900/40 px-3 py-2">
            <input
              value={targetHours}
              onChange={(e) => setTargetHours(e.target.value.replace(/[^\d.]/g, ""))}
              placeholder="목표 시간"
              inputMode="numeric"
              className="w-full bg-transparent text-sm text-charcoal-100 placeholder:text-charcoal-600 focus:outline-none"
            />
            <span className="text-xs text-charcoal-500">시간</span>
          </div>
          <input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="rounded-lg border border-charcoal-800/60 bg-charcoal-900/40 px-3 py-2 text-sm text-charcoal-100 focus:border-navy-500/60 focus:outline-none"
          />
        </div>
      )}
      <button
        type="button"
        onClick={save}
        disabled={pending}
        className="rounded-lg bg-navy-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-400 disabled:opacity-50"
      >
        {pending ? "저장 중…" : "목표 저장"}
      </button>
    </div>
  );
}

// MARK: - 함께 쓰기

type Member = {
  id: string;
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: string;
  isOwner: boolean;
};

function ShareBox({ calendar }: { calendar: Calendar }) {
  const toast = useToast();
  const [members, setMembers] = useState<Member[] | null>(null);
  const [username, setUsername] = useState("");
  const [role, setRole] = useState("editor");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/api/v1/calendars/${calendar.id}/members`)
      .then((r) => (r.ok ? r.json() : { members: [] }))
      .then((d) => alive && setMembers(d.members ?? []))
      .catch(() => alive && setMembers([]));
    return () => {
      alive = false;
    };
  }, [calendar.id]);

  const invite = async () => {
    const handle = username.trim().replace(/^@/, "");
    if (!handle) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/calendars/${calendar.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: handle, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "초대하지 못했어요.");
        return;
      }
      setMembers(data.members ?? []);
      setUsername("");
      toast.success("함께 쓰기에 초대했어요");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (member: Member) => {
    const res = await fetch(
      `/api/v1/calendars/${calendar.id}/members?userId=${member.userId}`,
      { method: "DELETE" },
    );
    if (res.ok) {
      const data = await res.json();
      setMembers(data.members ?? []);
    }
  };

  return (
    <div className="space-y-2 border-t border-charcoal-800/40 pt-3">
      <p className="text-2xs text-charcoal-500">
        초대한 사람도 이 캘린더에 일정을 기록할 수 있어요. 가족 일정, 커플 기록,
        팀 프로젝트에 좋아요.
      </p>
      {members && members.length > 0 && (
        <ul className="space-y-1">
          {members.map((member) => (
            <li
              key={member.id}
              className="flex items-center gap-2 rounded-lg bg-charcoal-900/40 px-2.5 py-1.5"
            >
              <span className="text-xs text-charcoal-200">
                {member.displayName || member.username}
              </span>
              <span className="text-2xs text-charcoal-600">
                @{member.username}
              </span>
              <span className="ml-auto text-2xs text-charcoal-500">
                {member.isOwner
                  ? "소유자"
                  : member.role === "editor"
                    ? "함께 기록"
                    : "보기만"}
              </span>
              {!member.isOwner && (
                <button
                  type="button"
                  onClick={() => remove(member)}
                  className="text-2xs text-charcoal-600 hover:text-red-400"
                >
                  내보내기
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="@핸들로 초대"
          className="flex-1 rounded-lg border border-charcoal-800/60 bg-charcoal-900/40 px-3 py-2 text-sm text-charcoal-100 placeholder:text-charcoal-600 focus:border-navy-500/60 focus:outline-none"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="rounded-lg border border-charcoal-800/60 bg-charcoal-900/40 px-2 text-xs text-charcoal-200 focus:outline-none"
        >
          <option value="editor">함께 기록</option>
          <option value="viewer">보기만</option>
        </select>
        <button
          type="button"
          onClick={invite}
          disabled={busy || !username.trim()}
          className="rounded-lg bg-navy-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-400 disabled:opacity-50"
        >
          초대
        </button>
      </div>
    </div>
  );
}
