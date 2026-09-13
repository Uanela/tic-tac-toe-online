import {
  APP_URL,
  EmailTemplateResult,
  emailLayout,
  escapeHtml,
} from "../../../../utils/email-layout";

export default function challengeEmail(
  player: { nickname: string },
  opponent: { nickname: string },
  inviteId: string
): EmailTemplateResult {
  return {
    subject: `${player.nickname} te desafiou para uma partida`,
    html: emailLayout({
      title: `${escapeHtml(player.nickname)} quer jogar com você`,
      body: `<p style="margin:0 0 16px;">Olá, ${escapeHtml(opponent.nickname)}. Aceite o desafio e a partida começa assim que vocês dois estiverem no tabuleiro.</p>

<p style="margin:0;">O convite expira em alguns minutos. Se ele passar, é só procurar ${escapeHtml(player.nickname)} na lista de jogadores online e mandar um novo.</p>`,
      cta: {
        label: "Aceitar desafio",
        url: `${APP_URL}/play?inviteId=${inviteId}`,
      },
    }),
  };
}
