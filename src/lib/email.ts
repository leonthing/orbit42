import { Resend } from "resend";
import {
  renderEmail,
  emailButton,
  detailCard,
  quoteBlock,
  listBlock,
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
    // Resend SDK 는 실패를 던지지 않고 error 로 돌려준다 — 보지 않으면 실패도 성공처럼 보인다
    const { error } = await r.emails.send({ from: FROM, to, subject, html });
    if (error) {
      console.error("resend send", error);
      return { ok: false };
    }
    return { ok: true };
  } catch (err) {
    console.error("resend send", err);
    return { ok: false };
  }
}

export function siteUrl(path: string) {
  return `${SITE_URL.replace(/\/$/, "")}${path}`;
}

/** 한국 시간, 예: "10월 28일 (화) 오전 11:00" — 올해가 아니면 연도를 붙인다. */
function fmtWhen(when: string) {
  const date = new Date(when);
  const kstYear = (d: Date) =>
    Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", year: "numeric" }).format(d));
  const day = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    ...(kstYear(date) !== kstYear(new Date()) ? { year: "numeric" as const } : {}),
    month: "long",
    day: "numeric",
  }).format(date);
  const weekday = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", weekday: "short" }).format(date);
  const time = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
  return `${day} (${weekday}) ${time}`;
}

export async function sendVerifyEmail(to: string, token: string) {
  const url = siteUrl(`/verify-email?token=${encodeURIComponent(token)}`);
  const html = renderEmail({
    eyebrow: "이메일 인증",
    heading: "이메일 주소를 확인해 주세요",
    intro: "아래 버튼을 누르면 가입이 끝나요. 링크는 24시간 동안 쓸 수 있어요.",
    preheader: "Orbit42 이메일 확인",
    bodyHtml:
      emailButton("이메일 확인하기", url) +
      mutedNote(
        `버튼이 안 되면 이 링크를 복사해 붙여 넣으세요.<br><a href="${url}">${url}</a>`,
      ),
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
        { label: "일시", value: fmtWhen(args.when) },
        { label: "게스트", value: guestValue },
      ]) +
      (args.message ? quoteBlock(escapeHtml(args.message)) : "") +
      emailButton("예약 관리하기", url) +
      mutedNote(
        args.autoApprove
          ? "자동으로 확정된 예약이에요. 캘린더에서 확인하실 수 있어요."
          : "내 확인을 기다리는 예약이에요. 수락하거나 거절해 주세요.",
      ),
  });
  return send(to, `[Orbit42] 새 예약: ${args.slotTitle}`, html);
}

/** 게스트 메일 하단 한 줄 — 담담하게, 광고 문구 없이 (1.6.0 ②) */
function ownLinkNote() {
  return mutedNote(
    `나도 이런 예약 링크를 만들 수 있어요 · <a href="${siteUrl("/signup")}" target="_blank" style="color:inherit">Orbit42에서 만들기</a>`,
  );
}

/** 예약 관리 링크가 있으면 그쪽으로(로그인 없이 조회·취소·시간 바꾸기), 없으면 내 예약 목록 */
function manageHref(managePath?: string) {
  return siteUrl(managePath ?? "/bookings");
}

export async function sendBookingConfirmedToGuest(
  to: string,
  args: { slotTitle: string; when: string; hostLabel: string; location: string | null; managePath?: string },
) {
  const html = renderEmail({
    eyebrow: "예약 확정",
    heading: "예약이 확정됐어요",
    intro: `${escapeHtml(args.hostLabel)}님과의 일정이 확정됐어요.`,
    preheader: `${args.slotTitle} · ${fmtWhen(args.when)}`,
    bodyHtml:
      detailCard(escapeHtml(args.slotTitle), [
        { label: "호스트", value: escapeHtml(args.hostLabel) },
        { label: "일시", value: fmtWhen(args.when) },
        { label: "장소", value: args.location ? escapeHtml(args.location) : "" },
      ]) +
      emailButton(args.managePath ? "예약 확인·변경" : "내 예약 보기", manageHref(args.managePath)) +
      mutedNote(
        args.managePath
          ? "위 버튼에서 로그인 없이 예약을 보고, 취소하거나 다른 시간으로 바꿀 수 있어요."
          : "시간을 바꿔야 하면 호스트에게 미리 알려 주세요.",
      ) +
      ownLinkNote(),
  });
  return send(to, `[Orbit42] 예약 확정: ${args.slotTitle}`, html);
}

