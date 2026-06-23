"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Contact, LinkedMember } from "../actions";
import { updateContact, deleteContact } from "../actions";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmDialog";
import MemberLinkCard from "./MemberLinkCard";

export default function ContactDetail({
  contact,
  username,
  member,
  initialFollowing,
}: {
  contact: Contact;
  username: string;
  member: LinkedMember | null;
  initialFollowing: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [name, setName] = useState(contact.name);
  const [company, setCompany] = useState(contact.company ?? "");
  const [role, setRole] = useState(contact.role ?? "");
  const [email, setEmail] = useState(contact.email ?? "");
  const [phone, setPhone] = useState(contact.phone ?? "");
  const [tags, setTags] = useState<string[]>(contact.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [memo, setMemo] = useState(contact.memo ?? "");
  const [lastContactAt, setLastContactAt] = useState(
    contact.last_contact_at?.slice(0, 10) ?? ""
  );

  async function handleSave() {
    setSaving(true);
    try {
      await updateContact(contact.id, {
        name,
        company: company || null,
        role: role || null,
        email: email || null,
        phone: phone || null,
        tags,
        memo: memo || null,
        last_contact_at: lastContactAt
          ? new Date(lastContactAt).toISOString()
          : null,
      });
      setEditing(false);
      router.refresh();
    } catch {
      toast.error("저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    const ok = await confirm({
      title: "이 연락처를 삭제할까요?",
      confirmLabel: "삭제",
      danger: true,
    });
    if (!ok) return;
    setDeleting(true);
    try {
      await deleteContact(contact.id);
      router.push(`/${username}/network`);
      router.refresh();
    } catch {
      toast.error("삭제에 실패했습니다.");
      setDeleting(false);
    }
  }

  function addTag() {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) {
      setTags([...tags, t]);
    }
    setTagInput("");
  }

  function removeTag(tag: string) {
    setTags(tags.filter((t) => t !== tag));
  }

  function handleTagKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag();
    }
  }

  const inputClass = editing
    ? "w-full rounded-lg border border-charcoal-700 bg-charcoal-800/50 px-3 py-2 text-sm text-charcoal-100 focus:border-red-500 focus:outline-none"
    : "w-full rounded-lg border border-transparent bg-transparent px-3 py-2 text-sm text-charcoal-100";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`/${username}/network`)}
            className="rounded-lg p-1.5 text-charcoal-500 hover:bg-charcoal-800/50 hover:text-charcoal-300"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"
              />
            </svg>
          </button>
          <h1 className="text-2xl font-bold text-charcoal-100">연락처 상세</h1>
        </div>
        <div className="flex gap-2">
          {editing ? (
            <>
              <button
                onClick={() => setEditing(false)}
                className="rounded-lg px-4 py-2 text-sm text-charcoal-400 hover:text-charcoal-200"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
              >
                {saving ? "저장 중..." : "저장"}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setEditing(true)}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500"
              >
                수정
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-lg border border-red-800/60 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-900/20 disabled:opacity-50"
              >
                {deleting ? "삭제 중..." : "삭제"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Profile card */}
      <div className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/40 p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-red-600/20 text-2xl font-bold text-red-400">
            {name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 space-y-1">
            {editing ? (
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="이름"
                className="w-full rounded-lg border border-charcoal-700 bg-charcoal-800/50 px-3 py-2 text-lg font-semibold text-charcoal-100 focus:border-red-500 focus:outline-none"
              />
            ) : (
              <p className="text-lg font-semibold text-charcoal-100">{name}</p>
            )}
            {editing ? (
              <div className="flex gap-2">
                <input
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="직책"
                  className="flex-1 rounded-lg border border-charcoal-700 bg-charcoal-800/50 px-3 py-1.5 text-sm text-charcoal-100 focus:border-red-500 focus:outline-none"
                />
                <input
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="회사"
                  className="flex-1 rounded-lg border border-charcoal-700 bg-charcoal-800/50 px-3 py-1.5 text-sm text-charcoal-100 focus:border-red-500 focus:outline-none"
                />
              </div>
            ) : (
              (role || company) && (
                <p className="text-sm text-charcoal-500">
                  {[role, company].filter(Boolean).join(" @ ")}
                </p>
              )
            )}
          </div>
        </div>
      </div>

      {/* orbit42 member link */}
      <MemberLinkCard
        contactId={contact.id}
        member={member}
        hasEmail={!!email}
        initialFollowing={initialFollowing}
      />

      {/* Contact info */}
      <div className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/40 p-6">
        <h2 className="mb-4 text-sm font-semibold text-charcoal-400">
          연락처 정보
        </h2>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="w-16 shrink-0 text-xs text-charcoal-500">
              이메일
            </span>
            {editing ? (
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="이메일"
                className={inputClass}
              />
            ) : (
              <span className="text-sm text-charcoal-200">
                {email || "-"}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="w-16 shrink-0 text-xs text-charcoal-500">
              전화
            </span>
            {editing ? (
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="전화번호"
                className={inputClass}
              />
            ) : (
              <span className="text-sm text-charcoal-200">
                {phone || "-"}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="w-16 shrink-0 text-xs text-charcoal-500">
              최근 연락
            </span>
            {editing ? (
              <input
                type="date"
                value={lastContactAt}
                onChange={(e) => setLastContactAt(e.target.value)}
                className={inputClass}
              />
            ) : (
              <span className="text-sm text-charcoal-200">
                {lastContactAt || "-"}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tags */}
      <div className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/40 p-6">
        <h2 className="mb-4 text-sm font-semibold text-charcoal-400">태그</h2>
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-red-600/15 px-3 py-1 text-xs font-medium text-red-400"
            >
              {tag}
              {editing && (
                <button
                  onClick={() => removeTag(tag)}
                  className="ml-0.5 text-red-400/60 hover:text-red-300"
                >
                  &times;
                </button>
              )}
            </span>
          ))}
          {editing && (
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              onBlur={addTag}
              placeholder="태그 입력 후 Enter"
              className="rounded-full border border-dashed border-charcoal-700 bg-transparent px-3 py-1 text-xs text-charcoal-300 placeholder:text-charcoal-600 focus:border-red-500 focus:outline-none"
            />
          )}
          {!editing && tags.length === 0 && (
            <span className="text-xs text-charcoal-600">태그 없음</span>
          )}
        </div>
      </div>

      {/* Memo */}
      <div className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/40 p-6">
        <h2 className="mb-4 text-sm font-semibold text-charcoal-400">메모</h2>
        {editing ? (
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            rows={5}
            placeholder="메모를 입력하세요..."
            className="w-full rounded-lg border border-charcoal-700 bg-charcoal-800/50 px-3 py-2 text-sm text-charcoal-100 placeholder:text-charcoal-600 focus:border-red-500 focus:outline-none"
          />
        ) : (
          <p className="whitespace-pre-wrap text-sm text-charcoal-300">
            {memo || "메모 없음"}
          </p>
        )}
      </div>
    </div>
  );
}
