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
  quoteBlock,
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

/** 시작 안내 한 줄 — 번호(회색) + 제목 링크 + 설명. 장식 배지 없음. */
function stepRow(n: number, href: string, title: string, desc: string): string {
  return `
    <tr>
      <td width="20" class="o-sub" style="vertical-align:top;padding:10px 8px 10px 0;font-family:${FONT};font-size:13px;line-height:1.5;color:#71717a">${n}</td>
      <td class="o-line" style="padding:10px 0;border-bottom:1px solid #e5e5ea">
        <a href="${href}" style="font-family:${FONT};font-size:15px;font-weight:600;color:#6366f1;text-decoration:none">${title}</a>
        <div class="o-sub" style="font-family:${FONT};font-size:13px;line-height:1.55;color:#71717a;margin-top:2px">${desc}</div>
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
      ? `${escapeHtml(args.inviterLabel)}님의 초대로 가입했어요. `
      : "") +
    "아래 세 가지부터 해 보세요.";
  const steps = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 0">
      ${stepRow(1, settingsUrl, "프로필 채우기", "사진과 소개를 넣으면 상대가 알아보기 쉬워요.")}
      ${stepRow(2, calendarUrl, "구글 캘린더 연결", "기존 일정과 겹치는 시간은 예약 링크에서 자동으로 빠져요.")}
      ${stepRow(3, slotsUrl, "예약 링크 만들기", "무엇을 · 얼마나 · 언제만 정하면 돼요.")}
    </table>`;
  return renderEmail({
    eyebrow: "환영합니다",
    heading: `${escapeHtml(name)}님, 가입을 환영해요`,
    intro,
    preheader: "Orbit42 가입을 환영해요",
    bodyHtml:
      steps +
      emailButton("내 프로필 열기", profileUrl) +
      mutedNote(
        `궁금한 점은 <a href="mailto:orbit42@nthing.net">orbit42@nthing.net</a>으로 알려 주세요.`,
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
    intro: "추천 링크로 가입해서 서로 팔로우로 연결됐어요.",
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
  location?: string | null;
  memo?: string | null;
  ctaLabel: string;
  ctaUrl: string;
  note: string;
}): string {
  const memo = args.memo?.trim();
  return renderEmail({
    eyebrow: "일정 초대",
    heading: `${escapeHtml(args.inviterName)}님이 일정에 초대했어요`,
    preheader: `${args.eventTitle} · ${args.when}`,
    bodyHtml:
      detailCard(escapeHtml(args.eventTitle), [
        { label: "일시", value: escapeHtml(args.when) },
        // 값이 비면 detailCard 가 줄 자체를 걸러낸다.
        { label: "장소", value: args.location ? escapeHtml(args.location) : "" },
        { label: "보낸 사람", value: escapeHtml(args.inviterName) },
      ]) +
      // 메모는 여러 줄일 수 있어 카드 행이 아니라 인용 블록으로 (pre-wrap).
      (memo ? quoteBlock(escapeHtml(memo)) : "") +
      emailButton(args.ctaLabel, args.ctaUrl) +
      mutedNote(args.note),
  });
}

/** 아직 가입하지 않은 사람에게 — 가입하면 초대한 사람과 연결된다. */
export function eventInviteBody(args: {
  inviterName: string;
  eventTitle: string;
  when: string;
  location?: string | null;
  memo?: string | null;
  refUsername: string;
}): string {
  return eventInviteShell({
    ...args,
    ctaLabel: "Orbit42에서 보기",
    ctaUrl: siteUrlFor(`/signup?ref=${encodeURIComponent(args.refUsername)}`),
    note: "Orbit42에 가입하면 이 일정을 내 캘린더에서 볼 수 있고, 초대한 사람과 연결돼요.",
  });
}

/** 이미 가입한 참석자에게 — 수락/거절은 앱에서. */
export function eventParticipantBody(args: {
  inviterName: string;
  eventTitle: string;
  when: string;
  location?: string | null;
  memo?: string | null;
  recipientUsername: string | null;
}): string {
  const settingsUrl = siteUrlFor(
    args.recipientUsername ? `/${args.recipientUsername}/settings` : "/calendar",
  );
  return eventInviteShell({
    ...args,
    ctaLabel: "캘린더에서 보기",
    ctaUrl: siteUrlFor("/calendar"),
    note: `수락하면 내 캘린더에도 보여요. 초대 메일은 <a href="${settingsUrl}">설정</a>에서 끌 수 있어요.`,
  });
}
