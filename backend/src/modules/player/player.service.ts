import { BaseService } from "arkos/services";
import type { Prisma } from "@prisma/client";

export const XP_PER_RESULT = { win: 50, draw: 15, loss: 5 } as const;

/** Ties in XP are settled by who signed up first, so equal scores hold one order
 *  between the page that shows the ranking and the alerts that watch its top ten. */
export const RANKING_ORDER = [{ xp: "desc" }, { createdAt: "asc" }] as const;

export type GameOutcome = keyof typeof XP_PER_RESULT;

/** How much of a player's history one page of a profile carries, and the ceiling a caller may ask for. */
export const MATCH_HISTORY = { default: 5, max: 25 } as const;

class PlayerService extends BaseService<"player"> {
  async findByUserId(userId: string) {
    return this.findOne({ userId }, { omit: { type: true } });
  }

  /**
   * One page of a player's settled games, most recent first, plus how many there
   * are in total so the caller can page through the rest. Unsettled games are
   * filtered out in the query rather than afterwards: a room still open is not
   * history, and one abandoned mid-match never settles, so it would hold a slot
   * against every page of the history forever.
   */
  async findMatches(playerId: string, page: number, limit: number) {
    const where: Prisma.GameWhereInput = {
      result: { not: null },
      OR: [{ playerOneId: playerId }, { playerTwoId: playerId }],
    };

    const [games, total] = await Promise.all([
      this.prisma.game.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          playerOne: { select: { id: true, userId: true, nickname: true } },
          playerTwo: { select: { id: true, userId: true, nickname: true } },
        },
      }),
      this.prisma.game.count({ where }),
    ]);

    const matches = games.map((game) => {
      const asPlayerOne = game.playerOneId === playerId;
      const won = asPlayerOne
        ? game.result === "PlayerOneWin"
        : game.result === "PlayerTwoWin";

      return {
        id: game.id,
        // The row is read from one player's side, so the winner is theirs or nobody's.
        result: game.result === "Draw" ? "draw" : won ? "win" : "loss",
        playedAt: game.createdAt,
        opponent: asPlayerOne ? game.playerTwo : game.playerOne,
      };
    });

    return { matches, total, page, limit };
  }

  /** The profile card's header plus the first page of their history. */
  async findProfile(
    playerId: string,
    page: number = 1,
    limit: number = MATCH_HISTORY.default
  ) {
    const [player, history] = await Promise.all([
      this.findOne({ id: playerId }, { omit: { type: true } }),
      this.findMatches(playerId, page, limit),
    ]);

    if (!player) return null;

    return { player, ...history };
  }

  async findRanking(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [players, total] = await Promise.all([
      this.findMany(
        {},
        {
          orderBy: [...RANKING_ORDER],
          skip,
          take: limit,
          include: { user: { select: { email: true } } },
          omit: { type: true },
        }
      ),
      this.count({}),
    ]);
    return { players, total, page, limit };
  }

  async addXp(playerId: string, amount: number) {
    const player = await this.findOne({ id: playerId });
    if (!player) return null;
    return this.updateOne({ id: playerId }, { xp: player.xp + amount });
  }

  async recordResult(playerId: string, result: GameOutcome) {
    const player = await this.findOne({ id: playerId });
    if (!player) return null;

    return this.updateOne(
      { id: playerId },
      {
        wins: result === "win" ? player.wins + 1 : player.wins,
        losses: result === "loss" ? player.losses + 1 : player.losses,
        draws: result === "draw" ? player.draws + 1 : player.draws,
        xp: player.xp + XP_PER_RESULT[result],
      }
    );
  }
}

const playerService = new PlayerService("player");

export default playerService;
