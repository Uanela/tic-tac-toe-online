import { BaseService } from "arkos/services";

export const XP_PER_RESULT = { win: 50, draw: 15, loss: 5 } as const;

export type GameOutcome = keyof typeof XP_PER_RESULT;

class PlayerService extends BaseService<"player"> {
  async findByUserId(userId: string) {
    return this.findOne({ userId }, { omit: { type: true } });
  }

  async findRanking(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [players, total] = await Promise.all([
      this.findMany(
        {},
        {
          orderBy: { xp: "desc" },
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
