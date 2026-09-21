import { BaseService } from "arkos/services";
import { PlayerType } from "@prisma/client";
import { GameOutcome, XP_PER_RESULT } from "../player/player.service";

const DAY_MS = 24 * 60 * 60 * 1000;
const PERIOD_MS = 7 * DAY_MS;
const PRIOR_PERIODS = 8;

export const WINNER_COUNT = 4;

export interface ChampionshipBounds {
  startedAt: Date;
  endedAt: Date;
}

export interface Standing {
  id: string;
  playerId: string;
  userId: string;
  nickname: string;
  xp: number;
  wins: number;
  losses: number;
  draws: number;
  firstGameAt: Date;
}

export interface Participant extends Standing {
  email: string;
}

interface Sortable {
  playerId: string;
  xp: number;
  wins: number;
  losses: number;
  draws: number;
  firstGameAt: Date;
}

interface ParticipantRow extends Standing {
  type: PlayerType;
  email: string;
}

const ORDER_BY = [
  { xp: "desc" },
  { wins: "desc" },
  { losses: "asc" },
  { draws: "asc" },
  { firstGameAt: "asc" },
] as const;

class ChampionshipService extends BaseService<"player-championship-stats"> {
  /**
   * The championship week `at` falls in: Monday 00:00 through the next Monday
   * 00:00, Africa/Maputo. Mozambique sits at UTC+2 all year with no daylight
   * saving, so the window is a fixed shift away from UTC and needs no timezone
   * database — move into local time, snap back to the Monday on or before it,
   * then move back.
   */
  periodFor(at: Date = new Date()): ChampionshipBounds {
    const local = new Date(at.getTime());
    const daysSinceMonday = (local.getUTCDay() + 6) % 7;
    const mondayLocalMidnight = Date.UTC(
      local.getUTCFullYear(),
      local.getUTCMonth(),
      local.getUTCDate() - daysSinceMonday,
    );

    const startedAt = new Date(mondayLocalMidnight);

    return { startedAt, endedAt: new Date(startedAt.getTime() + PERIOD_MS) };
  }

  /** The week before `period`, at whatever length `period` itself runs for. */
  previousPeriod(period: ChampionshipBounds): ChampionshipBounds {
    const length = period.endedAt.getTime() - period.startedAt.getTime();

    return {
      startedAt: new Date(period.startedAt.getTime() - length),
      endedAt: period.startedAt,
    };
  }

  /**
   * Folds a settled game into each player's row for the week it settled in. The
   * settle moment picks the row, not the moment play started, because a game that
   * runs across the boundary settles after the close-out has already gone out.
   * Each write is one upsert of relative increments, so two games landing at once
   * cannot lose each other's XP the way a read-then-write would.
   */
  async recordGame(
    outcomes: { playerId: string; result: GameOutcome }[],
    at: Date = new Date(),
  ) {
    if (outcomes.length === 0) return;

    const period = this.periodFor(at);

    await Promise.all(
      outcomes.map(({ playerId, result }) =>
        this.prisma.playerChampionshipStats.upsert({
          where: {
            playerId_startedAt: { playerId, startedAt: period.startedAt },
          },
          create: {
            playerId,
            startedAt: period.startedAt,
            endedAt: period.endedAt,
            firstGameAt: at,
            xp: XP_PER_RESULT[result],
            wins: result === "win" ? 1 : 0,
            losses: result === "loss" ? 1 : 0,
            draws: result === "draw" ? 1 : 0,
          },
          update: {
            xp: { increment: XP_PER_RESULT[result] },
            wins: { increment: result === "win" ? 1 : 0 },
            losses: { increment: result === "loss" ? 1 : 0 },
            draws: { increment: result === "draw" ? 1 : 0 },
          },
        }),
      ),
    );
  }

