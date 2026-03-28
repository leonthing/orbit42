"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Business, BusinessInput } from "../actions";
import { updateBusiness, deleteBusiness } from "../actions";
import type { Project } from "../project-actions";
import { deleteProject, syncProjectsFromLocal } from "../project-actions";

const STATUS_CONFIG = {
  active: { label: "운영 중", color: "bg-emerald-500/15 text-emerald-400", dot: "bg-emerald-400" },
  paused: { label: "일시중지", color: "bg-amber-500/15 text-amber-400", dot: "bg-amber-400" },
  closed: { label: "폐업", color: "bg-red-500/15 text-red-400", dot: "bg-red-400" },
} as const;

const PROJECT_STATUS: Record<string, { label: string; color: string }> = {
  active: { label: "활성", color: "text-emerald-400 bg-emerald-500/10" },
  maintenance: { label: "유지보수", color: "text-blue-400 bg-blue-500/10" },
  paused: { label: "중단", color: "text-amber-400 bg-amber-500/10" },
  archived: { label: "보관", color: "text-charcoal-400 bg-charcoal-500/10" },
};

type Tab = "overview" | "projects" | "notes";

export default function BusinessDetail({
  business: biz,
  projects: initialProjects,
  username,
}: {
  business: Business;
  projects: Project[];
  username: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("projects");
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [projects, setProjects] = useState(initialProjects);
  const [syncing, setSyncing] = useState(false);
  const [syncPath, setSyncPath] = useState("");
  const [showSyncForm, setShowSyncForm] = useState(false);

  const status = STATUS_CONFIG[biz.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.active;

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const input: BusinessInput = {
      name: fd.get("name") as string,
      description: (fd.get("description") as string) || undefined,
      status: (fd.get("status") as Business["status"]) || "active",
      industry: (fd.get("industry") as string) || undefined,
      url: (fd.get("url") as string) || undefined,
    };
    if (!input.name.trim()) { setError("사업체 이름을 입력하세요."); return; }

    startTransition(async () => {
      const result = await updateBusiness(biz.id, input);
      if ("error" in result && result.error) setError(result.error);
      else { setEditing(false); setError(null); router.refresh(); }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteBusiness(biz.id);
      if (result.success) { router.push(`/${username}/business`); router.refresh(); }
    });
  }

  async function handleSync() {
    if (!syncPath.trim()) return;
    setSyncing(true);
    try {
      // Scan local directory
      const res = await fetch("/api/scan-projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dirPath: syncPath }),
      });
      const { projects: scanned, error: scanError } = await res.json();
      if (scanError) { alert(scanError); setSyncing(false); return; }

      // Sync to DB
      const result = await syncProjectsFromLocal(biz.id, scanned);
      alert(`동기화 완료: ${result.created}개 추가, ${result.updated}개 업데이트`);
      setShowSyncForm(false);
      router.refresh();
    } catch {
      alert("동기화 실패");
    }
    setSyncing(false);
  }

  async function handleDeleteProject(id: string) {
    if (!confirm("프로젝트를 삭제하시겠습니까?")) return;
    await deleteProject(id);
    setProjects((prev) => prev.filter((p) => p.id !== id));
  }

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "overview", label: "개요" },
    { key: "projects", label: "프로젝트", count: projects.length },
    { key: "notes", label: "메모" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={`/${username}/business`}
          className="rounded-lg p-1.5 text-charcoal-500 hover:bg-charcoal-800/50 hover:text-charcoal-300"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-charcoal-100 sm:text-2xl">{biz.name}</h1>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${status.color}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
              {status.label}
            </span>
          </div>
          {biz.industry && <p className="mt-0.5 text-sm text-charcoal-500">{biz.industry}</p>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setEditing(!editing)} className="rounded-lg px-3 py-1.5 text-sm font-medium text-charcoal-400 hover:bg-charcoal-800/50 hover:text-charcoal-300">
            {editing ? "취소" : "수정"}
          </button>
          <button onClick={() => setShowDelete(true)} className="rounded-lg px-3 py-1.5 text-sm font-medium text-charcoal-500 hover:bg-red-500/10 hover:text-red-400">
            삭제
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-charcoal-800/60">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? "border-navy-500 text-navy-400"
                : "border-transparent text-charcoal-500 hover:text-charcoal-300"
            }`}
          >
            {t.label}
            {t.count !== undefined && (
              <span className="ml-1.5 rounded-full bg-charcoal-800 px-1.5 py-0.5 text-xs text-charcoal-400">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {tab === "overview" && (
        editing ? (
          <div className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/40 p-6">
            <h2 className="text-sm font-semibold text-charcoal-200">사업체 수정</h2>
            {error && <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}
            <form onSubmit={handleSave} className="mt-4 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-charcoal-400">이름 *</label>
                  <input name="name" defaultValue={biz.name} className="w-full rounded-lg border border-charcoal-700 bg-charcoal-800/50 px-3 py-2 text-sm text-charcoal-100 focus:border-navy-500 focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-charcoal-400">업종</label>
                  <input name="industry" defaultValue={biz.industry ?? ""} className="w-full rounded-lg border border-charcoal-700 bg-charcoal-800/50 px-3 py-2 text-sm text-charcoal-100 focus:border-navy-500 focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-charcoal-400">상태</label>
                  <select name="status" defaultValue={biz.status} className="w-full rounded-lg border border-charcoal-700 bg-charcoal-800/50 px-3 py-2 text-sm text-charcoal-100 focus:border-navy-500 focus:outline-none">
                    <option value="active">운영 중</option>
                    <option value="paused">일시중지</option>
                    <option value="closed">폐업</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-charcoal-400">웹사이트</label>
                  <input name="url" defaultValue={biz.url ?? ""} className="w-full rounded-lg border border-charcoal-700 bg-charcoal-800/50 px-3 py-2 text-sm text-charcoal-100 focus:border-navy-500 focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-charcoal-400">설명</label>
                <textarea name="description" defaultValue={biz.description ?? ""} rows={3} className="w-full rounded-lg border border-charcoal-700 bg-charcoal-800/50 px-3 py-2 text-sm text-charcoal-100 focus:border-navy-500 focus:outline-none" />
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => { setEditing(false); setError(null); }} className="rounded-lg px-4 py-2 text-sm font-medium text-charcoal-400 hover:bg-charcoal-800/50">취소</button>
                <button type="submit" disabled={isPending} className="rounded-lg bg-navy-600 px-4 py-2 text-sm font-medium text-white hover:bg-navy-500 disabled:opacity-50">{isPending ? "저장 중..." : "저장"}</button>
              </div>
            </form>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/40 p-5 lg:col-span-2">
              <h2 className="text-sm font-semibold text-charcoal-200">사업체 정보</h2>
              <div className="mt-4 space-y-4">
                {biz.description && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-charcoal-500">설명</p>
                    <p className="mt-1 text-sm text-charcoal-300">{biz.description}</p>
                  </div>
                )}
                {biz.url && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-charcoal-500">웹사이트</p>
                    <a href={biz.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-sm text-navy-400 hover:underline">{biz.url}</a>
                  </div>
                )}
                {!biz.description && !biz.url && <p className="text-sm text-charcoal-600">등록된 상세 정보가 없습니다.</p>}
              </div>
            </div>
            <div className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/40 p-5">
              <h2 className="text-sm font-semibold text-charcoal-200">요약</h2>
              <dl className="mt-4 space-y-3">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-charcoal-500">프로젝트</dt>
                  <dd className="mt-1 text-sm text-charcoal-300">{projects.length}개</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-charcoal-500">등록일</dt>
                  <dd className="mt-1 text-sm text-charcoal-300">{new Date(biz.created_at).toLocaleDateString("ko-KR")}</dd>
                </div>
              </dl>
            </div>
          </div>
        )
      )}

      {/* Projects Tab */}
      {tab === "projects" && (
        <div className="space-y-4">
          {/* Sync Button */}
          <div className="flex items-center gap-3">
            {!showSyncForm ? (
              <button
                onClick={() => setShowSyncForm(true)}
                className="rounded-lg bg-navy-600 px-4 py-2 text-sm font-medium text-white hover:bg-navy-500"
              >
                로컬 폴더 동기화
              </button>
            ) : (
              <div className="flex w-full items-center gap-3 rounded-xl border border-charcoal-800/60 bg-charcoal-900/40 p-4">
                <input
                  type="text"
                  value={syncPath}
                  onChange={(e) => setSyncPath(e.target.value)}
                  placeholder="폴더 경로 (예: /Users/leokim/work)"
                  className="flex-1 rounded-lg border border-charcoal-700 bg-charcoal-800/50 px-3 py-2 text-sm text-charcoal-100 placeholder:text-charcoal-600 focus:border-navy-500 focus:outline-none"
                />
                <button
                  onClick={handleSync}
                  disabled={syncing || !syncPath}
                  className="rounded-lg bg-navy-600 px-4 py-2 text-sm font-medium text-white hover:bg-navy-500 disabled:opacity-50"
                >
                  {syncing ? "스캔 중..." : "동기화"}
                </button>
                <button
                  onClick={() => { setShowSyncForm(false); setSyncPath(""); }}
                  className="rounded-lg px-3 py-2 text-sm text-charcoal-500 hover:text-charcoal-300"
                >
                  취소
                </button>
              </div>
            )}
          </div>

          {/* Project List */}
          {projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-charcoal-700 py-16">
              <svg className="h-10 w-10 text-charcoal-700" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
              </svg>
              <p className="mt-3 text-sm text-charcoal-500">연결된 프로젝트가 없습니다</p>
              <p className="mt-1 text-xs text-charcoal-600">로컬 폴더를 동기화해보세요</p>
            </div>
          ) : (
            <div className="space-y-2">
              {projects.map((p) => {
                const pStatus = PROJECT_STATUS[p.status] || PROJECT_STATUS.active;
                return (
                  <div
                    key={p.id}
                    className="group flex items-center gap-4 rounded-xl border border-charcoal-800/60 bg-charcoal-900/40 px-5 py-4 transition-colors hover:border-charcoal-700"
                  >
                    {/* Icon */}
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-charcoal-800">
                      {p.git_url ? (
                        <svg className="h-5 w-5 text-charcoal-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" />
                        </svg>
                      ) : (
                        <svg className="h-5 w-5 text-charcoal-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                        </svg>
                      )}
                    </div>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-medium text-charcoal-100">{p.name}</h3>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${pStatus.color}`}>
                          {pStatus.label}
                        </span>
                      </div>
                      {p.last_commit_msg && (
                        <p className="mt-0.5 truncate text-xs text-charcoal-500">{p.last_commit_msg}</p>
                      )}
                      <div className="mt-1 flex items-center gap-3 text-xs text-charcoal-600">
                        {p.local_path && <span className="truncate">{p.local_path}</span>}
                      </div>
                    </div>

                    {/* Activity */}
                    <div className="shrink-0 text-right">
                      {p.last_activity && (
                        <p className="text-xs text-charcoal-500">{p.last_activity}</p>
                      )}
                      {p.tech_stack && p.tech_stack.length > 0 && (
                        <div className="mt-1 flex gap-1">
                          {p.tech_stack.map((t) => (
                            <span key={t} className="rounded bg-charcoal-800 px-1.5 py-0.5 text-xs text-charcoal-400">{t}</span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <button
                      onClick={() => handleDeleteProject(p.id)}
                      className="shrink-0 rounded-lg p-1.5 text-charcoal-600 opacity-0 transition-opacity hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Notes Tab */}
      {tab === "notes" && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-charcoal-700 py-16">
          <svg className="h-10 w-10 text-charcoal-700" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
          </svg>
          <p className="mt-3 text-sm text-charcoal-500">메모가 없습니다</p>
          <p className="mt-1 text-xs text-charcoal-600">사업체 관련 메모를 추가해보세요</p>
        </div>
      )}

      {/* Delete Confirmation */}
      {showDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-xl border border-charcoal-800/60 bg-[rgb(var(--bg-base))] p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-charcoal-100">사업체 삭제</h3>
            <p className="mt-2 text-sm text-charcoal-400">
              <span className="font-medium text-charcoal-200">{biz.name}</span>을(를) 삭제하시겠습니까?
            </p>
            <div className="mt-5 flex items-center justify-end gap-3">
              <button onClick={() => setShowDelete(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-charcoal-400 hover:bg-charcoal-800/50">취소</button>
              <button onClick={handleDelete} disabled={isPending} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50">{isPending ? "삭제 중..." : "삭제"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
