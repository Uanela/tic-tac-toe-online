/** Badge colours for a championship week's top four, best rank first. */
export const BADGE_COLORS: Record<number, string> = {
  1: "#f5c56a",
  2: "#c0c0c0",
  3: "#cd7f32",
  4: "#7c6af5",
};

export interface Standing {
  id: string;
  playerId: string;
  userId: string;
  nickname: string;
  xp: number;
  wins: number;
  losses: number;
  draws: number;
  firstGameAt: string;
}

export interface ChampionshipPeriod {
  startedAt: string;
  endedAt: string;
}
