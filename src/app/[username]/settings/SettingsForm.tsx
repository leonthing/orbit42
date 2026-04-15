"use client";

import { useState } from "react";
import { updateProfile, changePassword } from "@/lib/auth";
import type { SocialLinks, Education, Experience } from "@/lib/auth";
import { useTheme } from "@/components/ThemeProvider";

const SOCIAL_FIELDS: { key: keyof SocialLinks; label: string; placeholder: string; icon: React.ReactNode }[] = [
  {
    key: "instagram",
    label: "Instagram",
    placeholder: "instagram username",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
      </svg>
    ),
  },
  {
    key: "x",
    label: "X (Twitter)",
    placeholder: "x username",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    key: "youtube",
    label: "YouTube",
    placeholder: "youtube channel URL or @handle",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    ),
  },
  {
    key: "facebook",
    label: "Facebook",
    placeholder: "facebook username or page URL",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
  },
  {
    key: "linkedin",
    label: "LinkedIn",
    placeholder: "linkedin username or profile URL",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
  },
];

const EMPTY_EDU: Education = { school: "", degree: "", field: "", startYear: "", endYear: "" };
const EMPTY_EXP: Experience = {
  company: "",
  role: "",
  description: "",
  startYear: "",
  endYear: "",
  current: false,
};

