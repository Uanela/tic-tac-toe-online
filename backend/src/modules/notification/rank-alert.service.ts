import { BaseService } from "arkos/services";
import championshipService from "../championship/championship.service";
import playerService from "../player/player.service";
import notifierService from "./notifier.service";
import { BOARDS, type Leaderboard, type Place } from "./utils/leaderboards";

/** How many places a player has to fall — outside the top ten — before it is news. */
const NOTABLE_DROP = 3;

/** Inside the top ten every place counts, so one step down is worth a word. */
const TOP_TEN = 10;

/** How long a brand new account is spared from having to have earned its alert. */
const FRESH_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

/** What one check knows about one player before deciding anything. */
interface Observed {
  place?: Place;
  /** The place this player was last written down at, if they were ever written down. */
  remembered?: number;
  /** Whether this player is one we are allowed to interrupt at all. */
  tellable: boolean;
}

/**
 * Tells a player when they have fallen on a leaderboard. A fall can happen two ways
 * and both have to be caught: by playing the match that costs you places, which the
 * game reports as it settles, and by somebody else's match pushing you down, which
 * only the hourly sweep can see.
 */
class RankAlertService extends BaseService<"rank-watch"> {
  async check(playerIds?: string[]) {
    await Promise.all(BOARDS.map((board) => this.settle(board, playerIds)));
  }

  private async settle(board: Leaderboard, playerIds?: string[]) {
    const places = await board.ranks();

    const watches = await this.prisma.rankWatch.findMany({
      where: {
        board: board.board,
        ...(playerIds ? { playerId: { in: playerIds } } : {}),
      },
      select: { playerId: true, rank: true },
    });

    const remembered = new Map(
      watches.map((watch) => [watch.playerId, watch.rank])
    );

    // The sweep covers everyone holding a place or remembered at one; a check after a
    // match only ever covers the two who played it.
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
    // Off the board, or nobody to tell. A week that turned over is not a fall, a bot
    // has nobody behind it, and a player we do not interrupt is not one we remember
    // either — a place kept for a player who has stopped playing would only come
    // back as news of a fall they slept through.
    if (!place || !tellable) {
      if (remembered !== undefined) await this.forget(board, playerId);
      return;
    }

    // Never written down: this is where they start, not somewhere they fell from.
    if (remembered === undefined) {
      await this.remember(board, playerId, place.rank);
      return;
    }

    // A climb is not news, but it is worth remembering, so that the next fall is
    // measured from the best place they have held since they were last told anything.
    if (place.rank <= remembered) {
      if (place.rank < remembered)
        await this.remember(board, playerId, place.rank);

      return;
    }

    // Written down before the alert goes out, so a push that fails is lost rather
    // than repeated on every check from here on.
    await this.remember(board, playerId, place.rank);

    if (!this.notable(remembered, place.rank)) return;

    await notifierService.rankDropped({
      board: board.board,
      userId: place.userId,
      rank: place.rank,
    });
  }

  /**
   * A fall worth telling somebody about: a step out of the top ten, however short,
   * or three places anywhere below it. Lesser slides are the board breathing.
   */
  private notable(from: number, to: number) {
    return from <= TOP_TEN || to - from >= NOTABLE_DROP;
  }

  /**
   * Who we are allowed to interrupt: they turned out for this championship week or
   * the one before it, or signed up less than a week ago. Everyone else — the lapsed,
   * and the bots behind them — is left alone.
   */
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
    await this.prisma.rankWatch.upsert({
      where: { playerId_board: { playerId, board: board.board } },
      create: { playerId, board: board.board, rank },
      update: { rank },
    });
  }

  private async forget(board: Leaderboard, playerId: string) {
    await this.prisma.rankWatch.deleteMany({
      where: { playerId, board: board.board },
    });
  }
}

const rankAlertService = new RankAlertService("rank-watch");

export default rankAlertService;
