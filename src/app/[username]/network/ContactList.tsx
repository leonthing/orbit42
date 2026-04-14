"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { Contact, ContactInput } from "./actions";
import { createContact, syncGoogleContacts } from "./actions";

export default function ContactList({
  contacts: initialContacts,
  username,
}: {
  contacts: Contact[];
  username: string;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const filtered = useMemo(() => {
    if (!search.trim()) return initialContacts;
    const q = search.toLowerCase();
    return initialContacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.company?.toLowerCase().includes(q) ||
        c.tags?.some((t) => t.toLowerCase().includes(q))
    );
  }, [initialContacts, search]);

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
      alert("저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-charcoal-100">Network</h1>
          <p className="mt-1 text-sm text-charcoal-500">인적 네트워크 관리</p>
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
                alert(`동기화 완료: ${result.created}건 추가, ${result.updated}건 업데이트`);
                router.refresh();
              } catch {
                alert("동기화에 실패했습니다.");
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
          placeholder="이름, 회사, 태그로 검색..."
          className="w-full rounded-lg border border-charcoal-800 bg-charcoal-900/40 py-2.5 pl-10 pr-4 text-sm text-charcoal-200 placeholder:text-charcoal-600 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500/50"
        />
      </div>

      {/* Contact Grid */}
      {filtered.length === 0 ? (
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
              d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"
            />
          </svg>
          <p className="mt-4 text-sm text-charcoal-500">
            {search ? "검색 결과가 없습니다" : "등록된 연락처가 없습니다"}
          </p>
          <p className="mt-1 text-xs text-charcoal-600">
            {search ? "다른 키워드로 검색해보세요" : "네트워크를 구축해보세요"}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((contact) => (
            <button
              key={contact.id}
              onClick={() =>
                router.push(`/${username}/network/${contact.id}`)
              }
              className="flex items-start gap-3 rounded-xl border border-charcoal-800/60 bg-charcoal-900/40 p-4 text-left transition-colors hover:border-charcoal-700 hover:bg-charcoal-800/30"
            >
              {/* Avatar */}
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-600/20 text-sm font-semibold text-red-400">
                {contact.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-charcoal-100">
                  {contact.name}
                </p>
                {(contact.company || contact.role) && (
                  <p className="mt-0.5 truncate text-xs text-charcoal-500">
                    {[contact.role, contact.company]
                      .filter(Boolean)
                      .join(" @ ")}
                  </p>
                )}
                {contact.tags && contact.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {contact.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-red-600/15 px-2 py-0.5 text-[10px] font-medium text-red-400"
                      >
                        {tag}
                      </span>
                    ))}
                    {contact.tags.length > 3 && (
                      <span className="text-[10px] text-charcoal-600">
                        +{contact.tags.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-charcoal-800/60 bg-[rgb(var(--bg-base))] p-6">
            <h2 className="text-lg font-semibold text-charcoal-100">
              연락처 추가
            </h2>
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

    </>
  );
}
