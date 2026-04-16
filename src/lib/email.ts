import { Resend } from "resend";

const FROM =
  process.env.RESEND_FROM ||
  "Orbit42 <noreply@orbit42.org>";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://orbit42.org";

function client(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (process.env.NODE_ENV === "production") {
      // Don't silently no-op in production — a missing key means
      // verification / reset / booking mails aren't going out. Log loud.
      console.error(
        "[email] RESEND_API_KEY is not set in production. Transactional emails will NOT be delivered.",
      );
    }
    return null;
  }
  return new Resend(key);
}

async function send(to: string, subject: string, html: string) {
  const r = client();
  if (!r) {
    // Dev fallback — log so we don't lose the flow.
    console.warn("[email] RESEND_API_KEY not set; would have sent:", {
      to,
      subject,
    });
    console.warn(html);
    return { ok: true, dev: true };
  }
  try {
    await r.emails.send({ from: FROM, to, subject, html });
    return { ok: true };
  } catch (err) {
    console.error("resend send", err);
    return { ok: false };
  }
}

export function siteUrl(path: string) {
  return `${SITE_URL.replace(/\/$/, "")}${path}`;
}

export async function sendVerifyEmail(to: string, token: string) {
  const url = siteUrl(`/verify-email?token=${encodeURIComponent(token)}`);
  const html = `
    <div style="font-family:ui-sans-serif,system-ui,-apple-system;line-height:1.5;color:#111">
      <h2 style="margin:0 0 12px">Orbit42 이메일 확인</h2>
      <p>안녕하세요 — 아래 버튼을 눌러 이메일 주소를 확인해주세요.</p>
      <p style="margin:24px 0">
        <a href="${url}" style="display:inline-block;padding:10px 18px;border-radius:8px;background:#dc2626;color:#fff;text-decoration:none;font-weight:600">이메일 확인하기</a>
      </p>
      <p style="color:#555;font-size:13px">버튼이 안 되면 이 링크를 복사해서 붙여넣으세요:<br>${url}</p>
      <p style="color:#888;font-size:12px">링크는 24시간 동안 유효합니다.</p>
    </div>
  `;
  return send(to, "[Orbit42] 이메일 확인", html);
}