export function SettingsForm({
  username,
  displayName: initialDisplayName,
  birthDate: initialBirthDate,
  bio: initialBio,
  socialLinks: initialSocialLinks,
  education: initialEducation,
  experience: initialExperience,
  interests: initialInterests,
  email,
  emailVerified,
  createdAt,
}: {
  username: string;
  displayName: string;
  birthDate: string;
  bio: string;
  socialLinks: SocialLinks;
  education: Education[];
  experience: Experience[];
  interests: string[];
  email: string | null;
  emailVerified: boolean;
  createdAt: string;
}) {
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [birthDate, setBirthDate] = useState(initialBirthDate);
  const [bio, setBio] = useState(initialBio);
  const [socialLinks, setSocialLinks] = useState<SocialLinks>(initialSocialLinks);
  const [education, setEducation] = useState<Education[]>(initialEducation);
  const [experience, setExperience] = useState<Experience[]>(initialExperience);
  const [interests, setInterests] = useState<string[]>(initialInterests);
  const [interestInput, setInterestInput] = useState("");
  const [profileMsg, setProfileMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwMsg, setPwMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [pwLoading, setPwLoading] = useState(false);

  const hasChanges =
    displayName !== initialDisplayName ||
    birthDate !== initialBirthDate ||
    bio !== initialBio ||
    JSON.stringify(socialLinks) !== JSON.stringify(initialSocialLinks) ||
    JSON.stringify(education) !== JSON.stringify(initialEducation) ||
    JSON.stringify(experience) !== JSON.stringify(initialExperience) ||
    JSON.stringify(interests) !== JSON.stringify(initialInterests);

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileLoading(true);
    setProfileMsg(null);
    const cleanedEdu = education.filter((e) => e.school.trim());
    const cleanedExp = experience.filter((e) => e.company.trim());
    const result = await updateProfile(username, displayName, birthDate || null, socialLinks, {
      bio: bio || null,
      education: cleanedEdu,
      experience: cleanedExp,
      interests,
    });
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

  function addEducation() {
    setEducation((prev) => [...prev, { ...EMPTY_EDU }]);
  }

  function updateEducation(index: number, field: keyof Education, value: string) {
    setEducation((prev) => prev.map((e, i) => (i === index ? { ...e, [field]: value } : e)));
  }

  function removeEducation(index: number) {
    setEducation((prev) => prev.filter((_, i) => i !== index));
  }

  function addExperience() {
    setExperience((prev) => [...prev, { ...EMPTY_EXP }]);
  }

  function updateExperience(
    index: number,
    field: keyof Experience,
    value: string | boolean,
  ) {
    setExperience((prev) =>
      prev.map((e, i) => (i === index ? { ...e, [field]: value } : e)),
    );
  }

  function removeExperience(index: number) {
    setExperience((prev) => prev.filter((_, i) => i !== index));
  }

  function addInterest() {
    const val = interestInput.trim();
    if (val && !interests.includes(val)) {
      setInterests((prev) => [...prev, val]);
    }
    setInterestInput("");
  }

  function removeInterest(tag: string) {
    setInterests((prev) => prev.filter((t) => t !== tag));
  }

  const inputClass = "w-full rounded-lg border border-charcoal-700 bg-charcoal-800/50 px-4 py-2.5 text-sm text-charcoal-100 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500/50";

  return (
    <div className="w-full min-w-0 space-y-8">
      {/* Profile Section */}
      <section className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/40">
        <div className="border-b border-charcoal-800/40 px-5 py-3">
          <h2 className="text-sm font-semibold text-charcoal-200">프로필</h2>
        </div>
        <form onSubmit={handleProfileSave} className="space-y-4 p-5">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-charcoal-400">Username</label>
            <div className="flex items-center rounded-lg border border-charcoal-800 bg-charcoal-800/30 px-4 py-2.5 text-sm text-charcoal-500">
              {username}
            </div>
            <p className="mt-1 text-xs text-charcoal-600">orbit42.org/{username}</p>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-charcoal-400">Display Name</label>
            <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={inputClass} />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-charcoal-400">
              이메일
            </label>
            <div className="flex items-center gap-2 rounded-lg border border-charcoal-800 bg-charcoal-800/30 px-4 py-2.5">
              <span className="min-w-0 flex-1 truncate text-sm text-charcoal-200">
                {email || "등록된 이메일이 없어요"}
              </span>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  emailVerified
                    ? "bg-emerald-500/15 text-emerald-800 ring-1 ring-emerald-500/40 dark:text-emerald-200 dark:ring-0"
                    : "bg-amber-500/15 text-amber-800 ring-1 ring-amber-500/40 dark:text-amber-200 dark:ring-0"
                }`}
              >
                {emailVerified ? "확인됨" : "확인 필요"}
              </span>
            </div>
            <p className="mt-1 text-xs text-charcoal-600">
              이메일 변경 기능은 곧 지원될 예정이에요.
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-charcoal-400">한 줄 소개</label>
            <input type="text" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="나를 소개하는 한 마디" className={inputClass} />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-charcoal-400">생년월일</label>
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className={`${inputClass} max-w-[10rem] sm:max-w-xs`}
            />
            <p className="mt-1 text-xs text-charcoal-600">Life Calendar에 사용됩니다</p>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-charcoal-400">가입일</label>
            <div className="text-sm text-charcoal-400">
              {new Date(createdAt).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}
            </div>
          </div>

          {profileMsg && (
            <p className={`text-sm ${profileMsg.type === "success" ? "text-emerald-400" : "text-red-400"}`}>
              {profileMsg.text}
            </p>
          )}

          <button
            type="submit"
            disabled={profileLoading || !hasChanges}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {profileLoading ? "저장 중..." : "저장"}
          </button>
        </form>
      </section>

      {/* Education Section */}
      <section className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/40">
        <div className="flex items-center justify-between border-b border-charcoal-800/40 px-5 py-3">
          <h2 className="text-sm font-semibold text-charcoal-200">학력</h2>
          <button
            type="button"
            onClick={addEducation}
            className="text-xs font-medium text-red-400 hover:text-red-300"
          >
            + 추가
          </button>
        </div>
        <div className="space-y-4 p-5">
          {education.length === 0 ? (
            <p className="text-sm text-charcoal-600">등록된 학력이 없습니다</p>
          ) : (
            education.map((edu, i) => (
              <div key={i} className="space-y-2 rounded-lg border border-charcoal-800/40 bg-charcoal-800/20 p-4">
                <div className="flex items-start justify-between">
                  <span className="text-xs font-medium text-charcoal-500">학력 {i + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeEducation(i)}
                    className="text-xs text-charcoal-600 hover:text-red-400"
                  >
                    삭제
                  </button>
                </div>
                <input
                  type="text"
                  value={edu.school}
                  onChange={(e) => updateEducation(i, "school", e.target.value)}
                  placeholder="학교명 *"
                  className={inputClass}
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    type="text"
                    value={edu.degree || ""}
                    onChange={(e) => updateEducation(i, "degree", e.target.value)}
                    placeholder="학위 (학사, 석사 등)"
                    className={inputClass}
                  />
                  <input
                    type="text"
                    value={edu.field || ""}
                    onChange={(e) => updateEducation(i, "field", e.target.value)}
                    placeholder="전공"
                    className={inputClass}
                  />
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    type="text"
                    value={edu.startYear || ""}
                    onChange={(e) => updateEducation(i, "startYear", e.target.value)}
                    placeholder="입학년도 (예: 2015)"
                    className={inputClass}
                  />
                  <input
                    type="text"
                    value={edu.endYear || ""}
                    onChange={(e) => updateEducation(i, "endYear", e.target.value)}
                    placeholder="졸업년도 (예: 2019)"
                    className={inputClass}
                  />
                </div>
              </div>
            ))
          )}
          <p className="text-xs text-charcoal-600">변경 후 상단의 저장 버튼을 눌러주세요</p>
        </div>
      </section>

      {/* Experience Section */}
      <section className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/40">
        <div className="flex items-center justify-between border-b border-charcoal-800/40 px-5 py-3">
          <h2 className="text-sm font-semibold text-charcoal-200">경력</h2>
          <button
            type="button"
            onClick={addExperience}
            className="text-xs font-medium text-red-400 hover:text-red-300"
          >
            + 추가
          </button>
        </div>
        <div className="space-y-4 p-5">
          {experience.length === 0 ? (
            <p className="text-sm text-charcoal-600">등록된 경력이 없습니다</p>
          ) : (
            experience.map((exp, i) => (
              <div
                key={i}
                className="space-y-2 rounded-lg border border-charcoal-800/40 bg-charcoal-800/20 p-4"
              >
                <div className="flex items-start justify-between">
                  <span className="text-xs font-medium text-charcoal-500">경력 {i + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeExperience(i)}
                    className="text-xs text-charcoal-600 hover:text-red-400"
                  >
                    삭제
                  </button>
                </div>
                <input
                  type="text"
                  value={exp.company}
                  onChange={(e) => updateExperience(i, "company", e.target.value)}
                  placeholder="회사/조직 *"
                  className={inputClass}
                />
                <input
                  type="text"
                  value={exp.role || ""}
                  onChange={(e) => updateExperience(i, "role", e.target.value)}
                  placeholder="직무 (예: 프로덕트 매니저)"
                  className={inputClass}
                />
                <textarea
                  value={exp.description || ""}
                  onChange={(e) => updateExperience(i, "description", e.target.value)}
                  placeholder="주요 성과나 업무 (선택)"
                  rows={2}
                  className={`${inputClass} resize-none`}
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    type="text"
                    value={exp.startYear || ""}
                    onChange={(e) => updateExperience(i, "startYear", e.target.value)}
                    placeholder="시작 (예: 2020)"
                    className={inputClass}
                  />
                  <input
                    type="text"
                    value={exp.endYear || ""}
                    onChange={(e) => updateExperience(i, "endYear", e.target.value)}
                    placeholder="종료 (예: 2023)"
                    disabled={!!exp.current}
                    className={`${inputClass} disabled:opacity-40`}
                  />
                </div>
                <label className="flex items-center gap-2 text-xs text-charcoal-400">
                  <input
                    type="checkbox"
                    checked={!!exp.current}
                    onChange={(e) => {
                      updateExperience(i, "current", e.target.checked);
                      if (e.target.checked) updateExperience(i, "endYear", "");
                    }}
                    className="h-3.5 w-3.5 accent-red-500"
                  />
                  현재 재직 중
                </label>
              </div>
            ))
          )}
          <p className="text-xs text-charcoal-600">변경 후 상단의 저장 버튼을 눌러주세요</p>
        </div>
      </section>

      {/* Interests Section */}
      <section className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/40">
        <div className="border-b border-charcoal-800/40 px-5 py-3">
          <h2 className="text-sm font-semibold text-charcoal-200">관심사</h2>
        </div>
        <div className="space-y-3 p-5">
          <div className="flex gap-2">
            <input
              type="text"
              value={interestInput}
              onChange={(e) => setInterestInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addInterest();
                }
              }}
              placeholder="관심사를 입력하고 Enter"
              className={`${inputClass} flex-1`}
            />
            <button
              type="button"
              onClick={addInterest}
              className="shrink-0 rounded-lg bg-charcoal-800 px-3 py-2 text-sm text-charcoal-300 hover:bg-charcoal-700"
            >
              추가
            </button>
          </div>
          {interests.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {interests.map((tag) => (
                <span
                  key={tag}
                  className="flex items-center gap-1 rounded-full bg-red-600/15 px-3 py-1 text-xs font-medium text-red-400"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeInterest(tag)}
                    className="ml-0.5 text-red-400/60 hover:text-red-400"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          <p className="text-xs text-charcoal-600">변경 후 상단의 저장 버튼을 눌러주세요</p>
        </div>
      </section>

      {/* SNS Section */}
      <section className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/40">
        <div className="border-b border-charcoal-800/40 px-5 py-3">
          <h2 className="text-sm font-semibold text-charcoal-200">SNS</h2>
        </div>
        <div className="space-y-3 p-5">
          {SOCIAL_FIELDS.map((field) => (
            <div key={field.key} className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-charcoal-800/50 text-charcoal-400">
                {field.icon}
              </div>
              <div className="flex-1">
                <input
                  type="text"
                  value={socialLinks[field.key] || ""}
                  onChange={(e) =>
                    setSocialLinks((prev) => ({ ...prev, [field.key]: e.target.value }))
                  }
                  placeholder={field.placeholder}
                  className="w-full rounded-lg border border-charcoal-700 bg-charcoal-800/50 px-3 py-2 text-sm text-charcoal-100 placeholder:text-charcoal-600 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500/50"
                />
              </div>
            </div>
          ))}
          <p className="text-xs text-charcoal-600">변경 후 상단의 저장 버튼을 눌러주세요</p>
        </div>
      </section>

      {/* Theme Section */}
      <ThemeSection />

      {/* Password Section */}
      <section className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/40">
        <div className="border-b border-charcoal-800/40 px-5 py-3">
          <h2 className="text-sm font-semibold text-charcoal-200">비밀번호 변경</h2>
        </div>
        <form onSubmit={handlePasswordChange} className="space-y-4 p-5">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-charcoal-400">현재 비밀번호</label>
            <input type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-charcoal-400">새 비밀번호</label>
            <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="6자 이상" className={inputClass} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-charcoal-400">새 비밀번호 확인</label>
            <input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} className={inputClass} />
          </div>

          {pwMsg && (
            <p className={`text-sm ${pwMsg.type === "success" ? "text-emerald-400" : "text-red-400"}`}>
              {pwMsg.text}
            </p>
          )}

          <button
            type="submit"
            disabled={pwLoading || !currentPw || !newPw || !confirmPw}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {pwLoading ? "변경 중..." : "비밀번호 변경"}
          </button>
        </form>
      </section>
    </div>
  );
}

function ThemeSection() {
  const { theme, setTheme } = useTheme();
  const options: { value: "light" | "dark" | "system"; label: string; icon: React.ReactNode }[] = [
    {
      value: "light",
      label: "라이트",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
        </svg>
      ),
    },
    {
      value: "dark",
      label: "다크",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
        </svg>
      ),
    },
    {
      value: "system",
      label: "시스템",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25A2.25 2.25 0 0 1 5.25 3h13.5A2.25 2.25 0 0 1 21 5.25Z" />
        </svg>
      ),
    },
  ];

  return (
    <section className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/40">
      <div className="border-b border-charcoal-800/40 px-5 py-3">
        <h2 className="text-sm font-semibold text-charcoal-200">테마</h2>
      </div>
      <div className="flex gap-3 p-5">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setTheme(opt.value)}
            className={`flex flex-1 flex-col items-center gap-2 rounded-lg border px-4 py-4 transition-colors ${
              theme === opt.value
                ? "border-red-500 bg-red-600/10 text-red-400"
                : "border-charcoal-800/60 text-charcoal-500 hover:border-charcoal-700 hover:text-charcoal-300"
            }`}
          >
            {opt.icon}
            <span className="text-xs font-medium">{opt.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
