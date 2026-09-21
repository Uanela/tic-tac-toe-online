import { emailService } from "arkos/services";
import type { NotificationPreferenceCategory, RankBoard } from "@prisma/client";
import notificationService from "./notification.service";
import pushService from "./push.service";
import pushInstallationService from "../push-installation/push-installation.service";
import notificationPreferenceService from "../notification-preference/notification-preference.service";
import challengeEmail from "../game/utils/email-templates/challenge.email";
import nudgeEmail from "./utils/email-templates/nudge.email";
import { APP_URL } from "@/src/utils/email-layout";
import { pingFeed } from "@/src/utils/feed-ping";

interface Challenge {
  toUserId: string;
  toEmail: string;
  toNickname: string;
  fromNickname: string;
  fromUserId: string;
  inviteId: string;
}

/** Only a fresh invite has a window: once it is answered the row behind it is history. */
interface ReceivedChallenge extends Challenge {
  expiresAt: number;
}

/** Each leaderboard a player can fall on says so in its own words. */
const RANK_DROP = {
  Championship: {
    type: "ChampionshipRankDropped",
    body: (rank: number) => `Você caiu para o #${rank} no campeonato da semana.`,
  },
  Global: {
    type: "GlobalRankDropped",
    body: (rank: number) => `Você caiu para o #${rank} no ranking global.`,
  },
} as const;

/** Where a player stands, when a nudge has something to say about it. */
interface Standing {
  board?: RankBoard | null;
  rank?: number | null;
  move?: number | null;
}

/** Each board a nudge can talk about, in the words its sentence needs. */
const BOARD_NAME = {
  Championship: "campeonato da semana",
  Global: "ranking global",
} as const;

/** " (subiu 2 lugares)", " (caiu 1 lugar)", or nothing when there is no yesterday. */
function movement(move?: number | null) {
  if (!move) return "";

  const places = Math.abs(move) === 1 ? "lugar" : "lugares";

  return move > 0 ? ` (subiu ${move} ${places})` : ` (caiu ${-move} ${places})`;
}

/** Who a nudge is addressed to, and where else they can be reached. */
interface Contact {
  userId: string;
  email: string;
  nickname: string;
}

/** A nudge, once its copy has been picked. */
interface Engagement extends Contact, Standing {
  type: "ComeBack" | "NewAccount" | "ChampionshipStatus";
  title: string;
  body: string;
}

/** The one place a player is told something happened. Every channel decision lives
 *  here so a new notification type cannot invent its own delivery rules. */
class NotifierService {
  async challengeReceived(challenge: ReceivedChallenge) {
    await notificationService.createOne({
      userId: challenge.toUserId,
      type: "ChallengeReceived",
      inviteId: challenge.inviteId,
      fromNickname: challenge.fromNickname,
      fromUserId: challenge.fromUserId,
      expiresAt: new Date(challenge.expiresAt),
    });

    if (!(await this.mayNotify(challenge.toUserId, "Challenge"))) return;

    const pushed = await pushService.sendToUser(challenge.toUserId, {
      title: "Novo desafio",
      body: `${challenge.fromNickname} te desafiou para uma partida`,
      url: `${APP_URL}/play?inviteId=${challenge.inviteId}`,
    });

    if (pushed) return;

    emailService
      .send({
        to: challenge.toEmail,
        ...challengeEmail(
          { nickname: challenge.fromNickname },
          { nickname: challenge.toNickname },
          challenge.inviteId,
        ),
      })
      .catch(console.error);
  }

