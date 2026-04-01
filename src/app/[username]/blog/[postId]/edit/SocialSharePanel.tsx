"use client";

import { useState, useTransition } from "react";
import {
  generateSocialPosts,
  getSocialConnectionStatus,
  publishToX,
  publishToFacebook,
  publishToLinkedIn,
  type SocialPosts,
} from "../../social-actions";

interface Props {
  title: string;
  content: string;
  slug: string;
  username: string;
  published: boolean;
}

export default function SocialSharePanel({ title, content, slug, username, published }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [posts, setPosts] = useState<SocialPosts | null>(null);
  const [xText, setXText] = useState("");
  const [fbText, setFbText] = useState("");
  const [liText, setLiText] = useState("");
  const [generating, setGenerating] = useState(false);
  const [status, setStatus] = useState<{ x: { connected: boolean; username: string | null }; facebook: { connected: boolean; name: string | null }; linkedin: { connected: boolean; name: string | null } } | null>(null);
  const [results, setResults] = useState<{ x?: string; facebook?: string; linkedin?: string }>({});
  const [genError, setGenError] = useState("");
  const [isPending, startTransition] = useTransition();

  async function handleOpen() {
    setIsOpen(!isOpen);
    if (!isOpen && !status) {
      const s = await getSocialConnectionStatus();
      setStatus(s);
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    setResults({});
    setGenError("");
    try {
      const generated = await generateSocialPosts(title, content, slug, username);
      setPosts(generated);
      setXText(generated.x);
      setFbText(generated.facebook);
      setLiText(generated.linkedin);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "알 수 없는 오류";
      setGenError(msg);
      console.error(e);
    }
    setGenerating(false);
  }

  function handlePostToX() {
    startTransition(async () => {
      const result = await publishToX(xText);
      setResults((prev) => ({
        ...prev,
        x: result.success ? "posted" : result.error || "오류 발생",
      }));
    });
  }

  function handlePostToFacebook() {
    const blogUrl = `https://blog.orbit42.org/${username}/${slug}`;
    startTransition(async () => {
      const result = await publishToFacebook(fbText, blogUrl);
      setResults((prev) => ({
        ...prev,
        facebook: result.success ? "posted" : result.error || "오류 발생",
      }));
    });
  }

  function handlePostToLinkedIn() {
    const blogUrl = `https://blog.orbit42.org/${username}/${slug}`;
    startTransition(async () => {
      const result = await publishToLinkedIn(liText, blogUrl);
      setResults((prev) => ({
        ...prev,
        linkedin: result.success ? "posted" : result.error || "오류 발생",
      }));
    });
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }

  if (!published) return null;

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
        <div className="absolute right-0 top-10 z-50 max-h-[80vh] w-[420px] overflow-y-auto rounded-xl border border-charcoal-700 bg-charcoal-900 p-4 shadow-2xl">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-charcoal-100">소셜 공유</h3>
            <button onClick={() => setIsOpen(false)} className="text-charcoal-500 hover:text-charcoal-300">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={generating || !content.trim()}
            className="mb-4 w-full rounded-lg bg-navy-600 px-4 py-2 text-sm font-medium text-white hover:bg-navy-500 disabled:opacity-50"
          >
            {generating ? "AI가 요약 생성 중..." : posts ? "다시 생성" : "AI 요약 생성"}
          </button>

          {genError && (
            <p className="text-xs text-red-400">{genError}</p>
          )}

          {posts && (
            <div className="space-y-4">
              {/* X (Twitter) */}
              <div className="rounded-lg border border-charcoal-700 bg-charcoal-800/50 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-charcoal-200">𝕏</span>
                    {status?.x.connected ? (
                      <span className="text-[10px] text-emerald-400">@{status.x.username} 연결됨</span>
                    ) : (
                      <a
                        href={`/api/x?return=${encodeURIComponent(`${username}/blog/${slug}/edit`)}`}
                        className="text-[10px] text-navy-400 hover:underline"
                      >
                        계정 연결
                      </a>
                    )}
                  </div>
                  <span className={`text-[10px] ${xText.length > 280 ? "text-red-400" : "text-charcoal-500"}`}>
                    {xText.length}/280
                  </span>
                </div>
                <textarea
                  value={xText}
                  onChange={(e) => setXText(e.target.value)}
                  rows={4}
                  className="mb-2 w-full resize-none rounded border border-charcoal-700 bg-charcoal-800 px-3 py-2 text-xs text-charcoal-200 focus:border-navy-500 focus:outline-none"
                />
                <div className="flex gap-2">
                  {status?.x.connected && (
                    <button
                      onClick={handlePostToX}
                      disabled={isPending || !xText.trim() || xText.length > 280 || results.x === "posted"}
                      className="rounded-md bg-charcoal-700 px-3 py-1 text-xs font-medium text-charcoal-100 hover:bg-charcoal-600 disabled:opacity-50"
                    >
                      {results.x === "posted" ? "게시 완료" : isPending ? "게시 중..." : "포스팅"}
                    </button>
                  )}
                  <button
                    onClick={() => copyToClipboard(xText)}
                    className="rounded-md border border-charcoal-700 px-3 py-1 text-xs text-charcoal-400 hover:text-charcoal-200"
                  >
                    복사
                  </button>
                  {results.x && results.x !== "posted" && (
                    <span className="self-center text-[10px] text-red-400">{results.x}</span>
                  )}
                </div>
              </div>

              {/* Facebook */}
              <div className="rounded-lg border border-charcoal-700 bg-charcoal-800/50 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-charcoal-200">Facebook</span>
                    {status?.facebook.connected ? (
                      <span className="text-[10px] text-emerald-400">{status.facebook.name} 연결됨</span>
                    ) : (
                      <a
                        href={`/api/facebook?return=${encodeURIComponent(`${username}/blog/${slug}/edit`)}`}
                        className="text-[10px] text-navy-400 hover:underline"
                      >
                        페이지 연결
                      </a>
                    )}
                  </div>
                </div>
                <textarea
                  value={fbText}
                  onChange={(e) => setFbText(e.target.value)}
                  rows={5}
                  className="mb-2 w-full resize-none rounded border border-charcoal-700 bg-charcoal-800 px-3 py-2 text-xs text-charcoal-200 focus:border-navy-500 focus:outline-none"
                />
                <div className="flex gap-2">
                  {status?.facebook.connected && (
                    <button
                      onClick={handlePostToFacebook}
                      disabled={isPending || !fbText.trim() || results.facebook === "posted"}
                      className="rounded-md bg-charcoal-700 px-3 py-1 text-xs font-medium text-charcoal-100 hover:bg-charcoal-600 disabled:opacity-50"
                    >
                      {results.facebook === "posted" ? "게시 완료" : isPending ? "게시 중..." : "포스팅"}
                    </button>
                  )}
                  <button
                    onClick={() => copyToClipboard(fbText)}
                    className="rounded-md border border-charcoal-700 px-3 py-1 text-xs text-charcoal-400 hover:text-charcoal-200"
                  >
                    복사
                  </button>
                  {results.facebook && results.facebook !== "posted" && (
                    <span className="self-center text-[10px] text-red-400">{results.facebook}</span>
                  )}
                </div>
              </div>

              {/* LinkedIn */}
              <div className="rounded-lg border border-charcoal-700 bg-charcoal-800/50 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-charcoal-200">LinkedIn</span>
                    {status?.linkedin.connected ? (
                      <span className="text-[10px] text-emerald-400">{status.linkedin.name} 연결됨</span>
                    ) : (
                      <a
                        href={`/api/linkedin?return=${encodeURIComponent(`${username}/blog/${slug}/edit`)}`}
                        className="text-[10px] text-navy-400 hover:underline"
                      >
                        계정 연결
                      </a>
                    )}
                  </div>
                </div>
                <textarea
                  value={liText}
                  onChange={(e) => setLiText(e.target.value)}
                  rows={5}
                  className="mb-2 w-full resize-none rounded border border-charcoal-700 bg-charcoal-800 px-3 py-2 text-xs text-charcoal-200 focus:border-navy-500 focus:outline-none"
                />
                <div className="flex gap-2">
                  {status?.linkedin.connected && (
                    <button
                      onClick={handlePostToLinkedIn}
                      disabled={isPending || !liText.trim() || results.linkedin === "posted"}
                      className="rounded-md bg-charcoal-700 px-3 py-1 text-xs font-medium text-charcoal-100 hover:bg-charcoal-600 disabled:opacity-50"
                    >
                      {results.linkedin === "posted" ? "게시 완료" : isPending ? "게시 중..." : "포스팅"}
                    </button>
                  )}
                  <button
                    onClick={() => copyToClipboard(liText)}
                    className="rounded-md border border-charcoal-700 px-3 py-1 text-xs text-charcoal-400 hover:text-charcoal-200"
                  >
                    복사
                  </button>
                  {results.linkedin && results.linkedin !== "posted" && (
                    <span className="self-center text-[10px] text-red-400">{results.linkedin}</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
