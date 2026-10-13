// Orbit42 트랜잭션 메일 공통 틀 — 앱 화면과 같은 결로 단순하게.
// 로고 한 줄 → 제목 한 줄 → 핵심 정보 표 → 버튼 하나 → 한 줄 안내 → 짧은 푸터.
// 색은 앱 액센트 인디고(#6366f1) 하나만 버튼에 쓴다. 상단 색 바·카드 왼쪽 색 줄·대문자 라벨·
// 굵은(800) 제목·카드 속 카드·태그라인은 쓰지 않는다.
// 메일 클라이언트 호환: 표 기반 + 인라인 스타일, 폭 100% + max-width 560 으로 폰에서 자연스럽게 줄어든다.
// 다크 모드는 prefers-color-scheme 를 지원하는 클라이언트(애플 메일 등)에서 클래스로 바꾼다.

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://orbit42.org").replace(/\/$/, "");

const C = {
  accent: "#6366f1",
  ink: "#18181b",
  body: "#3f3f46",
  sub: "#71717a",
  line: "#e5e5ea",
  quote: "#f2f2f7",
  bg: "#ffffff",
  // 다크
  dBg: "#111111",
  dInk: "#eeeeee",
  dSub: "#a1a1aa",
  dLine: "#2c2c30",
  dQuote: "#1c1c1f",
};

const FONT =
  "-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Pretendard',Roboto,'Segoe UI',sans-serif";

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[ch] as string);
}

/** 버튼 하나 — 인디고, 라운드 10px. 표 기반이라 아웃룩에서도 버튼 모양이 유지된다. */
export function emailButton(label: string, href: string) {
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 0">
    <tr><td align="center" bgcolor="${C.accent}" style="border-radius:10px">
      <a href="${href}" target="_blank"
         style="display:inline-block;padding:13px 22px;font-family:${FONT};font-size:15px;font-weight:600;line-height:1;color:#ffffff;text-decoration:none;border-radius:10px">
        ${label}
      </a>
    </td></tr>
  </table>`;
}

type Row = { label: string; value: string; strong?: boolean };

/**
 * 핵심 정보 — 제목(17px, 600) 아래 "라벨 / 값" 2열 표. 빈 값의 줄은 뺀다.
 * strong 은 예전 호출 호환용으로 받기만 하고 굵게 하지 않는다 (값은 모두 보통 굵기).
 */
export function detailCard(title: string, rows: Row[]) {
  const body = rows
    .filter((r) => r.value)
    .map(
      (r) => `
      <tr>
        <td class="o-sub" style="padding:9px 16px 7px 0;font-family:${FONT};font-size:13px;line-height:1.5;color:${C.sub};white-space:nowrap;vertical-align:top;width:64px">${r.label}</td>
        <td class="o-ink" style="padding:7px 0;font-family:${FONT};font-size:15px;line-height:1.5;color:${C.ink};vertical-align:top">${r.value}</td>
      </tr>`,
    )
    .join("");
  return `
  <p class="o-ink" style="margin:28px 0 8px;font-family:${FONT};font-size:17px;font-weight:600;line-height:1.4;color:${C.ink}">${title}</p>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="o-line"
         style="border-top:1px solid ${C.line}">
    <tr><td style="padding-top:6px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${body}</table>
    </td></tr>
  </table>`;
}

/** 여러 줄 글(게스트 메모·입금 안내 등) — 연한 회색 바탕, 장식 없음. */
export function quoteBlock(text: string) {
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0 0">
    <tr><td class="o-quote o-ink" style="padding:12px 14px;background:${C.quote};border-radius:10px;font-family:${FONT};font-size:14px;line-height:1.6;color:${C.body};white-space:pre-wrap">${text}</td></tr>
  </table>`;
}

/** 단순 목록(주간 요약 등) — 줄 사이 얇은 선. */
export function listBlock(lines: string[]) {
  if (lines.length === 0) return "";
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 0">${lines
    .map(
      (l) =>
        `<tr><td class="o-ink o-line" style="padding:10px 0;border-bottom:1px solid ${C.line};font-family:${FONT};font-size:15px;line-height:1.5;color:${C.ink}">${l}</td></tr>`,
    )
    .join("")}</table>`;
}

/** 한 줄 안내 — 13px 회색. */
export function mutedNote(html: string) {
  return `<p class="o-sub" style="margin:16px 0 0;font-family:${FONT};font-size:13px;line-height:1.6;color:${C.sub}">${html}</p>`;
}

/**
 * 공통 틀.
 * - heading: 제목 한 줄 (20px, 600)
 * - intro: 제목 아래 짧은 설명 (선택)
 * - preheader: 받은편지함 미리보기 줄 (숨김)
 * - eyebrow: 예전 호출 호환용 — 더는 표시하지 않는다.
 */
export function renderEmail(opts: {
  eyebrow?: string;
  heading: string;
  intro?: string;
  bodyHtml: string;
  preheader?: string;
}) {
  const { heading, intro, bodyHtml, preheader } = opts;
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${escapeHtml(heading.replace(/<[^>]+>/g, ""))}</title>
  <style>
    :root{color-scheme:light dark;supported-color-schemes:light dark}
    body{margin:0;padding:0;width:100%!important;background:${C.bg}}
    a{color:${C.accent}}
    @media only screen and (max-width:600px){
      .o-pad{padding:28px 20px 32px !important}
    }
    @media (prefers-color-scheme:dark){
      body,.o-bg{background:${C.dBg} !important}
      .o-ink{color:${C.dInk} !important}
      .o-sub{color:${C.dSub} !important}
      .o-line{border-color:${C.dLine} !important}
      .o-quote{background:${C.dQuote} !important}
    }
  </style>
</head>
<body class="o-bg" style="margin:0;padding:0;background:${C.bg}">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(preheader || heading.replace(/<[^>]+>/g, ""))}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="o-bg" bgcolor="${C.bg}" style="background:${C.bg}">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px">
        <tr><td class="o-pad" style="padding:40px 32px 40px">
          <p class="o-ink" style="margin:0 0 32px;font-family:${FONT};font-size:16px;font-weight:600;color:${C.ink}">Orbit42</p>
          <h1 class="o-ink" style="margin:0;font-family:${FONT};font-size:20px;font-weight:600;line-height:1.4;color:${C.ink}">${heading}</h1>
          ${intro ? `<p class="o-ink" style="margin:10px 0 0;font-family:${FONT};font-size:15px;line-height:1.6;color:${C.body}">${intro}</p>` : ""}
          ${bodyHtml}
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:40px 0 0">
            <tr><td class="o-sub o-line" style="padding-top:16px;border-top:1px solid ${C.line};font-family:${FONT};font-size:12px;color:${C.sub}">
              <a href="${SITE_URL}" target="_blank" class="o-sub" style="color:${C.sub};text-decoration:none">Orbit42 · orbit42.org</a>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
