import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";

/**
 * 글 본문 렌더러(1.10.0, 웹 공용) — 가벼운 마크다운만 그린다.
 * 그리는 것: 소제목(# ~ ###은 모두 소제목 하나로), 굵게·기울임·취소선, 목록, 인용, 링크, 주소 자동 링크, 문단·줄바꿈.
 * 그리지 않는 것: HTML 태그(태그는 빼고 사이 글자만 남김), 본문 이미지, 코드 블록, 표, 구분선 — 안의 글자만 남긴다.
 * iOS(PostBodyView)도 같은 규칙. 샘플 대조: 업무기록/캡처_1.10.0_기본기.
 */
const ALLOWED = ["p", "br", "h2", "strong", "em", "del", "ul", "ol", "li", "a", "blockquote"];

const components: Components = {
  h2: ({ children }) => <h2 className="mt-5 text-base font-bold text-charcoal-50 first:mt-0">{children}</h2>,
  p: ({ children }) => <p className="my-3 first:mt-0 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="my-3 list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="my-3 list-decimal space-y-1 pl-5">{children}</ol>,
  blockquote: ({ children }) => <blockquote className="my-3 border-l-2 border-charcoal-600 pl-3 text-charcoal-300">{children}</blockquote>,
  strong: ({ children }) => <strong className="font-semibold text-charcoal-50">{children}</strong>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="nofollow ugc noopener noreferrer" className="text-navy-600 underline underline-offset-2 hover:text-navy-500 dark:text-navy-300 dark:hover:text-navy-200">
      {children}
    </a>
  ),
};

/** # / ## / ### 를 모두 소제목(h2) 하나로 */
function headingToH2() {
  return (tree: { children?: unknown[] }) => {
    const walk = (n: { type?: string; tagName?: string; children?: unknown[] }) => {
      if (n.type === "element" && n.tagName && /^h[1-6]$/.test(n.tagName)) n.tagName = "h2";
      (n.children as (typeof n)[] | undefined)?.forEach(walk);
    };
    walk(tree as never);
  };
}

export function PostBody({ text, className = "" }: { text: string; className?: string }) {
  if (!text.trim()) return null;
  return (
    <div className={`text-sm leading-relaxed text-charcoal-100 [overflow-wrap:anywhere] ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        rehypePlugins={[headingToH2]}
        allowedElements={ALLOWED}
        unwrapDisallowed
        skipHtml
        components={components}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
