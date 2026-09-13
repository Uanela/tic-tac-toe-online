export const APP_URL = process.env.APP_URL || "https://games.arkosjs.com";

export interface EmailTemplateResult {
  subject: string;
  html: string;
}

/** Nicknames are player-supplied and land in the markup, so they go in escaped. */
export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Every mail we send wears this shell, so a change to the frame lands in all of
 * them at once. Styles are inline because clients drop `<style>` blocks often
 * enough that a headless one would leave the mail unstyled for real readers.
 */
export function emailLayout({
  title,
  body,
  cta,
}: {
  title: string;
  body: string;
  cta?: { label: string; url: string };
}) {
  const button = cta
    ? `<a href="${cta.url}" style="display:inline-block;margin:4px 0 8px;padding:12px 22px;border-radius:8px;background:#7c6af5;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">${cta.label}</a>`
    : "";

  return `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:24px;background:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#e8e8f0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#12121a;border:1px solid #2a2a3d;border-radius:12px;">
      <tr>
        <td style="padding:32px 32px 0;">
          <p style="margin:0 0 10px;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#7c6af5;">Arkos Games</p>
          <h1 style="margin:0;font-size:22px;line-height:1.3;font-weight:600;color:#e8e8f0;">${title}</h1>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 32px 32px;font-size:15px;line-height:1.65;color:#e8e8f0;">
          ${body}
          ${button}
        </td>
      </tr>
    </table>
    <p style="max-width:560px;margin:16px auto 0;font-size:12px;line-height:1.6;color:#6b6b8a;">
      Você recebe este e-mail por ter uma conta na Arkos Games. Para escolher o que quer receber,
      <a href="${APP_URL}/settings/notifications" style="color:#6b6b8a;text-decoration:underline;">ajuste suas preferências de notificação</a>.
    </p>
  </body>
</html>`;
}
