import Link from "next/link";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function LandingPage() {
  const session = await getSession();
  if (session) {
    redirect(`/${session.username}/calendar`);
  }

  return (
    <div className="min-h-screen bg-[rgb(var(--bg-base))]">
      <header className="flex items-center justify-between px-6 py-5 md:px-10">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy-600/20">
            <span className="text-sm font-bold text-navy-400">O</span>
          </div>
          <span className="text-base font-semibold text-charcoal-100">Orbit42</span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="rounded-lg px-4 py-2 text-sm text-charcoal-300 hover:text-charcoal-100"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="rounded-lg bg-navy-600 px-4 py-2 text-sm font-medium text-white hover:bg-navy-500"
          >
            Get started
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 pb-24 pt-20 text-center md:pt-32">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-navy-400">
          Time, shared
        </p>
        <h1 className="mt-5 text-4xl font-bold tracking-tight text-charcoal-100 md:text-6xl">
          Orbit around
          <br />
          <span className="text-navy-400">someone&apos;s time.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-charcoal-400 md:text-lg">
          캘린더로 일상을 공유하고, 관심 있는 사람의 궤도를 따라가세요.
          비어 있는 시간은 만남이 되고, 글이 되고, 새로운 연결이 됩니다.
        </p>

        <div className="mt-10 flex justify-center gap-3">
          <Link
            href="/signup"
            className="rounded-lg bg-navy-600 px-6 py-3 text-sm font-medium text-white hover:bg-navy-500"
          >
            Start your orbit
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-charcoal-700 px-6 py-3 text-sm font-medium text-charcoal-300 hover:border-charcoal-600 hover:text-charcoal-100"
          >
            Sign in
          </Link>
        </div>

        <div className="mx-auto mt-24 grid max-w-2xl gap-6 text-left md:grid-cols-3">
          <Feature
            title="Calendar"
            body="캘린더 단위, 이벤트 단위로 공개 범위를 정해 일상을 공유."
          />
          <Feature
            title="Slots"
            body="비어 있는 시간을 무료/유료 슬롯으로 열고 예약을 받기."
          />
          <Feature
            title="Orbits"
            body="관심 있는 사람을 팔로우하고 그들의 일정·글을 받아보기."
          />
        </div>
      </main>

      <footer className="border-t border-charcoal-800/40 px-6 py-6 text-center text-xs text-charcoal-600">
        © {new Date().getFullYear()} Orbit42
      </footer>
    </div>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-charcoal-800/40 bg-[rgb(var(--bg-surface))] p-5">
      <h3 className="text-sm font-semibold text-charcoal-100">{title}</h3>
      <p className="mt-2 text-xs leading-relaxed text-charcoal-400">{body}</p>
    </div>
  );
}
