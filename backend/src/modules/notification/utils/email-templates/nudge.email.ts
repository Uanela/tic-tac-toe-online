import {
  APP_URL,
  EmailTemplateResult,
  emailLayout,
  escapeHtml,
} from "../../../../utils/email-layout";

export default function nudgeEmail(
  player: { nickname: string },
  message: { title: string; body: string },
): EmailTemplateResult {
  return {
    subject: `${message.title}, ${player.nickname}`,
    html: emailLayout({
      title: message.title,
      body: `<p style="margin:0;">${escapeHtml(message.body)}</p>`,
      cta: { label: "Jogar agora", url: `${APP_URL}/play` },
    }),
  };
}