export async function sendBookingReceivedToHost(
  to: string,
  args: {
    slotTitle: string;
    when: string;
    guestLabel: string;
    guestEmail: string | null;
    message: string | null;
    autoApprove: boolean;
    manageUrl: string;
  },
) {
  const whenStr = new Date(args.when).toLocaleString("ko-KR", { timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  const url = siteUrl(args.manageUrl);
  const statusLine = args.autoApprove
    ? "자동 확정된 예약이에요."
    : "호스트 확인을 기다리는 예약입니다. 수락하거나 거절해주세요.";
  const html = `
    <div style="font-family:ui-sans-serif,system-ui,-apple-system;line-height:1.55;color:#111">
      <h2 style="margin:0 0 12px">새 예약이 도착했어요</h2>
      <p style="margin:0 0 6px"><b>${args.slotTitle}</b></p>
      <p style="margin:0 0 4px;color:#555">${whenStr}</p>
      <p style="margin:0 0 6px">게스트: ${args.guestLabel}${args.guestEmail ? ` · <a href="mailto:${args.guestEmail}">${args.guestEmail}</a>` : ""}</p>
      ${args.message ? `<blockquote style="margin:12px 0;padding:10px 14px;border-left:3px solid #e5e5e5;color:#444">${escapeHtml(args.message)}</blockquote>` : ""}
      <p style="margin:16px 0;color:#555;font-size:13px">${statusLine}</p>
      <p style="margin:16px 0">
        <a href="${url}" style="display:inline-block;padding:10px 18px;border-radius:8px;background:#dc2626;color:#fff;text-decoration:none;font-weight:600">예약 관리하기</a>
      </p>
    </div>
  `;
  return send(to, `[Orbit42] 새 예약: ${args.slotTitle}`, html);
}

export async function sendBookingConfirmedToGuest(
  to: string,
  args: { slotTitle: string; when: string; hostLabel: string; location: string | null },
) {
  const whenStr = new Date(args.when).toLocaleString("ko-KR", { timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  const html = `
    <div style="font-family:ui-sans-serif,system-ui,-apple-system;line-height:1.55;color:#111">
      <h2 style="margin:0 0 12px">예약이 확정되었어요</h2>
      <p style="margin:0 0 6px"><b>${args.slotTitle}</b> · ${args.hostLabel}</p>
      <p style="margin:0 0 4px;color:#555">${whenStr}</p>
      ${args.location ? `<p style="margin:0 0 4px;color:#555">📍 ${escapeHtml(args.location)}</p>` : ""}
      <p style="margin:16px 0;color:#555;font-size:13px">일정에 맞춰 찾아뵐게요. 변경이 필요하면 호스트에게 미리 알려주세요.</p>
    </div>
  `;
  return send(to, `[Orbit42] 예약 확정: ${args.slotTitle}`, html);
}

export async function sendBookingCanceledToGuest(
  to: string,
  args: { slotTitle: string; when: string; hostLabel: string },
) {
  const whenStr = new Date(args.when).toLocaleString("ko-KR", { timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  const html = `
    <div style="font-family:ui-sans-serif,system-ui,-apple-system;line-height:1.55;color:#111">
      <h2 style="margin:0 0 12px">예약이 취소되었어요</h2>
      <p style="margin:0 0 6px"><b>${args.slotTitle}</b> · ${args.hostLabel}</p>
      <p style="margin:0 0 4px;color:#555">${whenStr}</p>
      <p style="margin:16px 0;color:#555;font-size:13px">불편을 드려 죄송해요. 다른 시간을 원하시면 Orbit42에서 다시 예약해주세요.</p>
    </div>
  `;
  return send(to, `[Orbit42] 예약 취소: ${args.slotTitle}`, html);
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

export async function sendNewMessageEmail(
  to: string,
  args: { fromLabel: string; preview: string; conversationId: string },
) {
  const url = siteUrl(`/messages/${args.conversationId}`);
  const html = `
    <div style="font-family:ui-sans-serif,system-ui,-apple-system;line-height:1.55;color:#111">
      <h2 style="margin:0 0 12px">${escapeHtml(args.fromLabel)}님이 메시지를 보냈어요</h2>
      <blockquote style="margin:12px 0;padding:10px 14px;border-left:3px solid #e5e5e5;color:#444">${escapeHtml(args.preview)}</blockquote>
      <p style="margin:16px 0">
        <a href="${url}" style="display:inline-block;padding:10px 18px;border-radius:8px;background:#dc2626;color:#fff;text-decoration:none;font-weight:600">대화 열기</a>
      </p>
      <p style="color:#888;font-size:12px">알림은 10분 간격으로 묶어서 보내드려요.</p>
    </div>
  `;
  return send(to, `[Orbit42] ${args.fromLabel}님의 새 메시지`, html);
}

export async function sendWelcomeEmail(
  to: string,
  args: {
    username: string;
    displayName: string | null;
    inviterLabel: string | null;
    inviterUsername: string | null;
  },
) {
  const name = args.displayName || args.username;
  const profileUrl = siteUrl(`/${args.username}`);
  const settingsUrl = siteUrl(`/${args.username}/settings`);
  const calendarUrl = siteUrl(`/${args.username}/calendar`);
  const slotsUrl = siteUrl(`/${args.username}/slots`);
  const inviterLine =
    args.inviterLabel && args.inviterUsername
      ? `<p style="margin:0 0 4px;color:#555">${escapeHtml(args.inviterLabel)}님이 초대해주셨어요.</p>`
      : "";
  const html = `
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
  return send(to, `${name}님, Orbit42에 오신 걸 환영해요`, html);
}

export async function sendInviteUsedEmail(
  to: string,
  args: { inviteeLabel: string; inviteeUsername: string },
) {
  const url = siteUrl(`/${args.inviteeUsername}`);
  const html = `
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
  return send(to, `[Orbit42] ${args.inviteeLabel}님이 당신의 초대로 가입했어요`, html);
}

export async function sendPasswordResetEmail(to: string, token: string) {
  const url = siteUrl(`/reset-password?token=${encodeURIComponent(token)}`);
  const html = `
    <div style="font-family:ui-sans-serif,system-ui,-apple-system;line-height:1.5;color:#111">
      <h2 style="margin:0 0 12px">Orbit42 비밀번호 재설정</h2>
      <p>비밀번호 재설정을 요청하셨다면 아래 버튼을 눌러주세요. 요청하지 않았다면 이 메일을 무시해도 됩니다.</p>
      <p style="margin:24px 0">
        <a href="${url}" style="display:inline-block;padding:10px 18px;border-radius:8px;background:#dc2626;color:#fff;text-decoration:none;font-weight:600">비밀번호 재설정</a>
      </p>
      <p style="color:#555;font-size:13px">버튼이 안 되면 이 링크를 복사해서 붙여넣으세요:<br>${url}</p>
      <p style="color:#888;font-size:12px">링크는 1시간 동안 유효합니다.</p>
    </div>
  `;
  return send(to, "[Orbit42] 비밀번호 재설정", html);
}
