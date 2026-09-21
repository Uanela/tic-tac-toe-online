import type { RankBoard } from "@prisma/client";
import championshipService from "../../championship/championship.service";
import playerService, { RANKING_ORDER } from "../../player/player.service";

/** Where a player stands on a board, and who to tell about it. */
export interface Place {
  userId: string;
  rank: number;
}

/** One leaderboard, asked the same question so both are read the same way. */
export interface Leaderboard {
  board: RankBoard;
  /** Every place on the board at once, so a whole sweep reads off a single query. */
  ranks(): Promise<Map<string, Place>>;
}

const championship: Leaderboard = {
  board: "Championship",

  async ranks() {
    const standings = await championshipService.participants(
      championshipService.periodFor()
    );

    return new Map(
      standings.map((standing, index) => [
        standing.playerId,
        { userId: standing.userId, rank: index + 1 },
      ])
    );
  },
};

const global: Leaderboard = {
  board: "Global",

  async ranks() {
    const players = await playerService.findMany(
      {},
      { orderBy: [...RANKING_ORDER], select: { id: true, userId: true } }
    );

    return new Map(
      players.map((player, index) => [
        player.id,
        { userId: player.userId, rank: index + 1 },
      ])
    );
  },
};

export const BOARDS = [championship, global];
