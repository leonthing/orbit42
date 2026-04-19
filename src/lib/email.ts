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
  const { welcomeBody, welcomeSubject } = await import("@/lib/email-templates");
  const name = args.displayName || args.username;
  return send(to, welcomeSubject(name), welcomeBody(args));
}

export async function sendInviteUsedEmail(
  to: string,
  args: { inviteeLabel: string; inviteeUsername: string },
) {
  const { inviteUsedBody, inviteUsedSubject } = await import(
    "@/lib/email-templates"
  );
  return send(to, inviteUsedSubject(args.inviteeLabel), inviteUsedBody(args));
}

export async function sendFeedbackEmail(args: {
  body: string;
  from: {
    username: string | null;
    displayName: string | null;
    email: string | null;
  };
  path: string | null;
}) {
  const to = process.env.FEEDBACK_EMAIL || "connect@nthing.net";
  const label = args.from.displayName || args.from.username || "익명";
  const suffix = args.from.username ? ` (@${args.from.username})` : "";
  const emailLine = args.from.email
    ? `<p style="margin:0;color:#555;font-size:13px">회신 주소: <a href="mailto:${escapeHtml(args.from.email)}">${escapeHtml(args.from.email)}</a></p>`
    : "";
  const pathLine = args.path
    ? `<p style="margin:0;color:#888;font-size:12px">경로: ${escapeHtml(args.path)}</p>`
    : "";
  const html = `
    <div style="font-family:ui-sans-serif,system-ui,-apple-system;line-height:1.55;color:#111">
      <h2 style="margin:0 0 12px">Orbit42 피드백이 도착했어요</h2>
      <p style="margin:0 0 4px"><b>${escapeHtml(label)}</b>${escapeHtml(suffix)}</p>
      ${emailLine}
      ${pathLine}
      <blockquote style="margin:16px 0;padding:12px 16px;border-left:3px solid #e5e5e5;color:#222;white-space:pre-wrap">${escapeHtml(args.body)}</blockquote>
      <p style="margin:16px 0">
        <a href="${siteUrl("/admin/feedback")}" style="display:inline-block;padding:10px 18px;border-radius:8px;background:#dc2626;color:#fff;text-decoration:none;font-weight:600">어드민에서 열기</a>
      </p>
    </div>
  `;
  const replyTo = args.from.email || undefined;
  const subject = `[Orbit42] 피드백: ${label}${suffix}`;
  const r = client();
  if (!r) {
    console.warn("[email] feedback would have been sent:", { to, subject });
    console.warn(html);
    return { ok: true, dev: true };
  }
  try {
    await r.emails.send({
      from: FROM,
      to,
      subject,
      html,
      replyTo,
    });
    return { ok: true };
  } catch (err) {
    console.error("resend feedback", err);
    return { ok: false };
  }
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
