/**
 * Pure HTML renderers for every transactional email. Kept separate from
 * the send layer so the admin preview and the real delivery path share
 * the exact same markup.
 */

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

// --- Invite used ----------------------------------------------------------

export function inviteUsedSubject(inviteeLabel: string): string {
  return `[Orbit42] ${inviteeLabel}님이 당신의 초대로 가입했어요`;
}

export function inviteUsedBody(args: {
  inviteeLabel: string;
  inviteeUsername: string;
}): string {
  const url = siteUrlFor(`/${args.inviteeUsername}`);
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
