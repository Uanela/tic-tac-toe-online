import { BaseService } from "arkos/services";
import championshipService from "../championship/championship.service";
import playerService from "../player/player.service";
import notifierService from "./notifier.service";
import { BOARDS, type Leaderboard, type Place } from "./utils/leaderboards";

const NOTABLE_DROP = 3;
const TOP_TEN = 10;
const FRESH_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

interface Observed {
  place?: Place;
  remembered?: number;
  tellable: boolean;
}

class RankAlertService extends BaseService<"rank-watch"> {
  async check(playerIds?: string[]) {
    await Promise.all(BOARDS.map((board) => this.settle(board, playerIds)));
  }

  private async settle(board: Leaderboard, playerIds?: string[]) {
    const places = await board.ranks();

    const watches = await this.findMany(
      {
        board: board.board,
        ...(playerIds ? { playerId: { in: playerIds } } : {}),
      },
      { select: { playerId: true, rank: true } }
    );

    const remembered = new Map(
      watches.map((watch) => [watch.playerId, watch.rank])
    );

    const candidates = playerIds ?? [
      ...new Set([...places.keys(), ...remembered.keys()]),
    ];

    const tellable = await this.tellable(candidates);

    await Promise.all(
      candidates.map((playerId) =>
        this.settleOne(board, playerId, {
          place: places.get(playerId),
          remembered: remembered.get(playerId),
          tellable: tellable.has(playerId),
        })
      )
    );
  }

  private async settleOne(
    board: Leaderboard,
    playerId: string,
    { place, remembered, tellable }: Observed
  ) {
    if (!place || !tellable) {
      if (remembered !== undefined) await this.forget(board, playerId);
      return;
    }

    if (remembered === undefined) {
      await this.remember(board, playerId, place.rank);
      return;
    }

    if (place.rank <= remembered) {
      if (place.rank < remembered)
        await this.remember(board, playerId, place.rank);

      return;
    }

    await this.remember(board, playerId, place.rank);

    if (!this.notable(remembered, place.rank)) return;

    await notifierService.rankDropped({
      board: board.board,
      userId: place.userId,
      rank: place.rank,
    });
  }

  private notable(from: number, to: number) {
    return from <= TOP_TEN || to - from >= NOTABLE_DROP;
  }

  private async tellable(playerIds: string[]): Promise<Set<string>> {
    if (playerIds.length === 0) return new Set();

    const played = await championshipService.playedIn(
      [championshipService.periodFor(), championshipService.pendingClose()],
      playerIds
    );

    const players = await playerService.findMany(
      { id: { in: playerIds }, type: "Human" },
      { select: { id: true, xp: true, createdAt: true } }
    );

    const fresh = Date.now() - FRESH_DAYS * DAY_MS;

    return new Set(
      players
        .filter(
          (player) =>
            player.xp > 0 &&
            (played.has(player.id) || player.createdAt.getTime() >= fresh)
        )
        .map((player) => player.id)
    );
  }

  private async remember(board: Leaderboard, playerId: string, rank: number) {
    const existing = await this.findOne(
      { playerId, board: board.board },
      { select: { id: true } }
    );

    if (existing) return this.updateById(existing.id, { rank });

    return this.createOne({ playerId, board: board.board, rank });
  }

  private async forget(board: Leaderboard, playerId: string) {
    await this.deleteMany({ playerId, board: board.board });
  }
}

const rankAlertService = new RankAlertService("rank-watch");

export default rankAlertService;
