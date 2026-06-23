"use client";

import { useEffect, useState } from "react";
import type { Contact, LinkedMember } from "./actions";
import { updateContact, deleteContact, getLinkedMember } from "./actions";
import { isFollowing } from "@/lib/follows";
import MemberLinkCard from "./[id]/MemberLinkCard";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmDialog";

/**
 * Inline contact detail rendered in the right-side panel of the network
 * page — view/edit a contact without leaving the list.
 */
export default function ContactPanel({
  contact,
  onChanged,
  onClose,
}: {
  contact: Contact;
  onChanged: () => void;
  onClose: () => void;
}) {
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
    contact.last_contact_at?.slice(0, 10) ?? "",
  );

  // Member link is resolved client-side when the selected contact changes.
  const [member, setMember] = useState<LinkedMember | null>(null);
  const [following, setFollowing] = useState(false);
  const [memberLoaded, setMemberLoaded] = useState(false);

  // Reset all fields whenever a different contact is selected.
  useEffect(() => {
    setEditing(false);
    setName(contact.name);
    setCompany(contact.company ?? "");
    setRole(contact.role ?? "");
    setEmail(contact.email ?? "");
    setPhone(contact.phone ?? "");
    setTags(contact.tags ?? []);
    setTagInput("");
    setMemo(contact.memo ?? "");
    setLastContactAt(contact.last_contact_at?.slice(0, 10) ?? "");
  }, [contact]);

  useEffect(() => {
    let cancelled = false;
    setMember(null);
    setFollowing(false);
    setMemberLoaded(false);
    (async () => {
      if (contact.linked_user_id) {
        const m = await getLinkedMember(contact.linked_user_id);
        if (cancelled) return;
        setMember(m);
        if (m) {
          const f = await isFollowing(m.username);
          if (!cancelled) setFollowing(f);
        }
      }
      if (!cancelled) setMemberLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [contact.id, contact.linked_user_id]);

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
      onChanged();
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
      onChanged();
      onClose();
    } catch {
      toast.error("삭제에 실패했습니다.");
      setDeleting(false);
    }
  }

  function addTag() {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) setTags([...tags, t]);
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

  const inputClass =
    "w-full rounded-lg border border-charcoal-700 bg-charcoal-800/50 px-3 py-2 text-sm text-charcoal-100 focus:border-red-500 focus:outline-none";

  return (
    <div className="rounded-2xl border border-charcoal-800/60 bg-charcoal-900/40">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-charcoal-800/50 p-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-600/20 text-lg font-bold text-red-400">
            {name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            {editing ? (
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="이름"
                className="w-full rounded-lg border border-charcoal-700 bg-charcoal-800/50 px-2 py-1 text-base font-semibold text-charcoal-100 focus:border-red-500 focus:outline-none"
              />
            ) : (
              <p className="truncate text-base font-semibold text-charcoal-100">
                {name}
              </p>
            )}
            {!editing && (role || company) && (
              <p className="truncate text-xs text-charcoal-500">
                {[role, company].filter(Boolean).join(" @ ")}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="닫기"
          className="shrink-0 rounded-lg p-1.5 text-charcoal-500 hover:bg-charcoal-800/60 hover:text-charcoal-200 lg:hidden"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="space-y-4 p-4">
        {editing && (
          <div className="grid grid-cols-2 gap-2">
            <input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="직책"
              className={inputClass}
            />
            <input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="회사"
              className={inputClass}
            />
          </div>
        )}

        {/* Member link */}
        {memberLoaded && (member || (!!contact.email && !member)) && (
          <MemberLinkCard
            key={`${contact.id}:${member?.id ?? "none"}`}
            contactId={contact.id}
            member={member}
            hasEmail={!!contact.email}
            initialFollowing={following}
          />
        )}

        {/* Contact info */}
        <div className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/30 p-4">
          <h3 className="mb-3 text-xs font-semibold text-charcoal-400">
            연락처 정보
          </h3>
          <div className="space-y-2.5">
            <InfoRow label="이메일">
              {editing ? (
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="이메일"
                  className={inputClass}
                />
              ) : email ? (
                <a href={`mailto:${email}`} className="text-sm text-charcoal-200 hover:text-red-400">
                  {email}
                </a>
              ) : (
                <span className="text-sm text-charcoal-600">-</span>
              )}
            </InfoRow>
            <InfoRow label="전화">
              {editing ? (
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="전화번호"
                  className={inputClass}
                />
              ) : phone ? (
                <a href={`tel:${phone}`} className="text-sm text-charcoal-200 hover:text-red-400">
                  {phone}
                </a>
              ) : (
                <span className="text-sm text-charcoal-600">-</span>
              )}
            </InfoRow>
            <InfoRow label="최근 연락">
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
            </InfoRow>
          </div>
        </div>

        {/* Tags */}
        <div className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/30 p-4">
          <h3 className="mb-3 text-xs font-semibold text-charcoal-400">태그</h3>
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
        <div className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/30 p-4">
          <h3 className="mb-3 text-xs font-semibold text-charcoal-400">메모</h3>
          {editing ? (
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={4}
              placeholder="메모를 입력하세요..."
              className="w-full rounded-lg border border-charcoal-700 bg-charcoal-800/50 px-3 py-2 text-sm text-charcoal-100 placeholder:text-charcoal-600 focus:border-red-500 focus:outline-none"
            />
          ) : (
            <p className="whitespace-pre-wrap text-sm text-charcoal-300">
              {memo || "메모 없음"}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-1">
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
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-lg border border-red-800/60 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-900/20 disabled:opacity-50"
              >
                {deleting ? "삭제 중..." : "삭제"}
              </button>
              <button
                onClick={() => setEditing(true)}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500"
              >
                수정
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-16 shrink-0 text-xs text-charcoal-500">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
