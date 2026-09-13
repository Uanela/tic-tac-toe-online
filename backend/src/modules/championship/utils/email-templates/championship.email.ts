import {
  APP_URL,
  EmailTemplateResult,
  emailLayout,
  escapeHtml,
} from "../../../../utils/email-layout";
import { ChampionshipBounds, Standing } from "../../championship.service";

const MEDALS: Record<number, string> = {
  1: "1º lugar",
  2: "2º lugar",
  3: "3º lugar",
  4: "4º lugar",
};

interface Recipient extends Standing {
  email: string;
}

/**
 * The week reads as Monday through Sunday, so the last day is the instant before
 * the next Monday the bounds end on. Both ends are printed in Maputo time, the
 * same clock the window itself is cut by.
 */
function weekRange(period: ChampionshipBounds) {
  const day = (date: Date) =>
    date.toLocaleDateString("pt-BR", {
      day: "numeric",
      month: "long",
      timeZone: "Africa/Maputo",
    });

  return `${day(period.startedAt)} a ${day(new Date(period.endedAt.getTime() - 1))}`;
}

function record(standing: Standing) {
  return `${standing.wins}V · ${standing.losses}D · ${standing.draws}E · ${standing.xp} XP`;
}

function championList(winners: Standing[]) {
  return winners
    .map(
      (winner, index) =>
        `<p style="margin:0 0 6px;"><strong>${index + 1}.</strong> ${escapeHtml(winner.nickname)} — ${winner.xp} XP</p>`
    )
    .join("\n");
}

/** Goes to each of the four, told apart by where they finished. */
export function championshipWinnerEmail(
  winner: Recipient,
  period: ChampionshipBounds,
  rank: number,
  winners: Standing[]
): EmailTemplateResult {
  const medal = MEDALS[rank];

  return {
    subject: `${medal} no campeonato de ${weekRange(period)}`,
    html: emailLayout({
      title: `Você fechou a semana em ${medal}`,
      body: `<p style="margin:0 0 16px;">Olá, ${escapeHtml(winner.nickname)}. O campeonato de ${weekRange(period)} terminou e você ficou entre os quatro primeiros. Seu distintivo já está no ranking.</p>

<p style="margin:0 0 8px;">Sua semana:</p>

<p style="margin:0 0 20px;padding:12px 16px;background:#1a1a26;border-radius:8px;">${record(winner)}</p>

<p style="margin:0 0 8px;">Os quatro primeiros da semana:</p>

${championList(winners)}`,
      cta: { label: "Ver o ranking", url: `${APP_URL}/ranking` },
    }),
  };
}

/**
 * Goes to everyone else who played. It carries the same list of champions, which
 * is the part the four do not need told to them.
 */
export function championshipRecapEmail(
  participant: Recipient,
  period: ChampionshipBounds,
  winners: Standing[]
): EmailTemplateResult {
  return {
    subject: `O campeonato de ${weekRange(period)} terminou`,
    html: emailLayout({
      title: "A semana fechou",
      body: `<p style="margin:0 0 16px;">Olá, ${escapeHtml(participant.nickname)}. O campeonato de ${weekRange(period)} terminou, e a nova semana já está valendo XP.</p>

<p style="margin:0 0 8px;">Os quatro primeiros:</p>

<p style="margin:0 0 20px;">${championList(winners)}</p>

<p style="margin:0 0 8px;">Sua semana:</p>

<p style="margin:0;padding:12px 16px;background:#1a1a26;border-radius:8px;">${record(participant)}</p>`,
      cta: { label: "Jogar a nova semana", url: `${APP_URL}/play` },
    }),
  };
}
