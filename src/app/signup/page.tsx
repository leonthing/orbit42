import type { Metadata } from "next";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { getInviterByCode } from "@/lib/invite";
import { SignupForm } from "./SignupForm";

export const metadata: Metadata = { title: "초대장 · Orbit42" };
export const dynamic = "force-dynamic";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: { code?: string };
}) {
  // Sanitize: chat apps sometimes bundle our whole invite message into
  // ?code=, so pick off just the first 8 alphanumerics.
  const rawCode = (searchParams.code ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);
  const invite = rawCode ? await getInviterByCode(rawCode) : null;
  const validInvite = invite?.status === "ok";

  return (
    <div className="min-h-screen bg-[rgb(var(--bg-base))]">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-10 px-5 py-10 sm:py-16 md:flex-row md:items-center md:gap-16">
        {/* Left — invitation narrative */}
        <div className="flex-1 space-y-6">
          <Link
            href="/"
            className="inline-block text-sm font-semibold tracking-tight text-charcoal-100 hover:text-red-400"
          >
            Orbit42
          </Link>

          {validInvite && invite?.inviter ? (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <Avatar
                  url={invite.inviter.avatar_url}
                  name={invite.inviter.display_name || invite.inviter.username}
                  size={48}
                />
                <div>
                  <p className="text-xs uppercase tracking-wider text-charcoal-500">
                    초대장
                  </p>
                  <p className="text-sm font-semibold text-charcoal-100">
                    {invite.inviter.display_name || invite.inviter.username}
                    <span className="ml-1 font-normal text-charcoal-500">
                      @{invite.inviter.username}
                    </span>
                  </p>
                </div>
              </div>

              <div>
                <h1 className="text-3xl font-bold leading-tight text-charcoal-100 sm:text-4xl">
                  당신을 Orbit42에
                  <br />
                  초대합니다
                </h1>
                <p className="mt-4 max-w-md text-sm leading-relaxed text-charcoal-400">
                  시간은 가장 중요한 자산입니다. 캘린더로 하루를 공유하고,
                  비어 있는 시간을 슬롯으로 판매하여 수익을 만드세요.
                </p>
              </div>

              <InvitePerks />

              <div className="rounded-xl border border-charcoal-800/60 bg-charcoal-900/30 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-charcoal-500">
                  초대 코드
                </p>
                <p className="mt-1 font-mono text-2xl font-bold tracking-wider text-charcoal-100">
                  {invite.code}
                </p>
              </div>
            </div>
          ) : invite?.status === "used" ? (
            <div className="space-y-5">
              <h1 className="text-3xl font-bold text-charcoal-100 sm:text-4xl">
                이미 사용된 추천 코드
              </h1>
              <p className="max-w-md text-sm text-charcoal-400">
                이 코드는 이미 누군가 사용했어요. 그래도 바로 가입할 수
                있어요 — 아래 폼에서 코드를 비워두고 진행하세요.
              </p>
              <InvitePerks />
            </div>
          ) : invite?.status === "invalid" ? (
            <div className="space-y-5">
              <h1 className="text-3xl font-bold text-charcoal-100 sm:text-4xl">
                Orbit42에 오신 걸 환영해요
              </h1>
              <p className="max-w-md text-sm text-charcoal-400">
                링크에 포함된 추천 코드를 찾지 못했지만, 그냥 가입해도
                괜찮아요. 지인에게 받은 코드가 있다면 아래에 입력하세요.
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
                누구나 바로 가입할 수 있어요. 지인에게 추천 코드를 받으셨다면
                아래에 입력해주세요 — 초대한 분과 자동으로 연결돼요.
              </p>
              <InvitePerks />
            </div>
          )}
        </div>

        {/* Right — signup form */}
        <div className="w-full md:w-[380px]">
          <div className="rounded-2xl border border-charcoal-800 bg-charcoal-900/60 p-6 shadow-2xl backdrop-blur sm:p-7">
            <h2 className="mb-1 text-base font-semibold text-charcoal-100">
              {validInvite ? "초대 수락" : "계정 만들기"}
            </h2>
            <p className="mb-5 text-xs text-charcoal-500">
              {validInvite
                ? "몇 가지 정보만 입력하면 시작할 수 있어요."
                : "1분이면 가입할 수 있어요."}
            </p>
            <SignupForm initialCode={rawCode} />
            <p className="mt-5 text-center text-xs text-charcoal-500">
              이미 계정이 있으신가요?{" "}
              <Link
                href="/?mode=signin#auth"
                className="text-red-400 hover:text-red-300"
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
      title: "초대 3장",
      body: "가입하면 지인 3명을 초대할 수 있는 코드가 자동 발급돼요.",
    },
  ];
  return (
    <ul className="space-y-3">
      {items.map((i) => (
        <li key={i.title} className="flex gap-3">
          <span className="mt-1 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-red-600/20">
            <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
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
