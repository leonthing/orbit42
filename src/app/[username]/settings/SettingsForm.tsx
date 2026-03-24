"use client";

import { useState } from "react";
import { updateProfile, changePassword } from "@/lib/auth";

export function SettingsForm({
  username,
  displayName: initialDisplayName,
  createdAt,
}: {
  username: string;
  displayName: string;
  createdAt: string;
}) {
  // Profile state
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [profileMsg, setProfileMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // Password state
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwMsg, setPwMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [pwLoading, setPwLoading] = useState(false);

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileLoading(true);
    setProfileMsg(null);
    const result = await updateProfile(username, displayName);
    if (result.error) {
      setProfileMsg({ type: "error", text: result.error });
    } else {
      setProfileMsg({ type: "success", text: "프로필이 업데이트되었습니다." });
    }
    setProfileLoading(false);
  };

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
    <div className="max-w-xl space-y-8">
      {/* Profile Section */}
      <section className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/40">
        <div className="border-b border-charcoal-800/40 px-5 py-3">
          <h2 className="text-sm font-semibold text-charcoal-200">프로필</h2>
        </div>
        <form onSubmit={handleProfileSave} className="space-y-4 p-5">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-charcoal-400">
              Username
            </label>
            <div className="flex items-center rounded-lg border border-charcoal-800 bg-charcoal-800/30 px-4 py-2.5 text-sm text-charcoal-500">
              {username}
            </div>
            <p className="mt-1 text-xs text-charcoal-600">
              orbit42.org/{username}
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-charcoal-400">
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-lg border border-charcoal-700 bg-charcoal-800/50 px-4 py-2.5 text-sm text-charcoal-100 focus:border-navy-500 focus:outline-none focus:ring-1 focus:ring-navy-500/50"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-charcoal-400">
              가입일
            </label>
            <div className="text-sm text-charcoal-400">
              {new Date(createdAt).toLocaleDateString("ko-KR", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </div>
          </div>

          {profileMsg && (
            <p className={`text-sm ${profileMsg.type === "success" ? "text-emerald-400" : "text-red-400"}`}>
              {profileMsg.text}
            </p>
          )}

          <button
            type="submit"
            disabled={profileLoading || displayName === initialDisplayName}
            className="rounded-lg bg-navy-600 px-4 py-2 text-sm font-medium text-white hover:bg-navy-500 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {profileLoading ? "저장 중..." : "저장"}
          </button>
        </form>
      </section>

      {/* Password Section */}
      <section className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/40">
        <div className="border-b border-charcoal-800/40 px-5 py-3">
          <h2 className="text-sm font-semibold text-charcoal-200">비밀번호 변경</h2>
        </div>
        <form onSubmit={handlePasswordChange} className="space-y-4 p-5">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-charcoal-400">
              현재 비밀번호
            </label>
            <input
              type="password"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              className="w-full rounded-lg border border-charcoal-700 bg-charcoal-800/50 px-4 py-2.5 text-sm text-charcoal-100 focus:border-navy-500 focus:outline-none focus:ring-1 focus:ring-navy-500/50"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-charcoal-400">
              새 비밀번호
            </label>
            <input
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              placeholder="6자 이상"
              className="w-full rounded-lg border border-charcoal-700 bg-charcoal-800/50 px-4 py-2.5 text-sm text-charcoal-100 placeholder:text-charcoal-600 focus:border-navy-500 focus:outline-none focus:ring-1 focus:ring-navy-500/50"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-charcoal-400">
              새 비밀번호 확인
            </label>
            <input
              type="password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              className="w-full rounded-lg border border-charcoal-700 bg-charcoal-800/50 px-4 py-2.5 text-sm text-charcoal-100 focus:border-navy-500 focus:outline-none focus:ring-1 focus:ring-navy-500/50"
            />
          </div>

          {pwMsg && (
            <p className={`text-sm ${pwMsg.type === "success" ? "text-emerald-400" : "text-red-400"}`}>
              {pwMsg.text}
            </p>
          )}

          <button
            type="submit"
            disabled={pwLoading || !currentPw || !newPw || !confirmPw}
            className="rounded-lg bg-navy-600 px-4 py-2 text-sm font-medium text-white hover:bg-navy-500 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {pwLoading ? "변경 중..." : "비밀번호 변경"}
          </button>
        </form>
      </section>
    </div>
  );
}
