// Shared, brand-consistent, mobile-first HTML email shell for Orbit42.
// Email clients are picky: everything is table-based with inline styles, the
// layout is fluid (width:100% + max-width) so it reflows on phones, and the
// CTA is a bulletproof table button with a generous tap target.

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://orbit42.org").replace(/\/$/, "");

const C = {
  red: "#dc2626",
  redSoft: "#fef2f2",
  ink: "#18181b",
  body: "#3f3f46",
  sub: "#71717a",
  faint: "#a1a1aa",
  line: "#ececec",
  panel: "#fafafa",
  bg: "#f4f4f5",
  white: "#ffffff",
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

/** Bulletproof CTA button — block-width on phones, fixed tap target. */
export function emailButton(label: string, href: string) {
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 4px">
    <tr><td align="center" bgcolor="${C.red}" style="border-radius:12px">
      <a href="${href}" target="_blank"
         style="display:inline-block;padding:15px 30px;font-family:${FONT};font-size:16px;font-weight:700;line-height:1;color:#ffffff;text-decoration:none;border-radius:12px">
        ${label}
      </a>
    </td></tr>
  </table>`;
}

type Row = { label: string; value: string; strong?: boolean };

/** A soft detail panel with a title and label/value rows. */
export function detailCard(title: string, rows: Row[]) {
  const body = rows
    .filter((r) => r.value)
    .map(
      (r) => `
      <tr>
        <td style="padding:5px 0;font-family:${FONT};font-size:13px;color:${C.faint};white-space:nowrap;vertical-align:top;width:72px">${r.label}</td>
        <td style="padding:5px 0;font-family:${FONT};font-size:15px;color:${C.body};${r.strong ? "font-weight:700;" : ""}vertical-align:top">${r.value}</td>
      </tr>`,
    )
    .join("");
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
         style="margin:22px 0;background:${C.panel};border:1px solid ${C.line};border-left:3px solid ${C.red};border-radius:12px">
    <tr><td style="padding:18px 20px">
      <p style="margin:0 0 12px;font-family:${FONT};font-size:17px;font-weight:800;color:${C.ink};letter-spacing:-0.01em">${title}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${body}</table>
    </td></tr>
  </table>`;
}

/** Quoted message block (guest note, etc.). */
export function quoteBlock(text: string) {
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0">
    <tr><td style="padding:12px 16px;background:${C.redSoft};border-radius:10px;font-family:${FONT};font-size:14px;line-height:1.6;color:${C.body};white-space:pre-wrap">${text}</td></tr>
  </table>`;
}

/** Small muted helper line below the main content. */
export function mutedNote(html: string) {
  return `<p style="margin:18px 0 0;font-family:${FONT};font-size:13px;line-height:1.6;color:${C.sub}">${html}</p>`;
}

/**
 * Wrap inner content in the branded shell.
 * - eyebrow: tiny uppercase red kicker (e.g. "새 예약")
 * - heading: the headline
 * - preheader: hidden inbox preview text
 */
export function renderEmail(opts: {
  eyebrow?: string;
  heading: string;
  intro?: string;
  bodyHtml: string;
  preheader?: string;
}) {
  const { eyebrow, heading, intro, bodyHtml, preheader } = opts;
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <title>${escapeHtml(heading)}</title>
  <style>
    @media only screen and (max-width:600px){
      .o-wrap{padding:16px 12px !important}
      .o-pad{padding:26px 22px !important}
      .o-h1{font-size:21px !important}
    }
    body{margin:0;padding:0;width:100%!important;background:${C.bg}}
    a{color:${C.red}}
  </style>
</head>
<body style="margin:0;padding:0;background:${C.bg}">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(preheader || heading)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.bg}" style="background:${C.bg}">
    <tr><td align="center" class="o-wrap" style="padding:32px 16px">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
             style="width:100%;max-width:600px;background:${C.white};border:1px solid ${C.line};border-radius:18px;overflow:hidden">
        <!-- brand accent -->
        <tr><td style="height:4px;background:${C.red};line-height:4px;font-size:0">&nbsp;</td></tr>
        <!-- header -->
        <tr><td style="padding:22px 32px 18px">
          <span style="font-family:${FONT};font-size:19px;font-weight:800;letter-spacing:-0.02em;color:${C.ink}">Orbit<span style="color:${C.red}">42</span></span>
        </td></tr>
        <!-- body -->
        <tr><td class="o-pad" style="padding:8px 32px 32px">
          ${eyebrow ? `<p style="margin:0 0 8px;font-family:${FONT};font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${C.red}">${escapeHtml(eyebrow)}</p>` : ""}
          <h1 class="o-h1" style="margin:0 0 ${intro ? "10px" : "4px"};font-family:${FONT};font-size:23px;font-weight:800;line-height:1.3;letter-spacing:-0.02em;color:${C.ink}">${heading}</h1>
          ${intro ? `<p style="margin:0;font-family:${FONT};font-size:15px;line-height:1.65;color:${C.body}">${intro}</p>` : ""}
          ${bodyHtml}
        </td></tr>
        <!-- footer -->
        <tr><td style="padding:20px 32px;border-top:1px solid ${C.line};background:${C.panel}">
          <p style="margin:0;font-family:${FONT};font-size:12px;color:${C.sub}">미팅 일정을 맛집 예약처럼 간편하게</p>
          <p style="margin:5px 0 0;font-family:${FONT};font-size:12px;color:${C.faint}">
            <a href="${SITE_URL}" target="_blank" style="color:${C.faint};text-decoration:none;font-weight:700">Orbit42</a>
            &nbsp;·&nbsp;<a href="${SITE_URL}" target="_blank" style="color:${C.faint};text-decoration:underline">orbit42.org</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
