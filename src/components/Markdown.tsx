import { renderInlineMarkdown } from "@/lib/markdown";

export function Markdown({
  body,
  className = "",
}: {
  body: string;
  className?: string;
}) {
  return (
    <p
      className={className}
      dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(body) }}
    />
  );
}
