"use client";

import { useState } from "react";
import { changePassword } from "@/lib/auth";
import { buttonClasses } from "@/components/PendingButton";

const inputClass =
  "w-full rounded-lg border border-charcoal-800/60 bg-charcoal-900/40 px-3 py-2 text-sm text-charcoal-100 placeholder:text-charcoal-600 focus:border-navy-400/60 focus:outline-none focus:ring-1 focus:ring-navy-400/40";

/**
 * 비밀번호 변경 — 계정 보안 영역.
 *
 * 원래 SettingsForm 안에 프로필 블록들과 섞여 있었는데, 그 탓에 소개·학력 같은
 * 프로필 정보가 "계정" 섹션에 들어가 있었다. 프로필과 계정을 갈라 놓으려고
 * 이 블록만 떼어냈다.
 */
export function PasswordForm({ username }: { username: string }) {
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwMsg, setPwMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [pwLoading, setPwLoading] = useState(false);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg(null);
    if (newPw !== confirmPw) {
      setPwMsg({ type: "error", text: "새 비밀번호가 일치하지 않습니다." });
      return;
    }
    setPwLoading(true);
    const result = await changePassword(username, currentPw, newPw);
    if (result.error) {
      setPwMsg({ type: "error", text: result.error });
    } else {
      setPwMsg({ type: "success", text: "비밀번호가 변경되었습니다." });
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    }
    setPwLoading(false);
  };

  return (
    <section className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/40">
      <div className="border-b border-charcoal-800/40 px-5 py-3">
        <h2 className="text-sm font-semibold text-charcoal-200">비밀번호 변경</h2>
      </div>
      <form onSubmit={handlePasswordChange} className="space-y-4 p-5">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-charcoal-400">현재 비밀번호</label>
          <input type="password" autoComplete="current-password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-charcoal-400">새 비밀번호</label>
          <input type="password" autoComplete="new-password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="6자 이상" className={inputClass} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-charcoal-400">새 비밀번호 확인</label>
          <input type="password" autoComplete="new-password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} className={inputClass} />
        </div>

        {pwMsg && (
          <p className={`text-sm ${pwMsg.type === "success" ? "text-emerald-400" : "text-navy-400"}`}>
            {pwMsg.text}
          </p>
        )}

        <button
          type="submit"
          disabled={pwLoading || !currentPw || !newPw || !confirmPw}
          className={buttonClasses({ variant: "primary", size: "md" })}
        >
          {pwLoading ? "변경 중..." : "비밀번호 변경"}
        </button>
      </form>
    </section>
  );
}
