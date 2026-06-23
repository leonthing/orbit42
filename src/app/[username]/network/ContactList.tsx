"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Contact, ContactInput } from "./actions";
import { createContact, syncGoogleContacts } from "./actions";
import ContactPanel from "./ContactPanel";
import { useToast } from "@/components/Toast";

const PAGE_SIZE = 12;

export default function ContactList({ contacts }: { contacts: Contact[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const toast = useToast();

  const filtered = useMemo(() => {
    if (!search.trim()) return contacts;
    const q = search.toLowerCase();
    return contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.company?.toLowerCase().includes(q) ||
        c.role?.toLowerCase().includes(q) ||
        c.tags?.some((t) => t.toLowerCase().includes(q)),
    );
  }, [contacts, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  // Reset to first page when the search query changes.
  useEffect(() => {
    setPage(1);
  }, [search]);

  // The selected contact, re-derived from the (possibly refreshed) list.
  const selected = useMemo(
    () => contacts.find((c) => c.id === selectedId) ?? null,
    [contacts, selectedId],
  );

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    try {
      const fd = new FormData(e.currentTarget);
      const tagsRaw = (fd.get("tags") as string) || "";
      const input: ContactInput = {
        name: fd.get("name") as string,
        company: (fd.get("company") as string) || null,
        role: (fd.get("role") as string) || null,
        email: (fd.get("email") as string) || null,
        phone: (fd.get("phone") as string) || null,
        tags: tagsRaw
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      };
      await createContact(input);
      setShowModal(false);
      router.refresh();
    } catch {
      toast.error("저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-charcoal-100">네트워크</h1>
          <p className="mt-1 text-sm text-charcoal-500">
            인적 네트워크 관리 · {contacts.length}명
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={async () => {
              setSyncing(true);
              try {
                const result = await syncGoogleContacts();
                if (result.error === "google_not_connected") {
                  window.location.href = "/api/google?return=network";
                  return;
                }
                toast.success(
                  `동기화 완료: ${result.created}건 추가, ${result.updated}건 업데이트`,
                );
                router.refresh();
              } catch {
                toast.error("동기화에 실패했습니다.");
              } finally {
                setSyncing(false);
              }
            }}
            disabled={syncing}
            className="rounded-lg border border-charcoal-700 px-4 py-2 text-sm font-medium text-charcoal-300 hover:bg-charcoal-800 disabled:opacity-50"
          >
            {syncing ? "동기화 중..." : "Google 연락처 가져오기"}
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500"
          >
            + 연락처 추가
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-500"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
          />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="이름, 회사, 직책, 태그로 검색..."
          className="w-full rounded-lg border border-charcoal-800 bg-charcoal-900/40 py-2.5 pl-10 pr-4 text-sm text-charcoal-200 placeholder:text-charcoal-600 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500/50"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-charcoal-700 py-20">
          <p className="text-sm text-charcoal-500">
            {search ? "검색 결과가 없습니다" : "등록된 연락처가 없습니다"}
          </p>
          <p className="mt-1 text-xs text-charcoal-600">
            {search ? "다른 키워드로 검색해보세요" : "네트워크를 구축해보세요"}
          </p>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_400px]">
          {/* List + pagination */}
          <div>
            <div className="overflow-hidden rounded-xl border border-charcoal-800/60">
              {pageItems.map((contact, i) => {
                const active = contact.id === selectedId;
                return (
                  <button
                    key={contact.id}
                    onClick={() => setSelectedId(contact.id)}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                      i > 0 ? "border-t border-charcoal-800/50" : ""
                    } ${
                      active
                        ? "bg-red-600/10"
                        : "hover:bg-charcoal-800/30"
                    }`}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-600/20 text-sm font-semibold text-red-400">
                      {contact.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 text-sm font-medium text-charcoal-100">
                        <span className="truncate">{contact.name}</span>
                        {contact.linked_user_id && (
                          <span
                            title="orbit42 회원"
                            className="shrink-0 rounded-full bg-red-600/20 px-1.5 py-0.5 text-[9px] font-semibold text-red-400"
                          >
                            회원
                          </span>
                        )}
                      </p>
                      {(contact.company || contact.role) && (
                        <p className="mt-0.5 truncate text-xs text-charcoal-500">
                          {[contact.role, contact.company]
                            .filter(Boolean)
                            .join(" @ ")}
                        </p>
                      )}
                    </div>
                    {contact.tags && contact.tags.length > 0 && (
                      <span className="hidden shrink-0 rounded-full bg-red-600/15 px-2 py-0.5 text-[10px] font-medium text-red-400 sm:inline">
                        {contact.tags[0]}
                        {contact.tags.length > 1 ? ` +${contact.tags.length - 1}` : ""}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  className="rounded-lg border border-charcoal-800 px-3 py-1.5 text-sm text-charcoal-300 hover:bg-charcoal-800/40 disabled:opacity-40"
                >
                  이전
                </button>
                <span className="text-xs text-charcoal-500">
                  {safePage} / {totalPages} 페이지 · 총 {filtered.length}명
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                  className="rounded-lg border border-charcoal-800 px-3 py-1.5 text-sm text-charcoal-300 hover:bg-charcoal-800/40 disabled:opacity-40"
                >
                  다음
                </button>
              </div>
            )}
          </div>

          {/* Detail panel — inline on lg, shown when selected on smaller screens */}
          <div
            className={`lg:sticky lg:top-4 lg:self-start ${
              selected ? "" : "hidden lg:block"
            }`}
          >
            {selected ? (
              <ContactPanel
                contact={selected}
                onChanged={() => router.refresh()}
                onClose={() => setSelectedId(null)}
              />
            ) : (
              <div className="flex h-full min-h-[300px] flex-col items-center justify-center rounded-2xl border border-dashed border-charcoal-800/60 p-8 text-center">
                <svg className="h-10 w-10 text-charcoal-700" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Zm6-10.125a1.875 1.875 0 1 1-3.75 0 1.875 1.875 0 0 1 3.75 0Zm1.294 6.336a6.721 6.721 0 0 1-3.17.789 6.721 6.721 0 0 1-3.168-.789 3.376 3.376 0 0 1 6.338 0Z" />
                </svg>
                <p className="mt-3 text-sm text-charcoal-500">
                  연락처를 선택하면 여기에 자세히 표시돼요
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-charcoal-800/60 bg-[rgb(var(--bg-base))] p-6">
            <h2 className="text-lg font-semibold text-charcoal-100">연락처 추가</h2>
            <form onSubmit={handleCreate} className="mt-4 space-y-3">
              <input
                name="name"
                required
                placeholder="이름 *"
                className="w-full rounded-lg border border-charcoal-700 bg-charcoal-800/50 px-3 py-2 text-sm text-charcoal-100 placeholder:text-charcoal-600 focus:border-red-500 focus:outline-none"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  name="company"
                  placeholder="회사"
                  className="w-full rounded-lg border border-charcoal-700 bg-charcoal-800/50 px-3 py-2 text-sm text-charcoal-100 placeholder:text-charcoal-600 focus:border-red-500 focus:outline-none"
                />
                <input
                  name="role"
                  placeholder="직책"
                  className="w-full rounded-lg border border-charcoal-700 bg-charcoal-800/50 px-3 py-2 text-sm text-charcoal-100 placeholder:text-charcoal-600 focus:border-red-500 focus:outline-none"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  name="email"
                  type="email"
                  placeholder="이메일"
                  className="w-full rounded-lg border border-charcoal-700 bg-charcoal-800/50 px-3 py-2 text-sm text-charcoal-100 placeholder:text-charcoal-600 focus:border-red-500 focus:outline-none"
                />
                <input
                  name="phone"
                  placeholder="전화번호"
                  className="w-full rounded-lg border border-charcoal-700 bg-charcoal-800/50 px-3 py-2 text-sm text-charcoal-100 placeholder:text-charcoal-600 focus:border-red-500 focus:outline-none"
                />
              </div>
              <input
                name="tags"
                placeholder="태그 (쉼표로 구분)"
                className="w-full rounded-lg border border-charcoal-700 bg-charcoal-800/50 px-3 py-2 text-sm text-charcoal-100 placeholder:text-charcoal-600 focus:border-red-500 focus:outline-none"
              />
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-lg px-4 py-2 text-sm text-charcoal-400 hover:text-charcoal-200"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
                >
                  {saving ? "저장 중..." : "저장"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
