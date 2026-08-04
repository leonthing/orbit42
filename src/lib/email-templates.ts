/**
 * Pure HTML renderers for every transactional email. Kept separate from
 * the send layer so the admin preview and the real delivery path share
 * the exact same markup. Uses the shared Orbit42 email shell.
 */

import {
  renderEmail,
  emailButton,
  mutedNote,
  detailCard,
} from "@/lib/email-layout";

const FONT =
  "-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Pretendard',Roboto,'Segoe UI',sans-serif";

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[ch] as string);
}

function siteUrlFor(path: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://orbit42.org";
  return `${base.replace(/\/$/, "")}${path}`;
}

/** Numbered onboarding step row (red badge + linked title + description). */
function stepRow(n: number, href: string, title: string, desc: string): string {
  return `
    <tr>
      <td width="28" style="vertical-align:top;padding:11px 12px 11px 0">
        <div style="width:24px;height:24px;border-radius:12px;background:#fef2f2;color:#dc2626;font-family:${FONT};font-size:13px;font-weight:800;text-align:center;line-height:24px">${n}</div>
      </td>
      <td style="padding:11px 0;border-bottom:1px solid #f0f0f0">
        <a href="${href}" style="font-family:${FONT};font-size:15px;font-weight:700;color:#dc2626;text-decoration:none">${title}</a>
        <div style="font-family:${FONT};font-size:13px;line-height:1.55;color:#71717a;margin-top:3px">${desc}</div>
      </td>
    </tr>`;
}

// --- Welcome --------------------------------------------------------------

export function welcomeSubject(displayName: string): string {
  return `${displayName}님, Orbit42에 오신 걸 환영해요`;
}

export function welcomeBody(args: {
  username: string;
  displayName: string | null;
  inviterLabel: string | null;
  inviterUsername: string | null;
}): string {
  const name = args.displayName || args.username;
  const profileUrl = siteUrlFor(`/${args.username}`);
  const settingsUrl = siteUrlFor(`/${args.username}/settings`);
  const calendarUrl = siteUrlFor(`/${args.username}/calendar`);
  const slotsUrl = siteUrlFor(`/${args.username}/slots`);
  const intro =
    (args.inviterLabel && args.inviterUsername
      ? `${escapeHtml(args.inviterLabel)}님이 초대해주셨어요. `
      : "") +
    "당신의 시간도, 타인의 시간도 가장 중요한 자산이에요 — 이제 공유하고, 교환하고, 판매할 수 있어요.";
  const steps = `
    <p style="margin:24px 0 6px;font-family:${FONT};font-size:14px;font-weight:800;color:#18181b">먼저 시작해볼 3가지</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${stepRow(1, settingsUrl, "프로필 완성하기", "사진과 소개를 더하면 사람들이 더 잘 알아볼 수 있어요.")}
      ${stepRow(2, calendarUrl, "구글 캘린더 연동", "빈 시간을 자동으로 계산해 예약 가능 시간으로 만들어줘요.")}
      ${stepRow(3, slotsUrl, "첫 미팅 슬롯 만들기", "30초면 당신의 시간에 가격표를 붙일 수 있어요.")}
    </table>`;
  return renderEmail({
    eyebrow: "환영합니다",
    heading: `${escapeHtml(name)}님, Orbit42에 오신 걸 환영해요`,
    intro,
    preheader: "Orbit42에 오신 걸 환영해요 — 3가지로 시작해보세요.",
    bodyHtml:
      steps +
      emailButton("내 프로필 열기", profileUrl) +
      mutedNote(
        `궁금한 점이 있으면 이 메일에 답장하거나 <a href="mailto:orbit42@nthing.net">orbit42@nthing.net</a>으로 알려주세요.`,
      ),
  });
}

// --- Invite used ----------------------------------------------------------

export function inviteUsedSubject(inviteeLabel: string): string {
  return `[Orbit42] ${inviteeLabel}님이 당신의 초대로 가입했어요`;
}

export function inviteUsedBody(args: {
  inviteeLabel: string;
  inviteeUsername: string;
}): string {
  const url = siteUrlFor(`/${args.inviteeUsername}`);
  return renderEmail({
    eyebrow: "초대 성공",
    heading: `${escapeHtml(args.inviteeLabel)}님이 가입했어요`,
    intro: "당신의 추천으로 새로운 궤도가 생겼어요. 인사 한 마디 남겨보세요.",
    preheader: `${args.inviteeLabel}님이 당신의 초대로 가입했어요`,
    bodyHtml: emailButton(
      `@${escapeHtml(args.inviteeUsername)} 프로필 열기`,
      url,
    ),
  });
}

export function eventInviteSubject(eventTitle: string): string {
  return `[Orbit42] 일정 초대: ${eventTitle}`;
}

/** 일정 초대 메일 공통 골격 — 가입자/미가입자가 CTA와 안내만 다르다. */
function eventInviteShell(args: {
  inviterName: string;
  eventTitle: string;
  when: string;
  ctaLabel: string;
  ctaUrl: string;
  note: string;
}): string {
  return renderEmail({
    eyebrow: "일정 초대",
    heading: `${escapeHtml(args.inviterName)}님이 일정에 초대했어요`,
    preheader: `${args.eventTitle} · ${args.when}`,
    bodyHtml:
      detailCard(escapeHtml(args.eventTitle), [
        { label: "일시", value: escapeHtml(args.when), strong: true },
        { label: "보낸 사람", value: escapeHtml(args.inviterName) },
      ]) +
      emailButton(args.ctaLabel, args.ctaUrl) +
      mutedNote(args.note),
  });
}

/** 아직 가입하지 않은 사람에게 — 가입하면 초대한 사람과 연결된다. */
export function eventInviteBody(args: {
  inviterName: string;
  eventTitle: string;
  when: string;
  refUsername: string;
}): string {
  return eventInviteShell({
    ...args,
    ctaLabel: "Orbit42에서 확인하기",
    ctaUrl: siteUrlFor(`/signup?ref=${encodeURIComponent(args.refUsername)}`),
    note: "Orbit42는 시간을 자산으로 만드는 캘린더예요. 가입하면 초대한 사람과 자동으로 연결돼요.",
  });
}

/** 이미 가입한 참석자에게 — 수락/거절은 앱에서. */
export function eventParticipantBody(args: {
  inviterName: string;
  eventTitle: string;
  when: string;
  recipientUsername: string | null;
}): string {
  const settingsUrl = siteUrlFor(
    args.recipientUsername ? `/${args.recipientUsername}/settings` : "/calendar",
  );
  return eventInviteShell({
    ...args,
    ctaLabel: "캘린더에서 수락하기",
    ctaUrl: siteUrlFor("/calendar"),
    note: `수락하면 내 캘린더에도 이 일정이 표시돼요. 초대 메일은 <a href="${settingsUrl}">설정</a>에서 끌 수 있어요.`,
  });
}
