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
