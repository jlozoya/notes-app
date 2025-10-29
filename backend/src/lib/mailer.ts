import nodemailer from "nodemailer";

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  SMTP_FROM,
  APP_NAME = "Notes App",
  APP_URL = "https://notesapp.lozoya.org",
  SUPPORT_EMAIL = "support@example.com",
  ACCENT_COLOR = "#111827",
  LOGO_URL = "",
} = process.env;

if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !SMTP_FROM) {
  throw new Error("SMTP env vars missing: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM");
}

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: Number(SMTP_PORT),
  secure: Number(SMTP_PORT) === 465,
  auth: { user: SMTP_USER, pass: SMTP_PASS },
});

export type TemplateProps = {
  title?: string;       // e.g., "Verify your email"
  intro?: string;       // e.g., "Thanks for signing up!"
  ctaText?: string;     // e.g., "Verify Email"
  ctaUrl?: string;      // e.g., https://...token...
  expiresText?: string; // e.g., "This link expires in 24 hours."
  extraNote?: string;   // optional
};

export type MailOptions = {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
  headers?: Record<string, string>;
  template?: TemplateProps;
  raw?: boolean;
};

export async function sendEmail({
  to,
  subject,
  html,
  text,
  replyTo,
  headers,
  template,
  raw,
}: MailOptions): Promise<void> {
  let htmlBody: string | undefined;
  let textBody: string | undefined;

  if (raw) {
    htmlBody = html;
    textBody = text ?? (html ? stripHtml(html) : "");
  } else if (template) {
    htmlBody = renderEmailHtml(template);
    textBody = renderEmailText(template);
  } else {
    if (html) {
      htmlBody = renderLayout(html);
      textBody = text ?? stripHtml(html);
    } else if (text) {
      const preHtml = `<pre style="white-space:pre-wrap;margin:0">${escapeHtml(text)}</pre>`;
      htmlBody = renderLayout(preHtml);
      textBody = text;
    } else {
      // nothing provided: minimal branded shell
      htmlBody = renderLayout(`<p style="margin:0">No content.</p>`);
      textBody = "No content.";
    }
  }

  await transporter.sendMail({
    from: SMTP_FROM,
    to,
    subject,
    html: htmlBody,
    text: textBody,
    replyTo,
    headers: {
      "X-Entity-Ref-ID": cryptoSafeId(),
      ...headers,
    },
  });
}

export async function verifyMailer(): Promise<void> {
  await transporter.verify();
  console.log("[MAIL] SMTP connection verified");
}

// ─────────────── Layout / Templates ───────────────
function renderLayout(innerHtml: string) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" /><meta name="viewport" content="width=device-width" />
<title>${escapeHtml(APP_NAME)}</title>
<style>
body{margin:0;padding:0;background:#f6f7f9;-webkit-text-size-adjust:none}
table{border-collapse:collapse} a{text-decoration:none}
</style>
</head>
<body>
<table role="presentation" width="100%" style="background:#f6f7f9;">
  <tr>
    <td align="center" style="padding:24px;">
      <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
        <tr>
          <td style="padding:24px 24px 0;">
            <div style="display:flex;align-items:center;gap:12px;">
              ${LOGO_URL ? `<img src="${LOGO_URL}" alt="${escapeHtml(APP_NAME)}" width="32" height="32" style="display:block;border:0;" />` : ""}
              <h1 style="margin:0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:18px;color:#111827;">${escapeHtml(APP_NAME)}</h1>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:24px;">
            <div style="font-family:Inter,Segoe UI,Arial,sans-serif;font-size:16px;line-height:24px;color:#111827;">
              ${innerHtml}
            </div>
            <p style="margin:24px 0 0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:12px;line-height:18px;color:#6b7280;">
              If you didn’t request this, you can safely ignore this email.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;">
            <p style="margin:0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:12px;color:#6b7280;">
              Need help? Contact <a href="mailto:${SUPPORT_EMAIL}" style="color:${ACCENT_COLOR};">${SUPPORT_EMAIL}</a>.
            </p>
            <p style="margin:8px 0 0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:12px;color:#9ca3af;">
              © ${new Date().getFullYear()} ${escapeHtml(APP_NAME)} · <a href="${APP_URL}" style="color:${ACCENT_COLOR};">${APP_URL}</a>
            </p>
          </td>
        </tr>
      </table>
      <table role="presentation" width="100%" style="max-width:560px;">
        <tr><td style="padding:16px 8px;text-align:center;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:12px;color:#9ca3af;">
          Trouble with the button? Copy and paste the link into your browser.
        </td></tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

function renderEmailHtml({
  title = "",
  intro = "",
  ctaText,
  ctaUrl,
  expiresText,
  extraNote,
}: TemplateProps) {
  const button = ctaText && ctaUrl
    ? `<div style="text-align:center;margin:24px 0;">
         <a href="${ctaUrl}" style="display:inline-block;padding:12px 18px;background:${ACCENT_COLOR};color:#ffffff;border-radius:10px;font-weight:600;">${escapeHtml(ctaText)}</a>
       </div>` : "";
  const expires = expiresText ? `<p style="margin:0 0 8px;color:#6b7280;">${escapeHtml(expiresText)}</p>` : "";
  const rawLink = ctaUrl ? `<p style="margin:0;color:#6b7280;word-break:break-all;">${escapeHtml(ctaUrl)}</p>` : "";
  const note = extraNote ? `<p style="margin:16px 0 0;color:#6b7280;">${escapeHtml(extraNote)}</p>` : "";

  const inner = `
    ${title ? `<h2 style="margin:0 0 12px;font-size:20px;">${escapeHtml(title)}</h2>` : ""}
    ${intro ? `<p style="margin:0 0 16px;">${escapeHtml(intro)}</p>` : ""}
    ${button}${expires}${rawLink}${note}
  `;
  return renderLayout(inner);
}

function renderEmailText({
  title = "",
  intro = "",
  ctaText,
  ctaUrl,
  expiresText,
  extraNote,
}: TemplateProps): string {
  const lines: string[] = [];
  if (title) lines.push(title);
  if (intro) lines.push("", intro);
  if (ctaText && ctaUrl) lines.push("", `${ctaText}: ${ctaUrl}`);
  if (expiresText) lines.push("", expiresText);
  if (extraNote) lines.push("", extraNote);
  lines.push("", `— ${APP_NAME}`, APP_URL);
  return lines.join("\n");
}

// ─────────────── Utils ───────────────
function cryptoSafeId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
function stripHtml(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
function escapeHtml(str: string) {
  // ES2015-safe (no replaceAll)
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