  /** Only ever called for an invite still inside its window, so a lapsed one reaches nobody. */
  async challengeResolved(
    challenge: Omit<Challenge, "toEmail" | "toNickname"> & { accepted: boolean },
  ) {
    await notificationService.createOne({
      userId: challenge.toUserId,
      type: challenge.accepted ? "ChallengeAccepted" : "ChallengeDeclined",
      inviteId: challenge.inviteId,
      fromNickname: challenge.fromNickname,
      fromUserId: challenge.fromUserId,
    });

    if (!(await this.mayNotify(challenge.toUserId, "Challenge"))) return;

    await pushService.sendToUser(challenge.toUserId, {
      title: challenge.accepted ? "Desafio aceito" : "Desafio recusado",
      body: `${challenge.fromNickname} ${challenge.accepted ? "aceitou" : "recusou"} o seu desafio`,
      url: `${APP_URL}/notifications`,
    });
  }

  /** A rank alert is worth a browser push but never an email: it is the app's own
   *  standing that moved, and a mailbox reminder of a bad week is not wanted. */
  async rankDropped(alert: { board: RankBoard; userId: string; rank: number }) {
    const copy = RANK_DROP[alert.board];

    await notificationService.createOne({
      userId: alert.userId,
      type: copy.type,
      rank: alert.rank,
    });

    if (!(await this.mayNotify(alert.userId, "Annoucements"))) return;

    await pushService.sendToUser(alert.userId, {
      title: "Desceu no ranking",
      body: copy.body(alert.rank),
      url: `${APP_URL}/ranking`,
    });
  }

  /** A player who has gone quiet, told where they stand on the board that fits. */
  async comeBack(nudge: Contact & Standing) {
    const where =
      nudge.board && nudge.rank
        ? `Você está em #${nudge.rank} no ${BOARD_NAME[nudge.board]}${movement(nudge.move)}. `
        : "";

    await this.engage({
      ...nudge,
      type: "ComeBack",
      title: "Volta ao tabuleiro",
      body: `${where}Uma partida hoje muda a sua semana.`,
    });
  }

  /** Signed up, never played. Only ever sent inside their first week. */
  async newAccount(nudge: Contact) {
    await this.engage({
      ...nudge,
      type: "NewAccount",
      title: "Bem-vindo ao Arkos Games",
      body: `${nudge.nickname}, você ainda não jogou nenhuma partida. Jogue uma e o seu nome entra no ranking.`,
    });
  }

  /** The weekend of a championship, which outranks whatever else today had to say. */
  async championshipStatus(
    nudge: Contact & Required<Standing> & { finalDay: boolean },
  ) {
    await this.engage({
      ...nudge,
      type: "ChampionshipStatus",
      title: nudge.finalDay
        ? "Último dia do campeonato"
        : "Reta final do campeonato",
      body: nudge.finalDay
        ? `Você está em #${nudge.rank}${movement(nudge.move)}. Hoje é o último dia — jogue para garantir a sua posição.`
        : `Você está em #${nudge.rank}${movement(nudge.move)}. Amanhã é o último dia — jogue para subir.`,
    });
  }

  /** In-app row first, then push, then mail for whoever push could not reach. */
  private async engage(nudge: Engagement) {
    await notificationService.createOne({
      userId: nudge.userId,
      type: nudge.type,
      rank: nudge.rank ?? null,
      move: nudge.move ?? null,
      board: nudge.board ?? null,
    });

    pingFeed(nudge.userId);

    if (!(await this.mayNotify(nudge.userId, "Annoucements"))) return;

    const pushed = await pushService.sendToUser(nudge.userId, {
      title: nudge.title,
      body: nudge.body,
      url: `${APP_URL}/play`,
    });

    // Having refused push is a no to the other channel too: only a challenge mails them.
    if (pushed || !(await pushInstallationService.emailAllowed(nudge.userId)))
      return;

    emailService
      .send({
        to: nudge.email,
        ...nudgeEmail({ nickname: nudge.nickname }, nudge),
      })
      .catch(console.error);
  }

  private mayNotify(userId: string, category: NotificationPreferenceCategory) {
    return notificationPreferenceService.canNotify(userId, category);
  }
}

const notifierService = new NotifierService();

export default notifierService;
