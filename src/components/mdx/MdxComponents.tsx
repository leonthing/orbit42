import type { MDXComponents } from "mdx/types";
import Link from "next/link";

export const MdxComponents: MDXComponents = {
  h1: ({ children, ...props }) => (
    <h1
      className="mt-8 scroll-m-20 text-3xl font-bold tracking-tight"
      {...props}
    >
      {children}
    </h1>
  ),
  h2: ({ children, ...props }) => (
    <h2
      className="mt-8 scroll-m-20 text-2xl font-semibold tracking-tight first:mt-0"
      {...props}
    >
      {children}
    </h2>
  ),
  h3: ({ children, ...props }) => (
    <h3
      className="mt-6 scroll-m-20 text-xl font-semibold tracking-tight"
      {...props}
    >
      {children}
    </h3>
  ),
  a: ({ href, children, ...props }) => {
    if (href?.startsWith("/")) {
      return (
        <Link href={href} className="text-navy-600 hover:text-navy-500 dark:text-navy-400 dark:hover:text-navy-300 underline underline-offset-4" {...props}>
          {children}
        </Link>
      );
    }
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-navy-600 hover:text-navy-500 dark:text-navy-400 dark:hover:text-navy-300 underline underline-offset-4"
        {...props}
      >
        {children}
      </a>
    );
  },
  img: ({ src, alt }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src || ""}
      alt={alt || ""}
      className="rounded-lg"
      loading="lazy"
    />
  ),
  blockquote: ({ children, ...props }) => (
    <blockquote
      className="mt-4 border-l-4 border-navy-500 pl-4 italic text-charcoal-600 dark:text-charcoal-400"
      {...props}
    >
      {children}
    </blockquote>
  ),
  table: ({ children, ...props }) => (
    <div className="my-4 overflow-x-auto">
      <table className="w-full border-collapse text-sm" {...props}>
        {children}
      </table>
    </div>
  ),
  th: ({ children, ...props }) => (
    <th
      className="border border-charcoal-200 bg-charcoal-50 px-4 py-2 text-left font-semibold dark:border-charcoal-700 dark:bg-charcoal-800"
      {...props}
    >
      {children}
    </th>
  ),
  td: ({ children, ...props }) => (
    <td
      className="border border-charcoal-200 px-4 py-2 dark:border-charcoal-700"
      {...props}
    >
      {children}
    </td>
  ),
};
