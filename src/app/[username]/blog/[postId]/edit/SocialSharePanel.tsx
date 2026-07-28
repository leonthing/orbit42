"use client";

import { useState, useTransition } from "react";
import {
  generateSocialPosts,
  getSocialConnectionStatus,
  publishToX,
  publishToFacebook,
  publishToLinkedIn,
} from "../../social-actions";
import { saveSocialTexts } from "../../actions";

interface Props {
  title: string;
  content: string;
  slug: string;
  postId: string;
  username: string;
  published: boolean;
  initialSocial?: { x: string | null; facebook: string | null; linkedin: string | null };
}

type Platform = "x" | "facebook" | "linkedin";

export default function SocialSharePanel({ title, content, slug, postId, username, published, initialSocial }: Props) {
  const [xText, setXText] = useState(initialSocial?.x || "");
  const [fbText, setFbText] = useState(initialSocial?.facebook || "");
  const [liText, setLiText] = useState(initialSocial?.linkedin || "");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");
  const [generated, setGenerated] = useState(!!(initialSocial?.x || initialSocial?.facebook || initialSocial?.linkedin));
  const [status, setStatus] = useState<{
    x: { connected: boolean; username: string | null };
    facebook: { connected: boolean; name: string | null };
    linkedin: { connected: boolean; name: string | null };
    configured: { x: boolean; facebook: boolean; linkedin: boolean };
  } | null>(null);
  const [results, setResults] = useState<Record<Platform, string>>({ x: "", facebook: "", linkedin: "" });
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState<Platform | null>(null);
  const [loaded, setLoaded] = useState(false);

  async function loadStatus() {
    if (loaded) return;
    const s = await getSocialConnectionStatus();
    setStatus(s);
    setLoaded(true);
  }

  // Load status on first render if published
  if (published && !loaded) {
    loadStatus();
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
      await saveSocialTexts(postId, {
        social_x: posts.x,
        social_facebook: posts.facebook,
        social_linkedin: posts.linkedin,
      });
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

  const visiblePlatforms = platforms.filter((p) => !status?.configured || status.configured[p.key]);

  return (
    <div className="mt-4 rounded-xl border border-charcoal-700 bg-charcoal-800/30">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-charcoal-700/50 px-5 py-3">
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-charcoal-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.935-2.186 2.25 2.25 0 0 0-3.935 2.186Z" />
          </svg>
          <h3 className="text-sm font-semibold text-charcoal-200">소셜 공유</h3>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating || !content.trim()}
          className="flex items-center gap-1.5 rounded-md bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-50"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
          </svg>
          {generating ? "생성 중..." : generated ? "다시 생성" : "AI 요약 생성"}
        </button>
      </div>

      {genError && (
        <div className="border-b border-charcoal-700/50 px-5 py-2">
          <p className="text-xs text-red-400">{genError}</p>
        </div>
      )}

      {/* Platform cards */}
      <div className="grid gap-0 divide-y divide-charcoal-700/50">
        {visiblePlatforms.map((p) => (
          <div key={p.key} className="px-5 py-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-charcoal-200">{p.label}</span>
                {p.connected ? (
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-400">
                    {p.connectedLabel} 연결됨
                  </span>
                ) : (
                  <a
                    href={p.authUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full bg-charcoal-700/50 px-2 py-0.5 text-[10px] text-navy-400 hover:bg-charcoal-700"
                  >
                    계정 연결 ↗
                  </a>
                )}
              </div>
              {p.maxLen && (
                <span className={`text-[10px] ${p.text.length > p.maxLen ? "text-navy-400 font-medium" : "text-charcoal-500"}`}>
                  {p.text.length}/{p.maxLen}
                </span>
              )}
            </div>

            <textarea
              value={p.text}
              onChange={(e) => p.setText(e.target.value)}
              placeholder={generated ? "" : `${p.label}에 공유할 내용을 입력하거나 AI 생성을 사용하세요`}
              rows={3}
              className="mb-2 w-full resize-none rounded-lg border border-charcoal-700 bg-charcoal-800/50 px-3 py-2 text-sm leading-relaxed text-charcoal-200 placeholder:text-charcoal-600 focus:border-navy-400 focus:outline-none"
            />

            <div className="flex items-center gap-2">
              {p.connected && (
                <button
                  onClick={() => handlePost(p.key)}
                  disabled={isPending || !p.text.trim() || (p.maxLen ? p.text.length > p.maxLen : false) || results[p.key] === "posted"}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                    results[p.key] === "posted"
                      ? "bg-emerald-600/20 text-emerald-400"
                      : "bg-charcoal-700 text-charcoal-100 hover:bg-charcoal-600"
                  }`}
                >
                  {results[p.key] === "posted" ? "게시 완료 ✓" : isPending ? "게시 중..." : "포스팅"}
                </button>
              )}
              <button
                onClick={() => copyToClipboard(p.text, p.key)}
                disabled={!p.text.trim()}
                className="rounded-lg border border-charcoal-700 px-3 py-1.5 text-xs text-charcoal-400 hover:text-charcoal-200 disabled:opacity-50"
              >
                {copied === p.key ? "복사됨 ✓" : "복사"}
              </button>
              {results[p.key] && results[p.key] !== "posted" && (
                <span className="truncate text-[10px] text-navy-400">{results[p.key]}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
