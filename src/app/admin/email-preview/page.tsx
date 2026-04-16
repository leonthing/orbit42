import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

// Templates are inlined here so the preview never triggers actual sends.
// Kept in sync with src/lib/email.ts — if you change an email template
// there, update the matching renderer below.

function renderWelcome(args: {
  username: string;
  displayName: string | null;
  inviterLabel: string | null;
  inviterUsername: string | null;
  siteUrl: string;
}) {
  const name = args.displayName || args.username;
  const profileUrl = `${args.siteUrl}/${args.username}`;
  const settingsUrl = `${args.siteUrl}/${args.username}/settings`;
  const calendarUrl = `${args.siteUrl}/${args.username}/calendar`;
  const slotsUrl = `${args.siteUrl}/${args.username}/slots`;
  const inviterLine =
    args.inviterLabel && args.inviterUsername
      ? `<p style="margin:0 0 4px;color:#555">${escapeHtml(args.inviterLabel)}님이 초대해주셨어요.</p>`
      : "";
  return `
    <div style="font-family:ui-sans-serif,system-ui,-apple-system;line-height:1.6;color:#111;max-width:520px">
      <h2 style="margin:0 0 12px;font-size:22px">${escapeHtml(name)}님, Orbit42에 오신 걸 환영해요 🌀</h2>
      ${inviterLine}
      <p style="margin:16px 0;color:#333">
        당신의 시간도, 타인의 시간도 가장 중요한 자산입니다.<br/>
        이제 그 시간을 공유하고, 교환하고, 판매할 수 있어요.
      </p>
      <p style="margin:16px 0 8px;font-weight:600;color:#111">먼저 시작해볼 3가지:</p>
      <ul style="margin:0 0 20px;padding-left:20px;color:#333">
        <li style="margin-bottom:6px">
          <a href="${settingsUrl}" style="color:#dc2626;font-weight:600">프로필 완성하기</a> —
          사진과 소개를 더하면 사람들이 더 잘 알아볼 수 있어요.
        </li>
        <li style="margin-bottom:6px">
          <a href="${calendarUrl}" style="color:#dc2626;font-weight:600">구글 캘린더 연동</a> —
          빈 시간을 자동으로 계산해서 예약 가능 시간으로 만들어줘요.
        </li>
        <li style="margin-bottom:6px">
          <a href="${slotsUrl}" style="color:#dc2626;font-weight:600">첫 미팅 슬롯 만들기</a> —
          30초면 당신의 시간에 가격표를 붙일 수 있어요.
        </li>
      </ul>
      <p style="margin:20px 0">
        <a href="${profileUrl}" style="display:inline-block;padding:10px 18px;border-radius:8px;background:#dc2626;color:#fff;text-decoration:none;font-weight:600">내 프로필 열기</a>
      </p>
      <p style="margin:24px 0 0;color:#888;font-size:13px">
        궁금한 점이 있으면 이 메일에 답장해주세요 —<br/>
        또는 <a href="mailto:connect@nthing.net" style="color:#888">connect@nthing.net</a>.
      </p>
    </div>
  `;
}

function renderInviteUsed(args: {
  inviteeLabel: string;
  inviteeUsername: string;
  siteUrl: string;
}) {
  const url = `${args.siteUrl}/${args.inviteeUsername}`;
  return `
    <div style="font-family:ui-sans-serif,system-ui,-apple-system;line-height:1.55;color:#111">
      <h2 style="margin:0 0 12px">${escapeHtml(args.inviteeLabel)}님이 가입했어요 🎉</h2>
      <p style="margin:0 0 12px;color:#333">
        당신의 초대 코드로 새로운 궤도가 생겼습니다. 인사 한 마디 남겨보세요.
      </p>
      <p style="margin:16px 0">
        <a href="${url}" style="display:inline-block;padding:10px 18px;border-radius:8px;background:#dc2626;color:#fff;text-decoration:none;font-weight:600">@${args.inviteeUsername} 프로필 열기</a>
      </p>
    </div>
  `;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[ch] as string);
}

const TEMPLATES: Record<
  string,
  { label: string; subject: string; render: (siteUrl: string) => string }
> = {
  welcome: {
    label: "Welcome (가입 직후)",
    subject: "Leon님, Orbit42에 오신 걸 환영해요",
    render: (siteUrl) =>
      renderWelcome({
        username: "leon",
        displayName: "Leon",
        inviterLabel: "Leo Kim",
        inviterUsername: "leokim5854",
        siteUrl,
      }),
  },
  invite_used: {
    label: "Invite used (초대한 사람에게)",
    subject: "[Orbit42] Leon님이 당신의 초대로 가입했어요",
    render: (siteUrl) =>
      renderInviteUsed({
        inviteeLabel: "Leon",
        inviteeUsername: "leon",
        siteUrl,
      }),
  },
};

export default async function EmailPreviewPage({
  searchParams,
}: {
  searchParams: { template?: string };
}) {
  const admin = await requireAdmin();
  if (!admin) redirect("/");

  const selected =
    searchParams.template && TEMPLATES[searchParams.template]
      ? searchParams.template
      : "welcome";
  const tpl = TEMPLATES[selected];
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://orbit42.org";
  const html = tpl.render(siteUrl);

  return (
    <div className="min-h-screen bg-[rgb(var(--bg-base))]">
      <div className="mx-auto max-w-4xl px-5 py-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-charcoal-500">
              Admin · Email preview
            </p>
            <h1 className="mt-1 text-xl font-bold text-charcoal-100">
              {tpl.label}
            </h1>
          </div>
          <Link
            href="/admin"
            className="text-xs text-charcoal-500 hover:text-charcoal-200"
          >
            ← 대시보드
          </Link>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {Object.entries(TEMPLATES).map(([key, t]) => (
            <Link
              key={key}
              href={`/admin/email-preview?template=${key}`}
              className={`rounded-full border px-3 py-1 text-xs ${
                key === selected
                  ? "border-red-500 bg-red-600/15 text-red-200"
                  : "border-charcoal-800/60 text-charcoal-400 hover:border-charcoal-700 hover:text-charcoal-100"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>

        <div className="mt-6 overflow-hidden rounded-xl border border-charcoal-800/60">
          <div className="border-b border-charcoal-800/60 bg-charcoal-900/40 px-4 py-2.5 text-[11px]">
            <p className="text-charcoal-500">
              From: Orbit42 &lt;noreply@mail.orbit42.org&gt;
            </p>
            <p className="text-charcoal-500">
              To: (수신자 이메일)
            </p>
            <p className="text-charcoal-200">
              Subject: {tpl.subject}
            </p>
          </div>
          <iframe
            title="Email preview"
            sandbox="allow-same-origin"
            srcDoc={`<html><body style="margin:0;background:#fff;padding:24px">${html}</body></html>`}
            className="h-[600px] w-full bg-white"
          />
        </div>

        <p className="mt-4 text-xs text-charcoal-500">
          샘플 데이터로 렌더링한 미리보기예요. 실제 발송은 안 돼요.
        </p>
      </div>
    </div>
  );
}