/** 계좌이체 예약 — 게스트에게 금액·입금 안내·기한을 보낸다. 호스트가 확인하면 확정 메일이 따로 간다. */
export async function sendPaymentInstructionsToGuest(
  to: string,
  args: {
    slotTitle: string;
    when: string;
    hostLabel: string;
    amountCents: number;
    instructions: string;
    dueAt: string;
    managePath?: string;
  },
) {
  const amount = `${Math.round(args.amountCents / 100).toLocaleString("ko-KR")}원`;
  const html = renderEmail({
    eyebrow: "입금 안내",
    heading: "입금하시면 예약이 확정돼요",
    intro: `${escapeHtml(args.hostLabel)}님이 입금을 확인하면 확정 메일을 보내드려요.`,
    preheader: `${args.slotTitle} · ${amount} · ${fmtWhen(args.dueAt)}까지`,
    bodyHtml:
      detailCard(escapeHtml(args.slotTitle), [
        { label: "일시", value: fmtWhen(args.when) },
        { label: "금액", value: amount },
        { label: "입금 기한", value: fmtWhen(args.dueAt) },
      ]) +
      quoteBlock(escapeHtml(args.instructions)) +
      (args.managePath ? emailButton("예약 확인·변경", manageHref(args.managePath)) : "") +
      mutedNote("기한까지 입금이 확인되지 않으면 예약은 자동으로 취소돼요."),
  });
  return send(to, `[Orbit42] 입금 안내: ${args.slotTitle}`, html);
}

export async function sendBookingReminderEmail(
  to: string,
  args: {
    /** day: 하루 전(3~24시간 전) · hour: 1시간 전 */
    kind: "day" | "hour";
    /** day 일 때 '오늘'/'내일'/'M월 D일' */
    lead: string;
    role: "host" | "guest";
    slotTitle: string;
    when: string;
    otherLabel: string;
    location: string | null;
    manageUrl: string;
    /** 받는 사람이 가입자면 알림 설정에서 끌 수 있다는 한 줄 */
    hasAccount: boolean;
  },
) {
  const hour = args.kind === "hour";
  const heading = hour ? "1시간 뒤에 예약이 있어요" : `${args.lead} 예약이 있어요`;
  const note =
    args.role === "guest"
      ? "위 버튼에서 예약을 보고, 취소하거나 다른 시간으로 바꿀 수 있어요."
      : "시간을 바꿔야 하면 상대에게 미리 알려 주세요.";
  const html = renderEmail({
    eyebrow: "리마인더",
    heading,
    preheader: `${args.slotTitle} · ${fmtWhen(args.when)}`,
    bodyHtml:
      detailCard(escapeHtml(args.slotTitle), [
        { label: "일시", value: fmtWhen(args.when) },
        {
          label: args.role === "host" ? "게스트" : "호스트",
          value: escapeHtml(args.otherLabel),
        },
        { label: "장소", value: args.location ? escapeHtml(args.location) : "" },
      ]) +
      emailButton("예약 확인하기", siteUrl(args.manageUrl)) +
      mutedNote(note) +
      (args.hasAccount ? mutedNote("리마인더 메일은 Orbit42 알림 설정에서 끌 수 있어요.") : ""),
  });
  const subject = hour
    ? `[Orbit42] 1시간 뒤 예약: ${args.slotTitle}`
    : `[Orbit42] ${args.lead} 예약: ${args.slotTitle}`;
  return send(to, subject, html);
}

export async function sendBookingCanceledToGuest(
  to: string,
  args: { slotTitle: string; when: string; hostLabel: string },
) {
  const html = renderEmail({
    eyebrow: "예약 취소",
    heading: "예약이 취소됐어요",
    preheader: `${args.slotTitle} · ${fmtWhen(args.when)}`,
    bodyHtml:
      detailCard(escapeHtml(args.slotTitle), [
        { label: "호스트", value: escapeHtml(args.hostLabel) },
        { label: "일시", value: fmtWhen(args.when) },
      ]) +
      emailButton("다른 시간 찾기", siteUrl("/explore")) +
      mutedNote("다른 시간이 필요하면 Orbit42에서 다시 예약해 주세요."),
  });
  return send(to, `[Orbit42] 예약 취소: ${args.slotTitle}`, html);
}

/**
 * 호스트가 탈퇴해 예약이 취소됐다는 안내 (CEO 10/26) — 안내만, 홍보 줄·버튼 없음.
 * 호스트 이름은 넣지 않는다(탈퇴한 사람의 정보).
 */
