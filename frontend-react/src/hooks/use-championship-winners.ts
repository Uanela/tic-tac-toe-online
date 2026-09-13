import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { Standing } from "../lib/championship";

interface WinnersResponse {
  winners: Standing[];
}

/**
 * Last week's top four, mapped from player id to the rank they finished on.
 * Every row and both scoreboard cards read the same list, so it is fetched once
 * per page instead of per badge. An unplayed week comes back empty, which is
 * exactly what "nobody is wearing a badge" looks like.
 */
export function useChampionshipWinners() {
  const [ranks, setRanks] = useState<Record<string, number>>({});

  useEffect(() => {
    api
      .get<WinnersResponse>("/championship/winners")
      .then((res) =>
        setRanks(
          Object.fromEntries(res.winners.map((w, i) => [w.playerId, i + 1]))
        )
      )
      .catch(() => {});
  }, []);

  return ranks;
}
