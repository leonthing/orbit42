/**
 * Tiny, dependency-free markdown renderer for short user content
 * (feed posts, comments). Supports a small, safe subset:
 *   - **bold** *italic* ~~strike~~
 *   - `inline code`
 *   - [text](https://...) links (http/https/mailto only)
 *   - auto-linked URLs and mailto
 *   - \n preserved as <br/>
 *
 * Everything else is HTML-escaped. Output is a single <p>-safe HTML
 * string — no block elements, no raw HTML pass-through.
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeHref(url: string): string | null {
  const trimmed = url.trim();
  if (/^(https?:\/\/|mailto:)/i.test(trimmed)) return trimmed;
  return null;
}

export function renderInlineMarkdown(input: string): string {
  if (!input) return "";
  // Escape first, then apply markdown regex to escaped text so we don't
  // accidentally open an HTML-injection hole.
  let out = escapeHtml(input);

  // Explicit links: [text](url)
  out = out.replace(
    /\[([^\]]+)\]\(([^)\s]+)\)/g,
    (_m, text: string, url: string) => {
      const href = safeHref(url);
      if (!href) return _m;
      return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="text-red-400 underline hover:text-red-300">${text}</a>`;
    },
  );

  // Auto-link bare URLs (http/https). Skip ones already wrapped by the
  // explicit-link pass (crude check: preceded by '="').
  out = out.replace(
    /(^|[^"=>])(https?:\/\/[^\s<]+)/g,
    (_m, pre: string, url: string) =>
      `${pre}<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-red-400 underline hover:text-red-300">${url}</a>`,
  );

  // Inline code.
  out = out.replace(
    /`([^`\n]+)`/g,
    (_m, code: string) =>
      `<code class="rounded bg-charcoal-800/60 px-1 py-0.5 text-[0.9em] text-charcoal-100">${code}</code>`,
  );

  // Bold / italic / strike.
  out = out.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  out = out.replace(/~~([^~\n]+)~~/g, "<s>$1</s>");

  // Line breaks.
  out = out.replace(/\n/g, "<br/>");

  return out;
}
