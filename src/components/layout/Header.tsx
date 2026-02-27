"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { NAV_LINKS, SITE } from "@/lib/constants";
import { ThemeToggle } from "./ThemeToggle";

export function Header() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-charcoal-200 bg-white/80 backdrop-blur-md dark:border-charcoal-800 dark:bg-charcoal-950/80">
      <nav className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <Link
          href="/"
          className="text-xl font-bold text-charcoal-900 dark:text-charcoal-100"
        >
          {SITE.title}
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-lg px-3 py-2 text-sm transition-colors ${
                pathname === link.href ||
                (link.href !== "/" && pathname.startsWith(link.href))
                  ? "bg-navy-50 font-medium text-navy-700 dark:bg-navy-950 dark:text-navy-300"
                  : "text-charcoal-600 hover:bg-charcoal-100 hover:text-charcoal-900 dark:text-charcoal-400 dark:hover:bg-charcoal-800 dark:hover:text-charcoal-100"
              }`}
            >
              {link.label}
            </Link>
          ))}
          <ThemeToggle />
        </div>

        {/* Mobile menu button */}
        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="rounded-lg p-2 text-charcoal-600 hover:bg-charcoal-100 dark:text-charcoal-400 dark:hover:bg-charcoal-800"
            aria-label="메뉴 열기"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              {mobileOpen ? (
                <path d="M18 6 6 18M6 6l12 12" />
              ) : (
                <>
                  <path d="M4 12h16" />
                  <path d="M4 6h16" />
                  <path d="M4 18h16" />
                </>
              )}
            </svg>
          </button>
        </div>
      </nav>

      {/* Mobile nav */}
      {mobileOpen && (
        <div className="border-t border-charcoal-200 px-4 pb-3 dark:border-charcoal-800 md:hidden">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                pathname === link.href ||
                (link.href !== "/" && pathname.startsWith(link.href))
                  ? "bg-navy-50 font-medium text-navy-700 dark:bg-navy-950 dark:text-navy-300"
                  : "text-charcoal-600 hover:bg-charcoal-100 dark:text-charcoal-400 dark:hover:bg-charcoal-800"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
