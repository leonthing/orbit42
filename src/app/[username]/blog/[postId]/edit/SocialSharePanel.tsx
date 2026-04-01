"use client";

import { useState, useTransition } from "react";
import {
  generateSocialPosts,
  getSocialConnectionStatus,
  publishToX,
  publishToFacebook,
  publishToLinkedIn,
} from "../../social-actions";

interface Props {
  title: string;
  content: string;
  slug: string;
  postId: string;
  username: string;
  published: boolean;
}

type Platform = "x" | "facebook" | "linkedin";

export default function SocialSharePanel({ title, content, slug, postId, username, published }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [xText, setXText] = useState("");
  const [fbText, setFbText] = useState("");
  const [liText, setLiText] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");
  const [generated, setGenerated] = useState(false);
  const [status, setStatus] = useState<{
    x: { connected: boolean; username: string | null };
    facebook: { connected: boolean; name: string | null };
    linkedin: { connected: boolean; name: string | null };
    configured: { x: boolean; facebook: boolean; linkedin: boolean };
  } | null>(null);
  const [results, setResults] = useState<Record<Platform, string>>({ x: "", facebook: "", linkedin: "" });
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState<Platform | null>(null);

  async function handleOpen() {
    setIsOpen(!isOpen);
    if (!isOpen && !status) {
      const s = await getSocialConnectionStatus();
      setStatus(s);
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    setGenError("");
    setResults({ x: "", facebook: "", linkedin: "" });
    try {
      const posts = await generateSocialPosts(title, content, slug, username);
      setXText(posts.x);
      setFbText(posts.facebook);
      setLiText(posts.linkedin);
      setGenerated(true);
    } catch (e: unknown) {
      setGenError(e instanceof Error ? e.message : "요약 생성 실패");
    }
    setGenerating(false);
  }

  function handlePost(platform: Platform) {
    const blogUrl = `https://blog.orbit42.org/${username}/${slug}`;
    startTransition(async () => {
      let result;
      if (platform === "x") result = await publishToX(xText);
      else if (platform === "facebook") result = await publishToFacebook(fbText, blogUrl);
      else result = await publishToLinkedIn(liText, blogUrl);
      setResults((prev) => ({ ...prev, [platform]: result.success ? "posted" : result.error || "오류" }));
    });
  }

  function copyToClipboard(text: string, platform: Platform) {
    navigator.clipboard.writeText(text);
    setCopied(platform);
    setTimeout(() => setCopied(null), 2000);
  }

  if (!published) return null;

  const platforms: {
    key: Platform;
    label: string;
    text: string;
    setText: (v: string) => void;
    connected: boolean;
    connectedLabel: string | null;
    authUrl: string;
    maxLen?: number;
  }[] = [
    {
      key: "x",
      label: "𝕏",
      text: xText,
      setText: setXText,
      connected: status?.x.connected || false,
      connectedLabel: status?.x.username ? `@${status.x.username}` : null,
      authUrl: `/api/x?return=${encodeURIComponent(`blog/${postId}/edit`)}`,
      maxLen: 280,
    },
    {
      key: "facebook",
      label: "Facebook",
      text: fbText,
      setText: setFbText,
      connected: status?.facebook.connected || false,
      connectedLabel: status?.facebook.name || null,
      authUrl: `/api/facebook?return=${encodeURIComponent(`blog/${postId}/edit`)}`,
    },
    {
      key: "linkedin",
      label: "LinkedIn",
      text: liText,
      setText: setLiText,
      connected: status?.linkedin.connected || false,
      connectedLabel: status?.linkedin.name || null,
      authUrl: `/api/linkedin?return=${encodeURIComponent(`blog/${postId}/edit`)}`,
    },
  ];

  return (
    <div className="relative">
      <button
        onClick={handleOpen}
        className={`rounded-lg p-1.5 transition-colors ${
          isOpen ? "text-navy-400" : "text-charcoal-500 hover:text-charcoal-300"
        }`}
        title="소셜 공유"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.935-2.186 2.25 2.25 0 0 0-3.935 2.186Z" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-10 z-50 max-h-[80vh] w-[440px] overflow-y-auto rounded-xl border border-charcoal-700 bg-charcoal-900 p-4 shadow-2xl">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-charcoal-100">소셜 공유</h3>
            <button onClick={() => setIsOpen(false)} className="text-charcoal-500 hover:text-charcoal-300">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* AI 요약 생성 - 별도 섹션 */}
          <div className="mb-4 rounded-lg border border-charcoal-700 bg-charcoal-800/30 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4 text-violet-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
                </svg>
                <span className="text-xs font-medium text-charcoal-200">AI 요약 생성</span>
              </div>
              <button
                onClick={handleGenerate}
                disabled={generating || !content.trim()}
                className="rounded-md bg-violet-600 px-3 py-1 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-50"
              >
                {generating ? "생성 중..." : generated ? "다시 생성" : "생성"}
              </button>
            </div>
            {genError && <p className="mt-2 text-xs text-red-400">{genError}</p>}
            {!generated && !genError && (
              <p className="mt-2 text-[10px] text-charcoal-500">각 플랫폼에 맞는 요약을 AI가 자동으로 생성합니다</p>
            )}
          </div>

          {/* 플랫폼별 섹션 */}
          <div className="space-y-3">
            {platforms.filter((p) => !status?.configured || status.configured[p.key]).map((p) => (
              <div key={p.key} className="rounded-lg border border-charcoal-700 bg-charcoal-800/50 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-charcoal-200">{p.label}</span>
                    {p.connected ? (
                      <span className="text-[10px] text-emerald-400">{p.connectedLabel} 연결됨</span>
                    ) : (
                      <a href={p.authUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-navy-400 hover:underline">
                        계정 연결 ↗
                      </a>
                    )}
                  </div>
                  {p.maxLen && (
                    <span className={`text-[10px] ${p.text.length > p.maxLen ? "text-red-400" : "text-charcoal-500"}`}>
                      {p.text.length}/{p.maxLen}
                    </span>
                  )}
                </div>
                <textarea
                  value={p.text}
                  onChange={(e) => p.setText(e.target.value)}
                  placeholder={`${p.label}에 공유할 내용을 입력하거나 AI 생성을 사용하세요`}
                  rows={4}
                  className="mb-2 w-full resize-none rounded border border-charcoal-700 bg-charcoal-800 px-3 py-2 text-xs text-charcoal-200 placeholder:text-charcoal-600 focus:border-navy-500 focus:outline-none"
                />
                <div className="flex items-center gap-2">
                  {p.connected && (
                    <button
                      onClick={() => handlePost(p.key)}
                      disabled={isPending || !p.text.trim() || (p.maxLen ? p.text.length > p.maxLen : false) || results[p.key] === "posted"}
                      className="rounded-md bg-charcoal-700 px-3 py-1 text-xs font-medium text-charcoal-100 hover:bg-charcoal-600 disabled:opacity-50"
                    >
                      {results[p.key] === "posted" ? "게시 완료 ✓" : isPending ? "게시 중..." : "포스팅"}
                    </button>
                  )}
                  <button
                    onClick={() => copyToClipboard(p.text, p.key)}
                    disabled={!p.text.trim()}
                    className="rounded-md border border-charcoal-700 px-3 py-1 text-xs text-charcoal-400 hover:text-charcoal-200 disabled:opacity-50"
                  >
                    {copied === p.key ? "복사됨 ✓" : "복사"}
                  </button>
                  {results[p.key] && results[p.key] !== "posted" && (
                    <span className="text-[10px] text-red-400 truncate">{results[p.key]}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