  /**
   * One page of the week's standings, best first. Rungs 1-5 of the tie-break are
   * the sort order itself; rungs 6-7 only ever run for rows still identical down
   * to the millisecond the player's first game of the week landed on.
   */
  async standings(period: ChampionshipBounds, page: number, limit: number) {
    const skip = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      this.prisma.playerChampionshipStats.findMany({
        where: { startedAt: period.startedAt },
        orderBy: [...ORDER_BY],
        skip,
        take: limit,
        include: { player: { select: { nickname: true, userId: true } } },
      }),
      this.count({ startedAt: period.startedAt }),
    ]);

    const players: Standing[] = rows.map((row) => ({
      id: row.id,
      playerId: row.playerId,
      userId: row.player.userId,
      nickname: row.player.nickname,
      xp: row.xp,
      wins: row.wins,
      losses: row.losses,
      draws: row.draws,
      firstGameAt: row.firstGameAt,
    }));

    return {
      players: await this.breakTies(players, period),
      total,
      page,
      limit,
    };
  }

  /** Everyone who played the week, best first, and nothing that identifies a contact. */
  async participants(period: ChampionshipBounds): Promise<Standing[]> {
    const standings = await this.ordered(period);

    return standings.map((standing) => ({
      id: standing.id,
      playerId: standing.playerId,
      userId: standing.userId,
      nickname: standing.nickname,
      xp: standing.xp,
      wins: standing.wins,
      losses: standing.losses,
      draws: standing.draws,
      firstGameAt: standing.firstGameAt,
    }));
  }

  /**
   * Everyone who played the week and can be written to, best first. Bots are held
   * back here rather than at the call site: their addresses are generated filler,
   * and sending to them would spend the domain's reputation on nobody.
   */
  async recipients(period: ChampionshipBounds): Promise<Participant[]> {
    const standings = await this.ordered(period);

    return standings
      .filter((standing) => standing.type === "Human")
      .map((standing) => ({
        id: standing.id,
        playerId: standing.playerId,
        userId: standing.userId,
        nickname: standing.nickname,
        xp: standing.xp,
        wins: standing.wins,
        losses: standing.losses,
        draws: standing.draws,
        firstGameAt: standing.firstGameAt,
        email: standing.email,
      }));
  }

  async playedIn(
    periods: ChampionshipBounds[],
    playerIds: string[],
  ): Promise<Set<string>> {
    if (playerIds.length === 0) return new Set();

    const rows = await this.findMany(
      {
        startedAt: { in: periods.map((period) => period.startedAt) },
        playerId: { in: playerIds },
      },
      { select: { playerId: true } },
    );

    return new Set(rows.map((row) => row.playerId));
  }

  /**
   * The week that just ended. Older weeks are left alone rather than mailed late,
   * so a long outage skips a close-out instead of announcing a stale champion.
   */
  pendingClose(at: Date = new Date()): ChampionshipBounds {
    return this.previousPeriod(this.periodFor(at));
  }

  /**
   * Claims the close-out for `period`, answering false when another run already
   * took it. This is what stops a restart on the boundary mailing everyone twice.
   */
  async beginClose(period: ChampionshipBounds): Promise<boolean> {
    const existing = await this.prisma.championshipPeriod.findUnique({
      where: { startedAt: period.startedAt },
    });
    if (existing?.notifiedAt) return false;

    await this.prisma.championshipPeriod.upsert({
      where: { startedAt: period.startedAt },
      create: { startedAt: period.startedAt, endedAt: period.endedAt },
      update: {},
    });

    return true;
  }

  /** Marks the week done and flush. Called whether or not anything was sent. */
  async finishClose(period: ChampionshipBounds) {
    await this.prisma.championshipPeriod.update({
      where: { startedAt: period.startedAt },
      data: { notifiedAt: new Date() },
    });
  }

  /** The champions whose win the badges currently show. */
  async latestWinners() {
    const period = this.previousPeriod(this.periodFor());
    const participants = await this.participants(period);

    return { period, winners: participants.slice(0, WINNER_COUNT) };
  }

  private async ordered(period: ChampionshipBounds): Promise<ParticipantRow[]> {
    const rows = await this.prisma.playerChampionshipStats.findMany({
      where: { startedAt: period.startedAt },
      orderBy: [...ORDER_BY],
      include: {
        player: {
          select: {
            nickname: true,
            userId: true,
            type: true,
            user: { select: { email: true } },
          },
        },
      },
    });

    const standings: ParticipantRow[] = rows.map((row) => ({
      id: row.id,
      playerId: row.playerId,
      userId: row.player.userId,
      nickname: row.player.nickname,
      type: row.player.type,
      email: row.player.user.email,
      xp: row.xp,
      wins: row.wins,
      losses: row.losses,
      draws: row.draws,
      firstGameAt: row.firstGameAt,
    }));

    return this.breakTies(standings, period);
  }

  /**
   * Rungs 6 and 7 of the tie-break, applied only where the sort above left two
   * players indistinguishable: walk back through the weeks they have played, most
   * recent first, and let the first week they disagree on decide it — sitting a
   * week out reads as zero against someone who played it. If every week either
   * played agrees, whoever signed up first takes it. Each player's history arrives
   * in one query, so this costs the same whether one pair is tied or all of them.
   */
  private async breakTies<T extends Sortable>(
    rows: T[],
    period: ChampionshipBounds,
  ): Promise<T[]> {
    const groups: T[][] = [];

    for (const row of rows) {
      const group = groups[groups.length - 1];

      if (group && this.indistinguishable(group[0], row)) group.push(row);
      else groups.push([row]);
    }

    const contested = groups.filter((group) => group.length > 1);
    if (contested.length === 0) return rows;

    const playerIds = contested.flat().map((row) => row.playerId);

    const [history, signups] = await Promise.all([
      this.prisma.playerChampionshipStats.findMany({
        where: {
          playerId: { in: playerIds },
          startedAt: { lt: period.startedAt },
        },
        orderBy: { startedAt: "desc" },
        select: { playerId: true, xp: true },
      }),
      this.prisma.player.findMany({
        where: { id: { in: playerIds } },
        select: { id: true, createdAt: true },
      }),
    ]);

    const priorXp = new Map<string, number[]>(playerIds.map((id) => [id, []]));
    for (const row of history) {
      const series = priorXp.get(row.playerId);
      if (series && series.length < PRIOR_PERIODS) series.push(row.xp);
    }

    const signupAt = new Map(signups.map((p) => [p.id, p.createdAt.getTime()]));

    const byTieBreak = (a: T, b: T) => {
      const seriesA = priorXp.get(a.playerId) ?? [];
      const seriesB = priorXp.get(b.playerId) ?? [];
      const depth = Math.max(seriesA.length, seriesB.length);

      for (let week = 0; week < depth; week++) {
        const gap = (seriesA[week] ?? 0) - (seriesB[week] ?? 0);
        if (gap !== 0) return -gap;
      }

      return (signupAt.get(a.playerId) ?? 0) - (signupAt.get(b.playerId) ?? 0);
    };

    return groups.flatMap((group) =>
      group.length > 1 ? group.sort(byTieBreak) : group,
    );
  }

  private indistinguishable(a: Sortable, b: Sortable) {
    return (
      a.xp === b.xp &&
      a.wins === b.wins &&
      a.losses === b.losses &&
      a.draws === b.draws &&
      a.firstGameAt.getTime() === b.firstGameAt.getTime()
    );
  }
}

const championshipService = new ChampionshipService(
  "player-championship-stats",
);

export default championshipService;

