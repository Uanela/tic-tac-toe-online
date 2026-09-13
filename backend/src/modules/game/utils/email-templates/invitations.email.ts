import {
  APP_URL,
  EmailTemplateResult,
  emailLayout,
  escapeHtml,
} from "../../../../utils/email-layout";

const cta = { label: "Jogar agora", url: `${APP_URL}/play` };

export function morningInviteEmail(player: {
  nickname: string;
}): EmailTemplateResult {
  return {
    subject: `Bom dia, ${player.nickname} — o tabuleiro está aberto`,
    html: emailLayout({
      title: "Comece o dia com uma partida",
      body: `<p style="margin:0 0 16px;">Bom dia, ${escapeHtml(player.nickname)}. Tem gente online agora, e algumas partidas rápidas cabem antes da rotina começar.</p>

<p style="margin:0;">Cada vitória vale 50 XP para o campeonato da semana.</p>`,
      cta,
    }),
  };
}

export function lunchInviteEmail(player: {
  nickname: string;
}): EmailTemplateResult {
  return {
    subject: `Hora do almoço, ${player.nickname}?`,
    html: emailLayout({
      title: "Uma partida cabe no seu intervalo",
      body: `<p style="margin:0 0 16px;">Uma partida de X e O leva poucos minutos — dá tempo de jogar enquanto o almoço chega.</p>

<p style="margin:0;">O campeonato da semana está correndo, e ${escapeHtml(player.nickname)} ainda está na disputa.</p>`,
      cta,
    }),
  };
}

export function eveningInviteEmail(player: {
  nickname: string;
}): EmailTemplateResult {
  return {
    subject: `Fechando o dia, ${player.nickname}?`,
    html: emailLayout({
      title: "A semana ainda está em aberto",
      body: `<p style="margin:0 0 16px;">O dia foi longo, mas a semana do campeonato ainda não acabou. Uma partida antes de descansar pode mudar sua posição.</p>

<p style="margin:0;">Os adversários ficam mais fortes à noite — vale a pena encarar.</p>`,
      cta,
    }),
  };
}
