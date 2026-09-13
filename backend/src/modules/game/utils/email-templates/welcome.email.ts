import {
  APP_URL,
  EmailTemplateResult,
  emailLayout,
  escapeHtml,
} from "../../../../utils/email-layout";

export function welcomeEmail(player: { nickname: string }): EmailTemplateResult {
  return {
    subject: `Bem-vindo à Arkos Games, ${player.nickname}`,
    html: emailLayout({
      title: `Bem-vindo, ${escapeHtml(player.nickname)}`,
      body: `<p style="margin:0 0 16px;">Sua conta está pronta e o tabuleiro de X e O já está esperando por você.</p>

<p style="margin:0 0 16px;">Entre numa partida ranqueada a qualquer momento, ou procure alguém pelo apelido e mande o desafio direto — quem estiver online recebe na hora.</p>

<p style="margin:0;">Toda partida vale XP, e o XP que você fizer até domingo conta para o campeonato da semana. Os quatro primeiros levam o distintivo no perfil.</p>`,
      cta: { label: "Entrar no jogo", url: `${APP_URL}/play` },
    }),
  };
}
