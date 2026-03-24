"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import type { Business, BusinessInput } from "./actions";
import { createBusiness, updateBusiness, deleteBusiness } from "./actions";

const STATUS_CONFIG = {
  active: { label: "운영 중", color: "bg-emerald-500/15 text-emerald-400" },
  paused: { label: "일시중지", color: "bg-amber-500/15 text-amber-400" },
  closed: { label: "폐업", color: "bg-red-500/15 text-red-400" },
} as const;

function StatusBadge({ status }: { status: Business["status"] }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

function BusinessForm({
  initial,
  onClose,
  onSaved,
}: {
  initial?: Business;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const input: BusinessInput = {
      name: fd.get("name") as string,
      description: (fd.get("description") as string) || undefined,
      status: (fd.get("status") as Business["status"]) || "active",
      industry: (fd.get("industry") as string) || undefined,
      url: (fd.get("url") as string) || undefined,
    };

    if (!input.name.trim()) {
      setError("사업체 이름을 입력하세요.");
      return;
    }

    startTransition(async () => {
      const result = initial
        ? await updateBusiness(initial.id, input)
        : await createBusiness(input);

      if ("error" in result && result.error) {
        setError(result.error);
      } else {
        onSaved();
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-lg rounded-xl border border-charcoal-800/60 bg-[#0a0a0f] p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-charcoal-100">
          {initial ? "사업체 수정" : "새 사업체"}
        </h2>

        {error && (
          <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-charcoal-400">
              이름 <span className="text-red-400">*</span>
            </label>
            <input
              name="name"
              defaultValue={initial?.name ?? ""}
              placeholder="사업체 이름"
              className="w-full rounded-lg border border-charcoal-700 bg-charcoal-800/50 px-3 py-2 text-sm text-charcoal-100 placeholder:text-charcoal-600 focus:border-navy-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-charcoal-400">
              업종
            </label>
            <input
              name="industry"
              defaultValue={initial?.industry ?? ""}
              placeholder="예: IT, 요식업, 제조업"
              className="w-full rounded-lg border border-charcoal-700 bg-charcoal-800/50 px-3 py-2 text-sm text-charcoal-100 placeholder:text-charcoal-600 focus:border-navy-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-charcoal-400">
              상태
            </label>
            <select
              name="status"
              defaultValue={initial?.status ?? "active"}
              className="w-full rounded-lg border border-charcoal-700 bg-charcoal-800/50 px-3 py-2 text-sm text-charcoal-100 focus:border-navy-500 focus:outline-none"
            >
              <option value="active">운영 중</option>
              <option value="paused">일시중지</option>
              <option value="closed">폐업</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-charcoal-400">
              웹사이트
            </label>
            <input
              name="url"
              defaultValue={initial?.url ?? ""}
              placeholder="https://"
              className="w-full rounded-lg border border-charcoal-700 bg-charcoal-800/50 px-3 py-2 text-sm text-charcoal-100 placeholder:text-charcoal-600 focus:border-navy-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-charcoal-400">
              설명
            </label>
            <textarea
              name="description"
              defaultValue={initial?.description ?? ""}
              rows={3}
              placeholder="사업체에 대한 간단한 설명"
              className="w-full rounded-lg border border-charcoal-700 bg-charcoal-800/50 px-3 py-2 text-sm text-charcoal-100 placeholder:text-charcoal-600 focus:border-navy-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-charcoal-400 hover:bg-charcoal-800/50 hover:text-charcoal-300"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-navy-600 px-4 py-2 text-sm font-medium text-white hover:bg-navy-500 disabled:opacity-50"
            >
              {isPending ? "저장 중..." : initial ? "수정" : "생성"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteConfirm({
  name,
  onCancel,
  onConfirm,
  isPending,
}: {
  name: string;
  onCancel: () => void;
  onConfirm: () => void;
  isPending: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-sm rounded-xl border border-charcoal-800/60 bg-[#0a0a0f] p-6 shadow-2xl">
        <h3 className="text-lg font-semibold text-charcoal-100">사업체 삭제</h3>
        <p className="mt-2 text-sm text-charcoal-400">
          <span className="font-medium text-charcoal-200">{name}</span>을(를) 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
        </p>
        <div className="mt-5 flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm font-medium text-charcoal-400 hover:bg-charcoal-800/50 hover:text-charcoal-300"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
          >
            {isPending ? "삭제 중..." : "삭제"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BusinessList({
  businesses: initial,
  showFormExternal,
  onFormClose,
}: {
  businesses: Business[];
  showFormExternal?: boolean;
  onFormClose?: () => void;
}) {
  const router = useRouter();
  const params = useParams();
  const username = params.username as string;
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Business | null>(null);
  const [deleting, setDeleting] = useState<Business | null>(null);
  const [isPending, startTransition] = useTransition();

  const isFormOpen = showForm || showFormExternal;

  function closeForm() {
    setShowForm(false);
    onFormClose?.();
  }

  function handleSaved() {
    closeForm();
    setEditing(null);
    router.refresh();
  }

  function handleDelete() {
    if (!deleting) return;
    startTransition(async () => {
      const result = await deleteBusiness(deleting.id);
      if (result.success) {
        setDeleting(null);
        router.refresh();
      }
    });
  }

  if (initial.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-charcoal-700 py-20">
          <svg
            className="h-12 w-12 text-charcoal-700"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 0 0 .75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 0 0-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0 1 12 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 0 1-.673-.38m0 0A2.18 2.18 0 0 1 3 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 0 1 3.413-.387m7.5 0V5.25A2.25 2.25 0 0 0 13.5 3h-3a2.25 2.25 0 0 0-2.25 2.25v.894m7.5 0a48.667 48.667 0 0 0-7.5 0"
            />
          </svg>
          <p className="mt-4 text-sm text-charcoal-500">등록된 사업체가 없습니다</p>
          <p className="mt-1 text-xs text-charcoal-600">첫 번째 사업체를 등록해보세요</p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-4 rounded-lg bg-navy-600 px-4 py-2 text-sm font-medium text-white hover:bg-navy-500"
          >
            + 새 사업체
          </button>
        </div>

        {isFormOpen && (
          <BusinessForm onClose={closeForm} onSaved={handleSaved} />
        )}
      </>
    );
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {initial.map((biz) => (
          <div
            key={biz.id}
            className="group relative rounded-xl border border-charcoal-800/60 bg-charcoal-900/40 p-5 transition-colors hover:border-charcoal-700"
          >
            <div className="flex items-start justify-between">
              <Link
                href={`/${username}/business/${biz.id}`}
                className="text-base font-semibold text-charcoal-100 hover:text-navy-400"
              >
                {biz.name}
              </Link>
              <StatusBadge status={biz.status} />
            </div>

            {biz.industry && (
              <p className="mt-1.5 text-xs font-medium text-charcoal-500">{biz.industry}</p>
            )}

            {biz.description && (
              <p className="mt-2 line-clamp-2 text-sm text-charcoal-400">
                {biz.description}
              </p>
            )}

            {biz.url && (
              <a
                href={biz.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-xs text-navy-400 hover:underline"
              >
                {biz.url.replace(/^https?:\/\//, "")}
              </a>
            )}

            <div className="mt-4 flex items-center gap-2 border-t border-charcoal-800/40 pt-3">
              <button
                onClick={() => setEditing(biz)}
                className="rounded-md px-2.5 py-1 text-xs font-medium text-charcoal-500 hover:bg-charcoal-800/50 hover:text-charcoal-300"
              >
                수정
              </button>
              <button
                onClick={() => setDeleting(biz)}
                className="rounded-md px-2.5 py-1 text-xs font-medium text-charcoal-500 hover:bg-red-500/10 hover:text-red-400"
              >
                삭제
              </button>
            </div>
          </div>
        ))}
      </div>

      {isFormOpen && (
        <BusinessForm onClose={closeForm} onSaved={handleSaved} />
      )}
      {editing && (
        <BusinessForm
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}
      {deleting && (
        <DeleteConfirm
          name={deleting.name}
          onCancel={() => setDeleting(null)}
          onConfirm={handleDelete}
          isPending={isPending}
        />
      )}
    </>
  );
}

