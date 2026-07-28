import type { Metadata } from "next";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { getReferrerByUsername } from "@/lib/invite";
import { SignupForm } from "./SignupForm";

export const metadata: Metadata = { title: "가입 · Orbit42" };
export const dynamic = "force-dynamic";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: { ref?: string };
}) {
  const rawRef = (searchParams.ref ?? "")
    .trim()
    .replace(/^@/, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "");
  const referrer = rawRef ? await getReferrerByUsername(rawRef) : null;

  return (
    <div className="min-h-screen bg-[rgb(var(--bg-base))]">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-10 px-5 py-10 sm:py-16 md:flex-row md:items-center md:gap-16">
        {/* Left — invitation narrative */}
        <div className="flex-1 space-y-6">
          <Link
            href="/"
            className="inline-block text-sm font-semibold tracking-tight text-charcoal-100 hover:text-navy-400"
          >
            Orbit42
          </Link>

          {referrer ? (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <Avatar
                  url={referrer.avatar_url}
                  name={referrer.display_name || referrer.username}
                  size={48}
                />
                <div>
                  <p className="text-xs uppercase tracking-wider text-charcoal-500">
                    추천
                  </p>
                  <p className="text-sm font-semibold text-charcoal-100">
                    {referrer.display_name || referrer.username}
                    <span className="ml-1 font-normal text-charcoal-500">
                      @{referrer.username}
                    </span>
                  </p>
                </div>
              </div>

              <div>
                <h1 className="text-3xl font-bold leading-tight text-charcoal-100 sm:text-4xl">
                  @{referrer.username} 님이
                  <br />
                  당신을 Orbit42로
                  <br />
                  초대합니다
                </h1>
                <p className="mt-4 max-w-md text-sm leading-relaxed text-charcoal-400">
                  가입하면 자동으로 서로의 궤도가 되어 첫 연결이 만들어져요.
                  캘린더로 하루를 공유하고, 남는 시간을 슬롯으로 나누거나
                  팔아보세요.
                </p>
              </div>

              <InvitePerks />
            </div>
          ) : rawRef ? (
            <div className="space-y-5">
              <h1 className="text-3xl font-bold text-charcoal-100 sm:text-4xl">
                Orbit42에 오신 걸 환영해요
              </h1>
              <p className="max-w-md text-sm text-charcoal-400">
                @{rawRef} 라는 사용자를 찾지 못했어요. 그래도 바로 가입할 수
                있어요 — 지인에게 다시 아이디를 확인해보시거나, 아래 폼에서
                추천인을 비워두고 진행하세요.
              </p>
              <InvitePerks />
            </div>
          ) : (
            <div className="space-y-5">
              <h1 className="text-3xl font-bold leading-tight text-charcoal-100 sm:text-4xl">
                Orbit42에
                <br />
                오신 걸 환영해요
              </h1>
              <p className="max-w-md text-sm leading-relaxed text-charcoal-400">
                누구나 바로 가입할 수 있어요. 지인이 추천했다면 아래에 그분의
                @username 을 넣어주세요 — 가입과 동시에 자동으로 연결됩니다.
              </p>
              <InvitePerks />
            </div>
          )}
        </div>

        {/* Right — signup form */}
        <div className="w-full md:w-[380px]">
          <div className="rounded-2xl border border-charcoal-800 bg-charcoal-900/60 p-6 shadow-2xl backdrop-blur sm:p-7">
            <h2 className="mb-1 text-base font-semibold text-charcoal-100">
              {referrer ? "초대 수락" : "계정 만들기"}
            </h2>
            <p className="mb-5 text-xs text-charcoal-500">
              {referrer
                ? "몇 가지 정보만 입력하면 시작할 수 있어요."
                : "1분이면 가입할 수 있어요."}
            </p>
            <SignupForm initialRef={referrer?.username ?? ""} />
            <p className="mt-5 text-center text-xs text-charcoal-500">
              이미 계정이 있으신가요?{" "}
              <Link
                href="/?mode=signin#auth"
                className="text-navy-400 hover:text-navy-300"
              >
                로그인
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function InvitePerks() {
  const items = [
    {
      title: "캘린더로 일상 공유",
      body: "하루 일정을 친구·팔로워에게 열어두고 오르빗으로 연결돼요.",
    },
    {
      title: "시간을 슬롯으로 판매",
      body: "비어 있는 시간을 1:1 슬롯으로 열어 예약·수익 창출.",
    },
    {
      title: "무제한 추천",
      body: "@username 하나로 지인을 마음껏 초대할 수 있어요.",
    },
  ];
  return (
    <ul className="space-y-3">
      {items.map((i) => (
        <li key={i.title} className="flex gap-3">
          <span className="mt-1 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-navy-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-navy-400" />
          </span>
          <div>
            <p className="text-sm font-semibold text-charcoal-100">
              {i.title}
            </p>
            <p className="text-xs text-charcoal-500">{i.body}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
