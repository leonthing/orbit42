import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import {
  welcomeBody,
  welcomeSubject,
  inviteUsedBody,
  inviteUsedSubject,
  eventInviteBody,
  eventParticipantBody,
  eventInviteSubject,
} from "@/lib/email-templates";

export const dynamic = "force-dynamic";

const TEMPLATES: Record<
  string,
  { label: string; subject: string; html: string }
> = {
  welcome: (() => {
    const args = {
      username: "leon",
      displayName: "Leon",
      inviterLabel: "Leo Kim",
      inviterUsername: "leokim5854",
    };
    return {
      label: "Welcome (가입 직후)",
      subject: welcomeSubject(args.displayName),
      html: welcomeBody(args),
    };
  })(),
  invite_used: (() => {
    const args = { inviteeLabel: "Leon", inviteeUsername: "leon" };
    return {
      label: "Invite used (초대한 사람에게)",
      subject: inviteUsedSubject(args.inviteeLabel),
      html: inviteUsedBody(args),
    };
  })(),
  event_participant: (() => {
    const args = {
      inviterName: "Leo Kim",
      eventTitle: "제품 기획 리뷰",
      when: "8월 12일 화 오후 4:00",
      recipientUsername: "leon",
    };
    return {
      label: "Event invite (가입한 참석자)",
      subject: eventInviteSubject(args.eventTitle),
      html: eventParticipantBody(args),
    };
  })(),
  event_invite: (() => {
    const args = {
      inviterName: "Leo Kim",
      eventTitle: "제품 기획 리뷰",
      when: "8월 12일 화 오후 4:00",
      refUsername: "leokim5854",
    };
    return {
      label: "Event invite (미가입 이메일)",
      subject: eventInviteSubject(args.eventTitle),
      html: eventInviteBody(args),
    };
  })(),
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

  return (
    <div className="min-h-screen bg-[rgb(var(--bg-base))]">
      <div className="mx-auto max-w-4xl px-5 py-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xs font-semibold uppercase tracking-[0.18em] text-charcoal-500">
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
                  ? "border-navy-400 bg-navy-500/15 text-navy-200"
                  : "border-charcoal-800/60 text-charcoal-400 hover:border-charcoal-700 hover:text-charcoal-100"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>

        <div className="mt-6 overflow-hidden rounded-xl border border-charcoal-800/60">
          <div className="border-b border-charcoal-800/60 bg-charcoal-900/40 px-4 py-2.5 text-2xs">
            <p className="text-charcoal-500">
              From: Orbit42 &lt;noreply@mail.orbit42.org&gt;
            </p>
            <p className="text-charcoal-500">To: (수신자 이메일)</p>
            <p className="text-charcoal-200">Subject: {tpl.subject}</p>
          </div>
          <iframe
            title="Email preview"
            sandbox="allow-same-origin"
            srcDoc={`<html><body style="margin:0;background:#fff;padding:24px">${tpl.html}</body></html>`}
            className="h-[600px] w-full bg-white"
          />
        </div>

        <p className="mt-4 text-xs text-charcoal-500">
          프리뷰는 실제 발송 경로(`src/lib/email-templates.ts`)와 같은
          함수를 씁니다. 여기 보이는 그대로 이메일이 갑니다.
        </p>
      </div>
    </div>
  );
}
