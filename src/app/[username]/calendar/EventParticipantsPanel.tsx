"use client";

import { useCallback, useEffect, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { useToast } from "@/components/Toast";
import { toEventKey } from "@/lib/event-key";
import {
  addEventParticipant,
  listEventParticipants,
  removeEventParticipant,
  searchPeopleToInvite,
  type ParticipantView,
  type PersonSuggestion,
} from "./actions";

/**
 * 일정 참석자 — iOS 참석자 추가 시트와 같은 계약(가입자는 태그, 비가입자는
 * 이메일 초대)을 웹에서 그대로 쓴다. 어느 쪽이든 메일이 나간다.
 *
 * 저장된 일정은 고르는 즉시 서버에 붙이고(EventParticipantsPanel), 아직 저장
 * 전인 새 일정은 목록에만 담아 뒀다가(PendingParticipantsPanel) 일정이
 * 만들어진 뒤 한꺼번에 초대한다.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** event_key 가 없어 아직 서버에 붙이지 못한 참석자. */
export type PendingParticipant =
  | {
      kind: "user";
      username: string;
      displayName: string | null;
      avatarUrl: string | null;
    }
  | { kind: "email"; email: string };

export function pendingKey(p: PendingParticipant): string {
  return p.kind === "user" ? `user:${p.username}` : `email:${p.email}`;
}

function pendingLabel(p: PendingParticipant): string {
  if (p.kind === "email") return p.email;
  return p.displayName || `@${p.username}`;
}

function pendingDetail(p: PendingParticipant): string {
  return p.kind === "email" ? "메일로 초대" : `@${p.username}`;
}

const STATUS_LABEL: Record<string, { text: string; className: string }> = {
  invited: { text: "대기", className: "text-charcoal-500" },
  accepted: { text: "수락", className: "text-green-400" },
  declined: { text: "거절", className: "text-charcoal-600" },
};

const shellClass = "mt-4 space-y-2 border-t border-charcoal-800/50 pt-4";

/** 고른 대상 — 담아 두는 쪽은 표시용 이름·아바타까지 함께 받는다. */
type PickTarget = {
  username?: string;
  email?: string;
  displayName?: string | null;
  avatarUrl?: string | null;
};

/** 사람 검색 + 이메일 초대 입력 — 두 패널이 공유한다. */
function ParticipantPicker({
  busyKey,
  onPick,
}: {
  busyKey: string | null;
  onPick: (target: PickTarget) => void;
}) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<PersonSuggestion[]>([]);

  const trimmed = query.trim();
  const isEmail = EMAIL_RE.test(trimmed);

  // 300ms 디바운스 — 이메일을 타이핑하는 중에는 사람 검색을 하지 않는다.
  useEffect(() => {
    if (!trimmed || isEmail) {
      setSuggestions([]);
      return;
    }
    let alive = true;
    const timer = setTimeout(() => {
      searchPeopleToInvite(trimmed)
        .then((rows) => {
          if (alive) setSuggestions(rows);
        })
        .catch(() => {});
    }, 300);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [trimmed, isEmail]);

  const pick = (target: PickTarget) => {
    onPick(target);
    setQuery("");
    setSuggestions([]);
  };

  return (
    <>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          // 일정 폼 안에서도 쓰이므로 Enter 가 폼을 제출하면 안 된다.
          e.preventDefault();
          if (isEmail && !busyKey) pick({ email: trimmed });
        }}
        placeholder="이름, @핸들 또는 이메일"
        className="w-full rounded-lg border border-charcoal-800/60 bg-transparent px-2.5 py-1.5 text-xs text-charcoal-100 placeholder-charcoal-600 focus:border-charcoal-700 focus:outline-none"
      />

      {isEmail && (
        <button
          type="button"
          onClick={() => pick({ email: trimmed })}
          disabled={!!busyKey}
          className="flex w-full items-center gap-2 rounded-lg border border-navy-500/40 px-2.5 py-1.5 text-left text-xs text-navy-400 hover:bg-navy-500/10 disabled:opacity-50"
        >
          <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
          </svg>
          <span className="truncate">
            {busyKey === trimmed ? "보내는 중…" : `${trimmed} 이메일로 초대`}
          </span>
        </button>
      )}

      {suggestions.length > 0 && (
        <ul className="space-y-1">
          {suggestions.map((s) => (
            <li key={s.username}>
              <button
                type="button"
                onClick={() =>
                  pick({
                    username: s.username,
                    displayName: s.displayName,
                    avatarUrl: s.avatarUrl,
                  })
                }
                disabled={!!busyKey}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-charcoal-800/60 disabled:opacity-50"
              >
                <Avatar
                  url={s.avatarUrl}
                  name={s.displayName || s.username}
                  size={22}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-charcoal-200">
                    {s.displayName || s.username}
                  </p>
                  <p className="truncate text-2xs text-navy-400">
                    @{s.username}
                  </p>
                </div>
                <span className="shrink-0 text-2xs text-charcoal-500">
                  {busyKey === s.username ? "초대 중…" : "+ 초대"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function RemoveButton({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={`${label} 참석자에서 빼기`}
      className="shrink-0 rounded p-1 text-charcoal-600 hover:bg-charcoal-800/60 hover:text-charcoal-300 disabled:opacity-50"
    >
      <svg
        className="h-3 w-3"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
      </svg>
    </button>
  );
}

/** 저장된 일정 — 고르는 즉시 서버에 붙는다. */
export function EventParticipantsPanel({
  eventId,
  title,
  startAt,
  endAt,
  allDay,
}: {
  eventId: string;
  title: string;
  startAt: string;
  endAt: string | null;
  allDay: boolean;
}) {
  const toast = useToast();
  const key = toEventKey(eventId);
  const [participants, setParticipants] = useState<ParticipantView[]>([]);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    listEventParticipants(key)
      .then((rows) => {
        if (alive) setParticipants(rows);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [key]);

  const invite = useCallback(
    async (target: PickTarget) => {
      setBusyKey(target.username ?? target.email ?? "");
      try {
        const res = await addEventParticipant(
          key,
          { title, startAt, endAt, allDay },
          { username: target.username, email: target.email },
        );
        if ("error" in res) {
          toast.error(res.error);
          return;
        }
        setParticipants(res.participants);
        toast.success(target.email ? "초대 메일을 보냈어요" : "초대했어요");
      } finally {
        setBusyKey(null);
      }
    },
    [key, title, startAt, endAt, allDay, toast],
  );

  const remove = useCallback(
    async (rowId: string) => {
      setBusyKey(rowId);
      try {
        const res = await removeEventParticipant(key, rowId);
        if ("error" in res) {
          toast.error(res.error);
          return;
        }
        setParticipants(res.participants);
      } finally {
        setBusyKey(null);
      }
    },
    [key, toast],
  );

  return (
    <div className={shellClass}>
      <p className="text-2xs font-medium text-charcoal-500">
        참석자{participants.length > 0 ? ` ${participants.length}` : ""}
      </p>

      {participants.length > 0 && (
        <ul className="space-y-1">
          {participants.map((p) => {
            const label = p.displayName || p.username || p.email || "참석자";
            const status = STATUS_LABEL[p.status] ?? STATUS_LABEL.invited;
            return (
              <li
                key={p.id}
                className="flex items-center gap-2 rounded-lg border border-charcoal-800/60 px-2 py-1.5"
              >
                <Avatar url={p.avatarUrl} name={label} size={22} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-charcoal-200">{label}</p>
                  <p className="truncate text-2xs text-charcoal-600">
                    {p.username ? `@${p.username}` : p.email}
                  </p>
                </div>
                <span className={`shrink-0 text-2xs ${status.className}`}>
                  {status.text}
                </span>
                <RemoveButton
                  label={label}
                  disabled={busyKey === p.id}
                  onClick={() => remove(p.id)}
                />
              </li>
            );
          })}
        </ul>
      )}

      <ParticipantPicker busyKey={busyKey} onPick={invite} />

      <p className="text-2xs text-charcoal-600">
        가입자는 알림과 메일로, 비가입자는 초대 메일로 알려드려요.
      </p>
    </div>
  );
}

/** 저장 전 새 일정 — 담아 뒀다가 저장 직후 한꺼번에 초대한다. */
export function PendingParticipantsPanel({
  pending,
  onChange,
}: {
  pending: PendingParticipant[];
  onChange: (next: PendingParticipant[]) => void;
}) {
  const toast = useToast();

  const add = (target: PickTarget) => {
    const next: PendingParticipant = target.username
      ? {
          kind: "user",
          username: target.username,
          displayName: target.displayName ?? null,
          avatarUrl: target.avatarUrl ?? null,
        }
      : { kind: "email", email: target.email ?? "" };
    if (pending.some((p) => pendingKey(p) === pendingKey(next))) {
      toast.error("이미 담은 사람이에요.");
      return;
    }
    onChange([...pending, next]);
  };

  return (
    <div className={shellClass}>
      <p className="text-2xs font-medium text-charcoal-500">
        참석자{pending.length > 0 ? ` ${pending.length}` : ""}
      </p>

      {pending.length > 0 && (
        <ul className="space-y-1">
          {pending.map((p) => {
            const label = pendingLabel(p);
            return (
              <li
                key={pendingKey(p)}
                className="flex items-center gap-2 rounded-lg border border-charcoal-800/60 px-2 py-1.5"
              >
                <Avatar
                  url={p.kind === "user" ? p.avatarUrl : null}
                  name={label}
                  size={22}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-charcoal-200">{label}</p>
                  <p className="truncate text-2xs text-charcoal-600">
                    {pendingDetail(p)}
                  </p>
                </div>
                <RemoveButton
                  label={label}
                  onClick={() =>
                    onChange(
                      pending.filter((x) => pendingKey(x) !== pendingKey(p)),
                    )
                  }
                />
              </li>
            );
          })}
        </ul>
      )}

      <ParticipantPicker busyKey={null} onPick={add} />

      <p className="text-2xs text-charcoal-600">
        {pending.length > 0
          ? `일정을 저장하면 ${pending.length}명에게 초대가 나가요.`
          : "orbit42 사용자를 태그하거나 이메일로 초대할 수 있어요."}
      </p>
    </div>
  );
}
