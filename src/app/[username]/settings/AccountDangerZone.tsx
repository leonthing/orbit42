"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteMyAccount, resendVerificationEmail } from "@/lib/account";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmDialog";

export function VerifyEmailBanner({
  email,
}: {
  email: string | null;
}) {
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  const resend = () =>
    startTransition(async () => {
      const res = await resendVerificationEmail();
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setSent(true);
      toast.success("확인 메일을 다시 보냈어요.");
    });

  return (
    <div className="rounded-xl border border-amber-600/40 bg-amber-500/10 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
            이메일 확인이 필요해요
          </p>
          <p className="mt-0.5 text-xs text-amber-800/80 dark:text-amber-200/80">
            {email ? (
              <>
                <span className="font-medium">{email}</span>로 보낸 확인 메일의
                링크를 눌러주세요.
              </>
            ) : (
              "Settings에서 이메일을 먼저 등록해주세요."
            )}
          </p>
        </div>
        {email && (
          <button
            type="button"
            onClick={resend}
            disabled={pending || sent}
            className="shrink-0 rounded-md border border-amber-600/60 bg-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-500/30 disabled:opacity-50 dark:text-amber-100"
          >
            {sent ? "전송됨" : pending ? "보내는 중…" : "확인 메일 다시 보내기"}
          </button>
        )}
      </div>
    </div>
  );
}

export function DeleteAccountSection({ username }: { username: string }) {
  const router = useRouter();
  const [confirmText, setConfirmText] = useState("");
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const confirm = useConfirm();

  const remove = async () => {
    if (confirmText !== username) {
      toast.error(`정확히 "${username}"을 입력해주세요.`);
      return;
    }
    const ok = await confirm({
      title: "정말 탈퇴할까요?",
      body: "모든 슬롯, 예약, 게시글, 캘린더가 즉시 삭제되며 복구할 수 없어요.",
      confirmLabel: "탈퇴",
      danger: true,
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await deleteMyAccount();
      if (res.error) {
        toast.error(res.error);
        return;
      }
      router.push("/");
    });
  };

  return (
    <section className="rounded-xl border border-red-600/40 bg-red-500/5">
      <div className="border-b border-red-600/30 px-5 py-3">
        <h2 className="text-sm font-semibold text-red-700 dark:text-red-300">
          계정 삭제
        </h2>
      </div>
      <div className="space-y-3 p-5">
        <p className="text-sm text-charcoal-500">
          계정을 삭제하면 프로필, 슬롯, 예약, 캘린더, 게시글이 모두 제거돼요.
          이 작업은 되돌릴 수 없어요.
        </p>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-charcoal-400">
            확인을 위해 사용자명{" "}
            <span className="font-semibold text-charcoal-200">{username}</span>을
            입력해주세요
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={username}
            className="w-full rounded-md border border-charcoal-700 bg-charcoal-900/60 px-3 py-2 text-sm text-charcoal-100 placeholder:text-charcoal-600 focus:border-navy-400 focus:outline-none focus:ring-1 focus:ring-navy-400/40"
          />
        </div>
        <button
          type="button"
          onClick={remove}
          disabled={pending || confirmText !== username}
          className="rounded-md bg-navy-500 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-400 disabled:cursor-not-allowed disabled:bg-charcoal-800 disabled:text-charcoal-500"
        >
          {pending ? "처리 중…" : "탈퇴하기"}
        </button>
      </div>
    </section>
  );
}
