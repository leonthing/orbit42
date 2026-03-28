import Link from "next/link";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function LandingPage() {
  const session = await getSession();
  if (session) {
    redirect(`/${session.username}/dashboard`);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[rgb(var(--bg-base))]">
      <div className="text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-navy-600/20">
          <svg className="h-8 w-8 text-navy-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-charcoal-100">Orbit42</h1>
        <p className="mt-2 text-charcoal-500">Life Integration Platform</p>

        <div className="mt-10 flex gap-3">
          <Link
            href="/login"
            className="rounded-lg bg-navy-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-navy-500"
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="rounded-lg border border-charcoal-700 px-6 py-2.5 text-sm font-medium text-charcoal-300 hover:border-charcoal-600 hover:text-charcoal-100"
          >
            Sign Up
          </Link>
        </div>
      </div>
    </div>
  );
}
