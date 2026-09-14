import {
  APP_URL,
  EmailTemplateResult,
  emailLayout,
  escapeHtml,
} from "../../../../utils/email-layout";

const SUPPORT_EMAIL =
  process.env.COMPANY_SUPPORT_EMAIL ||
  process.env.EMAIL_USER ||
  "suporte@arkosjs.com";

function greeting(player: { nickname: string } | null) {
  return player
    ? `Olá, ${escapeHtml(player.nickname)}.`
    : "Olá.";
}

export function passwordResetOtpEmail(
  player: { nickname: string } | null,
  otp: string,
  expiresInMinutes: number
): EmailTemplateResult {
  return {
    subject: "O seu código de recuperação de palavra-passe",
    html: emailLayout({
      title: "Recuperação de palavra-passe",
      body: `<p style="margin:0 0 16px;">${greeting(player)} Pediu para redefinir a palavra-passe da sua conta na Arkos Games. Use o código abaixo para continuar.</p>

<p style="margin:0 0 16px;padding:14px 0;border-radius:8px;background:#1c1c28;text-align:center;font-size:30px;font-weight:700;letter-spacing:0.28em;color:#7c6af5;">${otp}</p>

<p style="margin:0;">O código é válido por ${expiresInMinutes} minutos. Se não foi você que pediu, ignore este e-mail — a sua palavra-passe continua a mesma.</p>`,
    }),
  };
}

export function passwordResetConfirmationEmail(
  player: { nickname: string } | null
): EmailTemplateResult {
  return {
    subject: "A sua palavra-passe foi alterada",
    html: emailLayout({
      title: "Palavra-passe alterada",
      body: `<p style="margin:0 0 16px;">${greeting(player)} A palavra-passe da sua conta na Arkos Games foi alterada com sucesso. Já pode entrar com a nova.</p>

<p style="margin:0;">Se não foi você, entre em contacto connosco imediatamente em <a href="mailto:${SUPPORT_EMAIL}" style="color:#7c6af5;">${SUPPORT_EMAIL}</a>.</p>`,
      cta: { label: "Entrar na conta", url: `${APP_URL}/auth/login` },
    }),
  };
}
