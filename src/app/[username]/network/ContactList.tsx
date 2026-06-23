"use client";

import { useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import type { Contact, ContactInput } from "./actions";
import { createContact, purgeSyncedContacts } from "./actions";
import ContactPanel from "./ContactPanel";
import FriendFinder from "./FriendFinder";
import { useToast } from "@/components/Toast";

// Index order: Korean leading consonants, then Latin A–Z, then "#" (etc).
const KO = ["ㄱ", "ㄴ", "ㄷ", "ㄹ", "ㅁ", "ㅂ", "ㅅ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
const LATIN = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const ORDER = [...KO, ...LATIN, "#"];
const ORDER_INDEX = new Map(ORDER.map((c, i) => [c, i]));

// 19 leading consonants (초성); double consonants fold into their base.
const CHO = ["ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
const CHO_BASE: Record<string, string> = { "ㄲ": "ㄱ", "ㄸ": "ㄷ", "ㅃ": "ㅂ", "ㅆ": "ㅅ", "ㅉ": "ㅈ" };

function initialOf(name: string): string {
  const ch = (name || "").trim().charAt(0);
  if (!ch) return "#";
  const code = ch.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) {
    const cho = CHO[Math.floor((code - 0xac00) / 588)];
    return CHO_BASE[cho] ?? cho;
  }
  if (ch >= "a" && ch <= "z") return ch.toUpperCase();
  if (ch >= "A" && ch <= "Z") return ch;
  return "#";
}

export default function ContactList({ contacts }: { contacts: Contact[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showFinder, setShowFinder] = useState(false);
  const [purging, setPurging] = useState(false);
  const toast = useToast();
  const groupRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const syncedCount = useMemo(
    () => contacts.filter((c) => c.google_contact_id).length,
    [contacts],
  );

  async function handlePurge() {
    setPurging(true);
    try {
      const { deleted } = await purgeSyncedContacts();
      toast.success(`가져온 연락처 ${deleted}건을 정리했어요.`);
      setSelectedId(null);
      router.refresh();
    } catch {
      toast.error("정리에 실패했습니다.");
    } finally {
      setPurging(false);
    }
  }

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

  // Sorted, grouped by initial (가나다 / ABC).
  const groups = useMemo(() => {
    const withInit = filtered.map((c) => ({ c, init: initialOf(c.name) }));
    withInit.sort((a, b) => {
      const oa = ORDER_INDEX.get(a.init) ?? 999;
      const ob = ORDER_INDEX.get(b.init) ?? 999;
      if (oa !== ob) return oa - ob;
      return a.c.name.localeCompare(b.c.name, "ko");
    });
    const out: { init: string; items: Contact[] }[] = [];
    for (const { c, init } of withInit) {
      const last = out[out.length - 1];
      if (last && last.init === init) last.items.push(c);
      else out.push({ init, items: [c] });
    }
    return out;
  }, [filtered]);

  const activeInitials = useMemo(
    () => new Set(groups.map((g) => g.init)),
    [groups],
  );

  function jumpTo(init: string) {
    groupRefs.current[init]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

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
            onClick={() => setShowFinder(true)}
            className="flex items-center gap-1.5 rounded-lg border border-charcoal-700 px-4 py-2 text-sm font-medium text-charcoal-300 hover:bg-charcoal-800"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
            </svg>
            연락처로 친구 찾기
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500"
          >
            + 연락처 추가
          </button>
        </div>
      </div>

      {/* Cleanup banner for previously bulk-imported contacts */}
      {syncedCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] px-4 py-3">
          <p className="text-xs leading-relaxed text-amber-300/90">
            예전에 가져온 Google 연락처{" "}
            <span className="font-semibold">{syncedCount.toLocaleString("ko-KR")}건</span>이
            저장돼 있어요. 이제 연락처는 직접 저장한 것만 관리하고, 지인 찾기는
            저장 없이 매칭해요.
          </p>
          <button
            onClick={handlePurge}
            disabled={purging}
            className="shrink-0 rounded-lg border border-amber-500/40 px-3 py-1.5 text-xs font-medium text-amber-200 hover:bg-amber-500/15 disabled:opacity-50"
          >
            {purging ? "정리 중..." : "가져온 연락처 정리"}
          </button>
        </div>
      )}

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
          {/* List with A–Z / 가나다 index */}
          <div className="flex gap-2">
            <div className="min-w-0 flex-1">
              <div className="rounded-xl border border-charcoal-800/60">
                {groups.map((g) => (
                  <div
                    key={g.init}
                    ref={(el) => {
                      groupRefs.current[g.init] = el;
                    }}
                    className="scroll-mt-24"
                  >
                    <div className="sticky top-0 z-10 border-b border-charcoal-800/50 bg-[rgb(var(--bg-base))]/90 px-4 py-1.5 text-xs font-bold text-charcoal-400 backdrop-blur">
                      {g.init}
                    </div>
                    {g.items.map((contact) => {
                      const active = contact.id === selectedId;
                      return (
                        <button
                          key={contact.id}
                          onClick={() => setSelectedId(contact.id)}
                          className={`flex w-full items-center gap-3 border-t border-charcoal-800/40 px-4 py-3 text-left transition-colors first:border-t-0 ${
                            active ? "bg-red-600/10" : "hover:bg-charcoal-800/30"
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
                              {contact.tags.length > 1
                                ? ` +${contact.tags.length - 1}`
                                : ""}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* Jump index */}
            <div className="sticky top-4 hidden h-fit flex-col items-center gap-0.5 self-start py-1 sm:flex">
              {ORDER.map((init) => {
                const has = activeInitials.has(init);
                return (
                  <button
                    key={init}
                    onClick={() => has && jumpTo(init)}
                    disabled={!has}
                    className={`text-[10px] leading-tight transition-colors ${
                      has
                        ? "font-semibold text-charcoal-400 hover:text-red-400"
                        : "text-charcoal-700"
                    }`}
                  >
                    {init}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Detail panel */}
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

      {showFinder && <FriendFinder onClose={() => setShowFinder(false)} />}
    </div>
  );
}
