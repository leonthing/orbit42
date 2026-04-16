"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminDeleteUser } from "@/lib/admin";

export function DeleteUserButton({
  userId,
  username,
}: {
  userId: string;
  username: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onClick = () => {
    if (
      !window.confirm(
        `@${username} 계정을 삭제할까요? 관련된 모든 데이터(슬롯/예약/메시지 등)가 함께 삭제됩니다. 복구 불가.`,
      )
    )
      return;
    start(async () => {
      const res = await adminDeleteUser(userId);
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="rounded px-2 py-1 text-xs text-charcoal-500 hover:bg-red-600/10 hover:text-red-400 disabled:opacity-50"
      >
        {pending ? "삭제 중…" : "삭제"}
      </button>
      {error && (
        <span className="ml-2 text-[11px] text-red-400">{error}</span>
      )}
    </>
  );
}
