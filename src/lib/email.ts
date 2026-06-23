import { Resend } from "resend";
import {
  renderEmail,
  emailButton,
  detailCard,
  quoteBlock,
  mutedNote,
  escapeHtml,
} from "@/lib/email-layout";

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

/** Korean KST long date/time, e.g. "2026년 6월 27일 토 오후 4:00". */
function fmtWhen(when: string) {
  return new Date(when).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function sendVerifyEmail(to: string, token: string) {
  const url = siteUrl(`/verify-email?token=${encodeURIComponent(token)}`);
  const html = renderEmail({
    eyebrow: "이메일 인증",
    heading: "이메일 주소를 확인해주세요",
    intro: "아래 버튼을 눌러 Orbit42 가입을 완료하세요.",
    preheader: "Orbit42 이메일 인증 — 24시간 내에 확인해주세요.",
    bodyHtml:
      emailButton("이메일 확인하기", url) +
      mutedNote(
        `버튼이 안 되면 이 링크를 복사해 붙여넣으세요:<br><a href="${url}">${url}</a>`,
      ) +
      mutedNote("링크는 24시간 동안 유효합니다."),
  });
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
  const url = siteUrl(args.manageUrl);
  const guestValue =
    escapeHtml(args.guestLabel) +
    (args.guestEmail
      ? ` · <a href="mailto:${escapeHtml(args.guestEmail)}">${escapeHtml(args.guestEmail)}</a>`
      : "");
  const html = renderEmail({
    eyebrow: args.autoApprove ? "새 예약" : "예약 요청",
    heading: args.autoApprove
      ? "새 예약이 확정됐어요"
      : "새 예약 요청이 도착했어요",
    preheader: `${args.slotTitle} · ${fmtWhen(args.when)}`,
    bodyHtml:
      detailCard(escapeHtml(args.slotTitle), [
        { label: "일시", value: fmtWhen(args.when), strong: true },
        { label: "게스트", value: guestValue },
      ]) +
      (args.message ? quoteBlock(escapeHtml(args.message)) : "") +
      emailButton("예약 관리하기", url) +
      mutedNote(
        args.autoApprove
          ? "자동으로 확정된 예약이에요. 캘린더에서 확인하실 수 있어요."
          : "호스트 확인을 기다리는 예약입니다. 수락하거나 거절해주세요.",
      ),
  });
  return send(to, `[Orbit42] 새 예약: ${args.slotTitle}`, html);
}

export async function sendBookingConfirmedToGuest(
  to: string,
  args: { slotTitle: string; when: string; hostLabel: string; location: string | null },
) {
  const html = renderEmail({
    eyebrow: "예약 확정",
    heading: "예약이 확정됐어요",
    intro: `${escapeHtml(args.hostLabel)}님과의 일정이 확정되었어요.`,
    preheader: `${args.slotTitle} · ${fmtWhen(args.when)}`,
    bodyHtml:
      detailCard(escapeHtml(args.slotTitle), [
        { label: "호스트", value: escapeHtml(args.hostLabel) },
        { label: "일시", value: fmtWhen(args.when), strong: true },
        { label: "장소", value: args.location ? escapeHtml(args.location) : "" },
      ]) +
      emailButton("내 예약 보기", siteUrl("/bookings")) +
      mutedNote(
        "일정에 맞춰 찾아뵐게요. 변경이 필요하면 호스트에게 미리 알려주세요.",
      ),
  });
  return send(to, `[Orbit42] 예약 확정: ${args.slotTitle}`, html);
}

export async function sendBookingReminderEmail(
  to: string,
  args: {
    role: "host" | "guest";
    slotTitle: string;
    when: string;
    otherLabel: string;
    location: string | null;
    manageUrl: string;
  },
) {
  const html = renderEmail({
    eyebrow: "리마인더",
    heading: "내일 예약이 있어요",
    preheader: `${args.slotTitle} · ${fmtWhen(args.when)}`,
    bodyHtml:
      detailCard(escapeHtml(args.slotTitle), [
        { label: "일시", value: fmtWhen(args.when), strong: true },
        {
          label: args.role === "host" ? "게스트" : "호스트",
          value: escapeHtml(args.otherLabel),
        },
        { label: "장소", value: args.location ? escapeHtml(args.location) : "" },
      ]) +
      emailButton("예약 확인하기", siteUrl(args.manageUrl)) +
      mutedNote("일정 변경이 필요하면 미리 상대방에게 알려주세요."),
  });
  return send(to, `[Orbit42] 내일 예약: ${args.slotTitle}`, html);
}

export async function sendBookingCanceledToGuest(
  to: string,
  args: { slotTitle: string; when: string; hostLabel: string },
) {
  const html = renderEmail({
    eyebrow: "예약 취소",
    heading: "예약이 취소되었어요",
    intro: "불편을 드려 죄송해요.",
    preheader: `${args.slotTitle} · ${fmtWhen(args.when)}`,
    bodyHtml:
      detailCard(escapeHtml(args.slotTitle), [
        { label: "호스트", value: escapeHtml(args.hostLabel) },
        { label: "일시", value: fmtWhen(args.when) },
      ]) +
      emailButton("다른 시간 찾기", siteUrl("/explore")) +
      mutedNote("다른 시간을 원하시면 Orbit42에서 다시 예약해주세요."),
  });
  return send(to, `[Orbit42] 예약 취소: ${args.slotTitle}`, html);
}

export async function sendNewMessageEmail(
  to: string,
  args: { fromLabel: string; preview: string; conversationId: string },
) {
  const url = siteUrl(`/messages/${args.conversationId}`);
  const html = renderEmail({
    eyebrow: "새 메시지",
    heading: `${escapeHtml(args.fromLabel)}님이 메시지를 보냈어요`,
    preheader: args.preview.slice(0, 80),
    bodyHtml:
      quoteBlock(escapeHtml(args.preview)) +
      emailButton("대화 열기", url) +
      mutedNote("알림은 10분 간격으로 묶어서 보내드려요."),
  });
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
  const to = process.env.FEEDBACK_EMAIL || "orbit42@nthing.net";
  const label = args.from.displayName || args.from.username || "익명";
  const suffix = args.from.username ? ` (@${args.from.username})` : "";
  const html = renderEmail({
    eyebrow: "피드백",
    heading: "새 피드백이 도착했어요",
    preheader: args.body.slice(0, 80),
    bodyHtml:
      detailCard(`${escapeHtml(label)}${escapeHtml(suffix)}`, [
        {
          label: "회신",
          value: args.from.email
            ? `<a href="mailto:${escapeHtml(args.from.email)}">${escapeHtml(args.from.email)}</a>`
            : "",
        },
        { label: "경로", value: args.path ? escapeHtml(args.path) : "" },
      ]) +
      quoteBlock(escapeHtml(args.body)) +
      emailButton("어드민에서 열기", siteUrl("/admin/feedback")),
  });
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

export async function sendTimeRequestEmail(
  to: string,
  args: {
    requesterLabel: string;
    message: string;
    durationMin: number;
    budgetCents: number | null;
    preferredTimes: string | null;
    manageUrl: string;
  },
) {
  const budgetValue =
    args.budgetCents && args.budgetCents > 0
      ? `₩${(args.budgetCents / 100).toLocaleString("ko-KR")}`
      : "";
  const html = renderEmail({
    eyebrow: "시간 요청",
    heading: `${escapeHtml(args.requesterLabel)}님이 시간을 요청했어요`,
    preheader: args.message.slice(0, 80),
    bodyHtml:
      detailCard("요청 내용", [
        { label: "시간", value: `${args.durationMin}분`, strong: true },
        { label: "제안 금액", value: budgetValue },
        {
          label: "희망 시간",
          value: args.preferredTimes ? escapeHtml(args.preferredTimes) : "",
        },
      ]) +
      quoteBlock(escapeHtml(args.message)) +
      emailButton("요청 확인하기", siteUrl(args.manageUrl)) +
      mutedNote("수락하면 시간이 자동으로 예약돼요."),
  });
  return send(to, `[Orbit42] 시간 요청: ${args.requesterLabel}`, html);
}

export async function sendWeeklyDigestEmail(
  to: string,
  args: {
    name: string;
    username: string;
    lines: string[];
    unreadMessages: number;
    upcomingBookings: number;
  },
) {
  const FONT =
    "-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Pretendard',Roboto,'Segoe UI',sans-serif";
  const listHtml = args.lines.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0">${args.lines
        .map(
          (l) =>
            `<tr><td style="padding:9px 0;border-bottom:1px solid #f0f0f0;font-family:${FONT};font-size:14px;line-height:1.5;color:#3f3f46">${escapeHtml(l)}</td></tr>`,
        )
        .join("")}</table>`
    : "";
  const extras: string[] = [];
  if (args.unreadMessages > 0) {
    extras.push(`안 읽은 메시지가 ${args.unreadMessages}개 있어요.`);
  }
  if (args.upcomingBookings > 0) {
    extras.push(`다가오는 예약이 ${args.upcomingBookings}건 있어요.`);
  }
  const extraHtml = extras.length
    ? extras.map((l) => mutedNote(escapeHtml(l))).join("")
    : "";
  const html = renderEmail({
    eyebrow: "주간 요약",
    heading: `${escapeHtml(args.name)}님, 지난 한 주 소식이에요`,
    preheader: "Orbit42 주간 요약",
    bodyHtml:
      listHtml +
      extraHtml +
      emailButton("Orbit42 열기", siteUrl("/feed")) +
      mutedNote(
        `주간 요약은 <a href="${siteUrl(`/${args.username}/settings`)}">설정</a>에서 끌 수 있어요.`,
      ),
  });
  return send(to, "[Orbit42] 주간 요약", html);
}

export async function sendPasswordResetEmail(to: string, token: string) {
  const url = siteUrl(`/reset-password?token=${encodeURIComponent(token)}`);
  const html = renderEmail({
    eyebrow: "비밀번호",
    heading: "비밀번호를 재설정하세요",
    intro:
      "비밀번호 재설정을 요청하셨다면 아래 버튼을 눌러주세요. 요청하지 않았다면 이 메일을 무시해도 됩니다.",
    preheader: "Orbit42 비밀번호 재설정 — 1시간 내에 완료해주세요.",
    bodyHtml:
      emailButton("비밀번호 재설정", url) +
      mutedNote(
        `버튼이 안 되면 이 링크를 복사해 붙여넣으세요:<br><a href="${url}">${url}</a>`,
      ) +
      mutedNote("링크는 1시간 동안 유효합니다."),
  });
  return send(to, "[Orbit42] 비밀번호 재설정", html);
}
