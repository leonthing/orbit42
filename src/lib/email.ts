import { Resend } from "resend";

const FROM =
  process.env.RESEND_FROM ||
  "Orbit42 <noreply@orbit42.org>";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://orbit42.org";

function client(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
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