export async function sendHostLeftCancelToGuest(to: string, args: { slotTitle: string; when: string }) {
  const html = renderEmail({
    heading: "예약이 취소되었습니다",
    intro: `예약하신 ${fmtWhen(args.when)} 일정이 호스트 사정으로 취소되었습니다. 불편을 드려 죄송합니다.`,
    preheader: `${args.slotTitle} · ${fmtWhen(args.when)}`,
    bodyHtml: detailCard(escapeHtml(args.slotTitle), [{ label: "일시", value: fmtWhen(args.when) }]),
  });
  return send(to, `[Orbit42] 예약 취소 안내: ${args.slotTitle}`, html);
}

/**
 * 예약 시간 변경 — 제안(수락 대기)과 확정 양쪽에 쓴다.
 * `decided: true` 면 이미 옮겨진 것이고, false 면 상대의 수락을 기다린다.
 */
export async function sendBookingRescheduleProposal(
  to: string,
  args: {
    slotTitle: string;
    previousWhen: string;
    when: string;
    proposerLabel: string;
    note?: string | null;
    decided: boolean;
    /** 받는 사람이 그 예약의 게스트일 때만 — 로그인 없이 보는 관리 링크 (개선-40) */
    managePath?: string;
  },
) {
  const html = renderEmail({
    eyebrow: args.decided ? "예약 시간 변경" : "시간 변경 제안",
    heading: args.decided
      ? "예약 시간이 바뀌었어요"
      : `${args.proposerLabel}님이 시간 변경을 제안했어요`,
    intro: args.decided
      ? "캘린더의 일정도 새 시간으로 옮겼어요."
      : "수락하면 예약이 새 시간으로 옮겨져요.",
    preheader: `${args.slotTitle} · ${fmtWhen(args.when)}`,
    bodyHtml:
      detailCard(escapeHtml(args.slotTitle), [
        { label: "기존", value: fmtWhen(args.previousWhen) },
        { label: "변경", value: fmtWhen(args.when) },
        ...(args.note
          ? [{ label: "메모", value: escapeHtml(args.note) }]
          : []),
      ]) +
      emailButton(
        args.decided ? "예약 확인하기" : "수락 여부 결정하기",
        manageHref(args.managePath),
      ) +
      (args.decided
        ? ""
        : mutedNote("응답하지 않으면 예약은 원래 시간 그대로 유지돼요.")),
  });
  return send(
    to,
    args.decided
      ? `[Orbit42] 예약 시간 변경: ${args.slotTitle}`
      : `[Orbit42] 시간 변경 제안: ${args.slotTitle}`,
    html,
  );
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
        { label: "시간", value: `${args.durationMin}분` },
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
  const listHtml = listBlock(args.lines.map(escapeHtml));
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
      emailButton("Orbit42 열기", siteUrl("/calendar")) +
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
    heading: "비밀번호를 새로 정해 주세요",
    intro:
      "아래 버튼을 누르면 새 비밀번호를 정할 수 있어요. 링크는 1시간 동안 쓸 수 있어요. 요청하지 않았다면 이 메일은 무시해도 돼요.",
    preheader: "Orbit42 비밀번호 재설정",
    bodyHtml:
      emailButton("비밀번호 재설정", url) +
      mutedNote(
        `버튼이 안 되면 이 링크를 복사해 붙여 넣으세요.<br><a href="${url}">${url}</a>`,
      ),
  });
  return send(to, "[Orbit42] 비밀번호 재설정", html);
}

/** 아직 가입하지 않은 사람에게 — 가입 유도 링크. */
export async function sendEventInviteEmail(
  to: string,
  args: {
    inviterName: string;
    eventTitle: string;
    when: string;
    location?: string | null;
    memo?: string | null;
    refUsername: string;
  },
) {
  const { eventInviteBody, eventInviteSubject } = await import(
    "@/lib/email-templates"
  );
  return send(to, eventInviteSubject(args.eventTitle), eventInviteBody(args));
}

/** 이미 가입한 참석자에게 — 수락/거절은 앱(알림)에서. */
export async function sendEventParticipantEmail(
  to: string,
  args: {
    inviterName: string;
    eventTitle: string;
    when: string;
    location?: string | null;
    memo?: string | null;
    recipientUsername: string | null;
  },
) {
  const { eventParticipantBody, eventInviteSubject } = await import(
    "@/lib/email-templates"
  );
  return send(
    to,
    eventInviteSubject(args.eventTitle),
    eventParticipantBody(args),
  );
}
