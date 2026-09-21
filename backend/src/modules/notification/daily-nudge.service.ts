import { BaseService } from "arkos/services";
import type { RankBoard } from "@prisma/client";
import championshipService from "../championship/championship.service";
import gameService from "../game/game.service";
import playerService from "../player/player.service";
import notificationService from "./notification.service";
import notifierService from "./notifier.service";
import { BOARDS, type Place } from "./utils/leaderboards";

const MAPUTO_OFFSET_MS = 2 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const FRESH_DAYS = 7;
const SNAPSHOT_KEEP_DAYS = 14;
const CRITICAL_WEEKDAYS = [6, 0];
const FINAL_WEEKDAY = 0;

function maputoDay(at: Date) {
  const local = new Date(at.getTime() + MAPUTO_OFFSET_MS);

  return new Date(
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) -
      MAPUTO_OFFSET_MS
  );
}

function maputoWeekday(at: Date) {
  return new Date(at.getTime() + MAPUTO_OFFSET_MS).getUTCDay();
}

interface Human {
  id: string;
  userId: string;
  nickname: string;
  xp: number;
  createdAt: Date;
  user: { email: string };
}

interface Standing {
  board: RankBoard;
  rank: number;
  move: number | null;
}

interface Seen {
  championship?: Standing;
  global?: Standing;
  playedToday: boolean;
  enrolled: boolean;
  fresh: boolean;
  critical: boolean;
  finalDay: boolean;
}

class DailyNudgeService extends BaseService<"rank-snapshot"> {
  async run(at: Date = new Date()) {
    const day = maputoDay(at);
    const weekday = maputoWeekday(at);

    const players = await this.humans();
    if (!players.length) return;

    const playerIds = players.map((player) => player.id);

    const [nudged, playedToday, enrolled, ranks, remembered] = await Promise.all([
      notificationService.engagedToday(
        players.map((player) => player.userId),
        day
      ),
      this.playedToday(playerIds, day),
      championshipService.playedIn(
        [championshipService.periodFor(), championshipService.pendingClose()],
        playerIds
      ),
      this.boards(),
      this.remembered(playerIds, day),
    ]);

    const fresh = at.getTime() - FRESH_DAYS * DAY_MS;

    for (const player of players) {
      if (nudged.has(player.userId)) continue;

      await this.nudge(player, {
        championship: this.standing("Championship", player.id, ranks, remembered),
        global: this.standing("Global", player.id, ranks, remembered),
        playedToday: playedToday.has(player.id),
        enrolled: enrolled.has(player.id),
        fresh: player.createdAt.getTime() >= fresh,
        critical: CRITICAL_WEEKDAYS.includes(weekday),
        finalDay: weekday === FINAL_WEEKDAY,
      });
    }

    await this.snapshot(players, ranks, day);
    await this.prune(day);
  }

  private async nudge(player: Human, seen: Seen) {
    const contact = {
      userId: player.userId,
      email: player.user.email,
      nickname: player.nickname,
    };

    if (seen.critical && seen.championship)
      return notifierService.championshipStatus({
        ...contact,
        board: seen.championship.board,
        rank: seen.championship.rank,
        move: seen.championship.move,
        finalDay: seen.finalDay,
      });

    if (player.xp === 0)
      return seen.fresh ? notifierService.newAccount(contact) : undefined;

    if (seen.playedToday) return;
    if (!seen.enrolled && !seen.fresh) return;

    const where = seen.championship ?? seen.global;

    return notifierService.comeBack({
      ...contact,
      board: where?.board,
      rank: where?.rank,
      move: where?.move,
    });
  }

  private humans() {
    return playerService.findMany(
      { type: "Human" },
      {
        select: {
          id: true,
          userId: true,
          nickname: true,
          xp: true,
          createdAt: true,
          user: { select: { email: true } },
        },
      }
    );
  }

  private async playedToday(playerIds: string[], day: Date) {
    const games = await gameService.findMany(
      {
        createdAt: { gte: day },
        OR: [
          { playerOneId: { in: playerIds } },
          { playerTwoId: { in: playerIds } },
        ],
      },
      { select: { playerOneId: true, playerTwoId: true } }
    );

    return new Set(
      games.flatMap((game) => [game.playerOneId, game.playerTwoId])
    );
  }

  private async boards() {
    const boards = await Promise.all(
      BOARDS.map(async (board) => [board.board, await board.ranks()] as const)
    );

    return new Map(boards);
  }

  private async remembered(playerIds: string[], day: Date) {
    const rows = await this.findMany(
      { playerId: { in: playerIds }, day: { lt: day } },
      {
        orderBy: { day: "desc" },
        select: { playerId: true, board: true, rank: true },
      }
    );

    const latest = new Map<string, number>();

    for (const row of rows) {
      const key = `${row.playerId}:${row.board}`;
      if (!latest.has(key)) latest.set(key, row.rank);
    }

    return latest;
  }

  private standing(
    board: RankBoard,
    playerId: string,
    ranks: Map<RankBoard, Map<string, Place>>,
    remembered: Map<string, number>
  ): Standing | undefined {
    const place = ranks.get(board)?.get(playerId);
    if (!place) return undefined;

    const before = remembered.get(`${playerId}:${board}`);

    return {
      board,
      rank: place.rank,
      move: before === undefined ? null : before - place.rank,
    };
  }

  private async snapshot(
    players: Human[],
    ranks: Map<RankBoard, Map<string, Place>>,
    day: Date
  ) {
    const data = players.flatMap((player) =>
      BOARDS.flatMap((board) => {
        const place = ranks.get(board.board)?.get(player.id);

        return place
          ? [{ playerId: player.id, board: board.board, rank: place.rank, day }]
          : [];
      })
    );

    if (!data.length) return;

    await this.deleteMany({
      playerId: { in: players.map((player) => player.id) },
      day,
    });

    await this.createMany(data);
  }

  private async prune(day: Date) {
    await this.deleteMany({
      day: { lt: new Date(day.getTime() - SNAPSHOT_KEEP_DAYS * DAY_MS) },
    });
  }
}

const dailyNudgeService = new DailyNudgeService("rank-snapshot");

export default dailyNudgeService;
